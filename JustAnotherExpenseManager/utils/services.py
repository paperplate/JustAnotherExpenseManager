"""
Service layer for transaction operations.

This version requires proper types:
- TransactionType enum (not strings)
- Float amounts (converted to cents internally by model)
"""

import random
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, and_
from datetime import datetime, timedelta

from JustAnotherExpenseManager.models import Transaction, Tag, TransactionType


class TransactionService:
    """Service class for transaction-related operations."""

    def __init__(self, db_session: Session) -> None:
        """
        Initialize TransactionService.

        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session

    def create_transaction(
        self,
        description: str,
        amount_dollars: float,
        type: TransactionType,
        date: str,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> int:
        """Create a new transaction."""
        transaction = Transaction(
            description=description,
            amount_dollars=amount_dollars,
            type=type,
            date=date
        )

        # Add to session first so the object is tracked before any flush()
        # calls inside _get_or_create_tag — avoids the SAWarning about
        # "Object of type <Transaction> not in session".
        self.db.add(transaction)

        # Add category tag if provided
        if category:
            category_tag = self._get_or_create_tag(f'category:{category}')
            transaction.add_tag(category_tag)

        # Add additional tags
        if tags:
            tag_names = [
                t.strip()
                for t in tags
                if t.strip() and not t.strip().startswith('category:')
            ]
            for tag_name in tag_names:
                tag = self._get_or_create_tag(tag_name)
                transaction.add_tag(tag)

        self.db.commit()

        return transaction.id

    def get_all_transactions(
        self,
        page: int = 1,
        categories: Optional[str] = None,
        tags: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get paginated list of transactions by month.
        Each page shows all transactions for one month.
        """
        query = self.db.query(Transaction)

        # Filter by categories
        if categories:
            category_list = [c.strip() for c in categories.split(',') if c.strip()]
            category_tags = [f'category:{c}' for c in category_list]
            query = query.filter(
                Transaction.tags.any(Tag.name.in_(category_tags))
            )

        # Filter by tags
        if tags:
            tag_list = [t.strip() for t in tags.split(',') if t.strip()]
            for tag_name in tag_list:
                query = query.filter(
                    Transaction.tags.any(Tag.name == tag_name)
                )

        # Filter by date range
        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)

        # Apply time range filter
        if time_range and not (start_date or end_date):
            today = datetime.now().date()
            if time_range == '7d':
                start = (today - timedelta(days=7)).strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)
            elif time_range == '30d':
                start = (today - timedelta(days=30)).strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)
            elif time_range == '90d':
                start = (today - timedelta(days=90)).strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)

        # Sort by date descending, then by id descending for stable ordering
        all_transactions = query.order_by(
            Transaction.date.desc(),
            Transaction.id.desc()
        ).all()

        # Group by month (YYYY-MM)
        months: Dict[str, List[Transaction]] = {}
        for trans in all_transactions:
            month_key = trans.date[:7]
            if month_key not in months:
                months[month_key] = []
            months[month_key].append(trans)

        # Sort months descending (newest first)
        sorted_months = sorted(months.keys(), reverse=True)
        total_months = len(sorted_months)

        # Get transactions for requested page (month)
        if page < 1:
            page = 1
        if page > total_months and total_months > 0:
            page = total_months

        transactions = []
        current_month = None
        if total_months > 0 and page <= total_months:
            current_month = sorted_months[page - 1]
            transactions = months[current_month]

        total = len(all_transactions)

        return {
            'transactions': transactions,
            'current_month': current_month,
            'total': total,
            'page': page,
            'total_pages': total_months,
            'all_months': sorted_months
        }

    def update_transaction(
        self,
        transaction_id: int,
        description: str,
        amount_dollars: float,
        type: TransactionType,
        date: str,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> bool:
        """Update an existing transaction."""
        transaction = self.db.query(Transaction).filter(
            Transaction.id == transaction_id
        ).first()

        if not transaction:
            raise ValueError("Transaction not found")

        transaction.description = description
        transaction.amount_dollars = amount_dollars
        transaction.type = type
        transaction.date = date

        transaction.tags = []

        if category:
            category_tag = self._get_or_create_tag(f'category:{category}')
            transaction.add_tag(category_tag)

        if tags:
            tag_names = [
                t.strip()
                for t in tags
                if t.strip() and not t.strip().startswith('category:')
            ]
            for tag_name in tag_names:
                tag = self._get_or_create_tag(tag_name)
                transaction.add_tag(tag)

        self.db.commit()
        return True

    def delete_transaction(self, transaction_id: int) -> bool:
        """Delete a transaction."""
        transaction = self.db.query(Transaction).filter(
            Transaction.id == transaction_id
        ).first()

        if transaction:
            self.db.delete(transaction)
            self.db.commit()
            return True
        return False

    def _get_or_create_tag(self, tag_name: str) -> Tag:
        """Get existing tag or create new one."""
        tag = self.db.query(Tag).filter_by(name=tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            self.db.add(tag)
            self.db.flush()
        return tag


class StatsService:
    """Service class for statistics and reporting."""

    def __init__(self, db_session: Session) -> None:
        """Initialize StatsService."""
        self.db = db_session

    def get_summary_stats(
        self,
        categories: Optional[str] = None,
        tags: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get summary statistics."""
        query = self.db.query(Transaction)

        if categories:
            category_list = [c.strip() for c in categories.split(',') if c.strip()]
            category_tags = [f'category:{c}' for c in category_list]
            query = query.filter(
                Transaction.tags.any(Tag.name.in_(category_tags))
            )

        if tags:
            tag_list = [t.strip() for t in tags.split(',') if t.strip()]
            for tag_name in tag_list:
                query = query.filter(
                    Transaction.tags.any(Tag.name == tag_name)
                )

        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)

        if time_range and not (start_date or end_date):
            today = datetime.now().date()
            if time_range == '7d':
                start = (today - timedelta(days=7)).strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)
            elif time_range == '30d':
                start = (today - timedelta(days=30)).strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)
            elif time_range == '90d':
                start = (today - timedelta(days=90)).strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)

        transactions = query.all()

        income = sum(
            t.amount_dollars for t in transactions
            if t.type == TransactionType.INCOME
        )
        expenses = sum(
            t.amount_dollars for t in transactions
            if t.type == TransactionType.EXPENSE
        )

        return {
            'income': round(income, 2),
            'expenses': round(expenses, 2),
            'net': round(income - expenses, 2),
            'transaction_count': len(transactions)
        }

    def get_category_breakdown(
        self,
        categories: Optional[str] = None,
        tags: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Tuple]:
        """Get per-category expense and income totals."""
        query = self.db.query(Transaction)

        if categories:
            category_list = [c.strip() for c in categories.split(',') if c.strip()]
            category_tags = [f'category:{c}' for c in category_list]
            query = query.filter(
                Transaction.tags.any(Tag.name.in_(category_tags))
            )

        if tags:
            tag_list = [t.strip() for t in tags.split(',') if t.strip()]
            for tag_name in tag_list:
                query = query.filter(
                    Transaction.tags.any(Tag.name == tag_name)
                )

        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)

        if time_range and not (start_date or end_date):
            today = datetime.now().date()
            if time_range == '7d':
                start = (today - timedelta(days=7)).strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)
            elif time_range == '30d':
                start = (today - timedelta(days=30)).strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)
            elif time_range == '90d':
                start = (today - timedelta(days=90)).strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)

        transactions = query.all()

        category_data: Dict[str, Dict[str, float]] = {}
        for trans in transactions:
            category = trans.category or 'uncategorized'
            if category not in category_data:
                category_data[category] = {'expenses': 0.0, 'income': 0.0}
            if trans.type == TransactionType.EXPENSE:
                category_data[category]['expenses'] += trans.amount_dollars
            else:
                category_data[category]['income'] += trans.amount_dollars

        result = [
            (cat, round(data['expenses'], 2), round(data['income'], 2))
            for cat, data in category_data.items()
        ]
        result.sort(key=lambda x: x[1], reverse=True)
        return result

    def get_monthly_data(
        self,
        categories: Optional[str] = None,
        tags: Optional[str] = None
    ) -> List[Tuple]:
        """Get monthly aggregated expense and income totals."""
        query = self.db.query(Transaction)

        if categories:
            category_list = [c.strip() for c in categories.split(',') if c.strip()]
            category_tags = [f'category:{c}' for c in category_list]
            query = query.filter(
                Transaction.tags.any(Tag.name.in_(category_tags))
            )

        if tags:
            tag_list = [t.strip() for t in tags.split(',') if t.strip()]
            for tag_name in tag_list:
                query = query.filter(
                    Transaction.tags.any(Tag.name == tag_name)
                )

        transactions = query.all()

        monthly: Dict[str, Dict[str, float]] = {}
        for trans in transactions:
            month_key = trans.date[:7]
            if month_key not in monthly:
                monthly[month_key] = {'expenses': 0.0, 'income': 0.0}
            if trans.type == TransactionType.EXPENSE:
                monthly[month_key]['expenses'] += trans.amount_dollars
            else:
                monthly[month_key]['income'] += trans.amount_dollars

        result = [
            (month, round(data['expenses'], 2), round(data['income'], 2))
            for month, data in monthly.items()
        ]
        result.sort(key=lambda x: x[0])
        return result


class CategoryService:
    """Service class for category and tag management."""

    def __init__(self, db_session: Session) -> None:
        """Initialize CategoryService."""
        self.db = db_session

    def get_all_categories(self) -> List[str]:
        """Get all category names (without the 'category:' prefix)."""
        tags = self.db.query(Tag).filter(Tag.name.like('category:%')).all()
        return [tag.name[len('category:'):] for tag in tags]

    def get_all_tags(self) -> List[str]:
        """Get all non-category tag names."""
        tags = self.db.query(Tag).filter(~Tag.name.like('category:%')).all()
        return [tag.name for tag in tags]

    def add_category(self, category_name: str) -> Tuple[bool, Optional[str]]:
        """Add a new category."""
        tag_name = f'category:{category_name}'
        existing = self.db.query(Tag).filter_by(name=tag_name).first()
        if existing:
            return False, 'Category already exists'

        self.db.add(Tag(name=tag_name))
        self.db.commit()
        return True, None

    def rename_category(
        self, old_name: str, new_name: str
    ) -> Tuple[bool, Optional[str], bool]:
        """
        Rename a category, updating all associated transactions.

        Returns:
            Tuple of (success, error_message, conflict)
        """
        old_tag_name = f'category:{old_name}'
        new_tag_name = f'category:{new_name}'

        old_tag = self.db.query(Tag).filter_by(name=old_tag_name).first()
        if not old_tag:
            return False, 'Category not found', False

        conflict_tag = self.db.query(Tag).filter_by(name=new_tag_name).first()
        if conflict_tag:
            return False, f'Category "{new_name}" already exists', True

        old_tag.name = new_tag_name
        self.db.commit()
        return True, None, False

    def merge_category(
        self, source_name: str, target_name: str
    ) -> Tuple[bool, Optional[str]]:
        """Merge source category into target, re-tagging all transactions."""
        source_tag_name = f'category:{source_name}'
        target_tag_name = f'category:{target_name}'

        source_tag = self.db.query(Tag).filter_by(name=source_tag_name).first()
        target_tag = self.db.query(Tag).filter_by(name=target_tag_name).first()

        if not source_tag:
            return False, f'Source category "{source_name}" not found'
        if not target_tag:
            return False, f'Target category "{target_name}" not found'

        for transaction in source_tag.transactions:
            if target_tag not in transaction.tags:
                transaction.tags.append(target_tag)
            transaction.tags.remove(source_tag)

        self.db.delete(source_tag)
        self.db.commit()
        return True, None

    def rename_tag(
        self, old_name: str, new_name: str
    ) -> Tuple[bool, Optional[str], bool]:
        """
        Rename a non-category tag across all transactions.

        Returns:
            Tuple of (success, error_message, conflict)
        """
        old_tag = self.db.query(Tag).filter_by(name=old_name).first()
        if not old_tag:
            return False, 'Tag not found', False

        conflict_tag = self.db.query(Tag).filter_by(name=new_name).first()
        if conflict_tag:
            return False, f'Tag "{new_name}" already exists', True

        old_tag.name = new_name
        self.db.commit()
        return True, None, False

    def merge_tag(
        self, source_name: str, target_name: str
    ) -> Tuple[bool, Optional[str]]:
        """Merge source tag into target across all transactions."""
        source_tag = self.db.query(Tag).filter_by(name=source_name).first()
        target_tag = self.db.query(Tag).filter_by(name=target_name).first()

        if not source_tag:
            return False, f'Tag "{source_name}" not found'
        if not target_tag:
            return False, f'Tag "{target_name}" not found'

        for transaction in list(source_tag.transactions):
            if target_tag not in transaction.tags:
                transaction.tags.append(target_tag)
            transaction.tags.remove(source_tag)

        self.db.delete(source_tag)
        self.db.commit()
        return True, None

    def delete_tag(self, tag_name: str) -> Tuple[bool, Optional[str]]:
        """Delete a non-category tag from all transactions."""
        tag = self.db.query(Tag).filter_by(name=tag_name).first()
        if not tag:
            return False, 'Tag not found'

        self.db.delete(tag)
        self.db.commit()
        return True, None

    def delete_category(self, category_name: str) -> Tuple[bool, Optional[str]]:
        """Delete a category tag from all transactions."""
        tag_name = f'category:{category_name}'
        tag = self.db.query(Tag).filter_by(name=tag_name).first()

        if not tag:
            return False, 'Category not found'

        self.db.delete(tag)
        self.db.commit()

        return True, None

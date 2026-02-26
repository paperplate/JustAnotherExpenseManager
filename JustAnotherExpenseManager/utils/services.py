"""
Service layer for transaction operations.

This version requires proper types:
- TransactionType enum (not strings)
- Float amounts (converted to cents internally by model)
"""

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from datetime import datetime, timedelta

from JustAnotherExpenseManager.models import Transaction, Tag, TransactionType

def _apply_transaction_filters(
    stmt,
    categories: Optional[str] = None,
    tags: Optional[str] = None,
    time_range: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Apply shared filter clauses to a Transaction select statement."""
    if categories:
        category_list = [c.strip() for c in categories.split(',') if c.strip()]
        category_tags = [f'category:{c}' for c in category_list]
        stmt = stmt.where(Transaction.tags.any(Tag.name.in_(category_tags)))

    if tags:
        tag_list = [t.strip() for t in tags.split(',') if t.strip()]
        for tag_name in tag_list:
            stmt = stmt.where(Transaction.tags.any(Tag.name == tag_name))

    if start_date:
        stmt = stmt.where(Transaction.date >= start_date)
    if end_date:
        stmt = stmt.where(Transaction.date <= end_date)

    if time_range and not (start_date or end_date):
        today = datetime.now().date()
        if time_range == '7d':
            start = (today - timedelta(days=7)).strftime('%Y-%m-%d')
            stmt = stmt.where(Transaction.date >= start)
        elif time_range == '30d':
            start = (today - timedelta(days=30)).strftime('%Y-%m-%d')
            stmt = stmt.where(Transaction.date >= start)
        elif time_range == '90d':
            start = (today - timedelta(days=90)).strftime('%Y-%m-%d')
            stmt = stmt.where(Transaction.date >= start)

    return stmt


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
        stmt = select(Transaction)
        stmt = _apply_transaction_filters(
            stmt, categories, tags, time_range, start_date, end_date
        )
        stmt = stmt.order_by(Transaction.date.desc(), Transaction.id.desc())

        all_transactions = self.db.scalars(stmt).unique().all()

        months: Dict[str, List[Transaction]] = {}
        for trans in all_transactions:
            month_key = trans.date[:7]
            if month_key not in months:
                months[month_key] = []
            months[month_key].append(trans)

        sorted_months = sorted(months.keys(), reverse=True)
        total_months = len(sorted_months)

        if page < 1:
            page = 1
        if page > total_months and total_months > 0:
            page = total_months

        transactions = []
        current_month = None
        if total_months > 0 and page <= total_months:
            current_month = sorted_months[page - 1]
            transactions = months[current_month]

        return {
            'transactions': transactions,
            'current_month': current_month,
            'total': len(all_transactions),
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
        transaction = self.db.get(Transaction, transaction_id)

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
        transaction = self.db.get(Transaction, transaction_id)

        if transaction:
            self.db.delete(transaction)
            self.db.commit()
            return True
        return False

    def _get_or_create_tag(self, tag_name: str) -> Tag:
        """Get existing tag or create a new one."""
        tag = self.db.scalars(
            select(Tag).where(Tag.name == tag_name)
        ).first()
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
        stmt = select(Transaction)
        stmt = _apply_transaction_filters(
            stmt, categories, tags, time_range, start_date, end_date
        )
        transactions = self.db.scalars(stmt).unique().all()

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
        stmt = select(Transaction)
        stmt = _apply_transaction_filters(
            stmt, categories, tags, time_range, start_date, end_date
        )
        transactions = self.db.scalars(stmt).unique().all()

        category_totals: Dict[str, Dict[str, float]] = {}
        for trans in transactions:
            cat = trans.category or 'uncategorized'
            if cat not in category_totals:
                category_totals[cat] = {'expenses': 0.0, 'income': 0.0}
            if trans.type == TransactionType.EXPENSE:
                category_totals[cat]['expenses'] += trans.amount_dollars
            else:
                category_totals[cat]['income'] += trans.amount_dollars

        result = [
            (cat, round(data['expenses'], 2), round(data['income'], 2))
            for cat, data in category_totals.items()
        ]
        result.sort(key=lambda x: x[1], reverse=True)
        return result

    def get_monthly_data(
        self,
        categories: Optional[str] = None,
        tags: Optional[str] = None
    ) -> List[Tuple]:
        """Get monthly income and expense totals."""
        stmt = select(Transaction)
        stmt = _apply_transaction_filters(stmt, categories, tags)
        transactions = self.db.scalars(stmt).unique().all()

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

    def count_months(
            self,
            categories: Optional[str] = None,
            time_range: Optional[str] = None,
            start_date: Optional[str] = None,
            end_date: Optional[str] = None,
            tags: Optional[str] = None
        ) -> int:
            """Count unique months with transactions."""
            stmt = select(Transaction)
            stmt = _apply_transaction_filters(stmt, categories, time_range, start_date, end_date, tags)
            transactions = self.db.scalars(stmt).unique().all()

            unique_months = set(trans.date[:7] for trans in transactions)
            return len(unique_months)

class CategoryService:
    """Service class for category and tag management."""

    def __init__(self, db_session: Session) -> None:
        """Initialize CategoryService."""
        self.db = db_session

    def get_all_categories(self) -> List[Dict[str, Any]]:
        """Get all category names (without the 'category:' prefix)."""
        tags = self.db.scalars(
            select(Tag).where(Tag.name.like('category:%'))
        ).all()
        return [
            {'full_name': tag.name, 'category_name': tag.name[len('category:'):]}
            for tag in tags
        ]

    def get_all_tags(self) -> List[str]:
        """Get all non-category tag names."""
        tags = self.db.scalars(
            select(Tag).where(~Tag.name.like('category:%'))
        ).all()
        return [tag.name for tag in tags]

    def _get_tag(self, name: str) -> Optional[Tag]:
        """Fetch a tag by exact name."""
        return self.db.scalars(
            select(Tag).where(Tag.name == name)
        ).first()

    def add_category(self, category_name: str) -> Tuple[bool, Optional[str]]:
        """Add a new category."""
        tag_name = f'category:{category_name}'
        if self._get_tag(tag_name):
            return False, 'Category already exists'

        self.db.add(Tag(name=tag_name))
        self.db.commit()
        return True, None

    def _merge_tags(self, source: Tag, target: Tag):
        """
        Merge provided categories/tags
        """
        for transaction in list(source.transactions):
            if target not in transaction.tags:
                transaction.tags.append(target)
            transaction.tags.remove(source)

        self.db.delete(source)
        self.db.commit()
        return True, None


    def update_category(
        self, source_name: str, target_name: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Rename source_name to target_name.

        Returns (False, 'Category already exists') when target_name already
        exists so the route can return a 409 and let the client prompt the user
        to confirm a merge via POST /api/categories/<name>/merge.
        """
        if source_name == target_name:
            return True, None

        source_tag = self._get_tag(f'category:{source_name}')
        if not source_tag:
            return False, 'Category not found'

        if self._get_tag(f'category:{target_name}'):
            return False, 'Category already exists'

        source_tag.name = f'category:{target_name}'
        self.db.commit()
        return True, None

    def merge_category(
        self, source_name: str, target_name: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Merge source_name into target_name.

        All transactions tagged with source_name are re-tagged to target_name,
        then source_name is deleted.
        """
        source_tag = self._get_tag(f'category:{source_name}')
        if not source_tag:
            return False, 'Category not found'

        target_tag = self._get_tag(f'category:{target_name}')
        if not target_tag:
            return False, 'Target category not found'

        return self._merge_tags(source_tag, target_tag)

    def update_tag(
        self, source_name: str, target_name: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Rename source_name to target_name.

        Returns (False, 'Tag already exists') when target_name already exists
        so the route can return a 409 and let the client prompt the user to
        confirm a merge via POST /api/tags/<name>/merge.
        """
        if source_name == target_name:
            return True, None

        if target_name.startswith('category:'):
            return False, 'Cannot rename tag to a category-prefixed name'

        source_tag = self._get_tag(source_name)
        if not source_tag:
            return False, 'Tag not found'

        if self._get_tag(target_name):
            return False, 'Tag already exists'

        source_tag.name = target_name
        self.db.commit()
        return True, None

    def merge_tag(
        self, source_name: str, target_name: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Merge source_name into target_name.

        All transactions tagged with source_name are re-tagged to target_name,
        then source_name is deleted.
        """
        source_tag = self._get_tag(source_name)
        if not source_tag:
            return False, 'Tag not found'

        target_tag = self._get_tag(target_name)
        if not target_tag:
            return False, 'Target tag not found'

        return self._merge_tags(source_tag, target_tag)

    def delete_tag(self, tag_name: str) -> Tuple[bool, Optional[str]]:
        """Delete a non-category tag from all transactions."""
        tag = self._get_tag(tag_name)
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

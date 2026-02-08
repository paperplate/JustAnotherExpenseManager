"""
Business logic for transaction operations.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import random
import re
from sqlalchemy import text
from sqlalchemy.orm import Session
from models import Transaction, Tag


class TransactionService:
    """Service class for transaction-related operations."""

    def __init__(self, db_session: Session) -> None:
        """
        Initialize TransactionService.

        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session

    def get_all_transactions(
        self,
        page: int = 1,
        per_page: int = 50
    ) -> Dict[str, Any]:
        """
        Get paginated list of transactions.

        Args:
            page: Page number (1-indexed)
            per_page: Number of transactions per page

        Returns:
            Dict containing transactions, total count, and pagination info
        """
        query = self.db.query(Transaction).order_by(
            Transaction.date.desc(),
            Transaction.created_at.desc()
        )

        total: int = query.count()
        transactions = query.limit(per_page).offset((page - 1) * per_page).all()

        return {
            'transactions': transactions,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }

    def create_transaction(
        self,
        description: str,
        amount: float,
        trans_type: str,
        date: str,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Transaction:
        """
        Create a new transaction.

        Args:
            description: Transaction description
            amount: Transaction amount
            trans_type: Type ('income' or 'expense')
            date: Transaction date (YYYY-MM-DD)
            category: Category name (optional)
            tags: List of tag names (optional)

        Returns:
            Created Transaction object
        """
        transaction = Transaction(
            description=description,
            amount=amount,
            type=trans_type,
            date=date
        )

        # Add category tag
        if category:
            category_tag = self._get_or_create_tag(f'category:{category}')
            transaction.tags.append(category_tag)

        # Add additional tags
        if tags:
            tag_names = [
                t.strip()
                for t in tags
                if t.strip() and not t.strip().startswith('category:')
            ]
            for tag_name in tag_names:
                tag = self._get_or_create_tag(tag_name)
                if tag not in transaction.tags:
                    transaction.tags.append(tag)

        self.db.add(transaction)
        self.db.commit()

        return transaction

    def update_transaction(
        self,
        transaction_id: int,
        description: str,
        amount: float,
        trans_type: str,
        date: str,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Update an existing transaction.

        Args:
            transaction_id: ID of transaction to update
            description: New description
            amount: New amount
            trans_type: New type
            date: New date
            category: New category (optional)
            tags: New tags (optional)

        Returns:
            Tuple of (success, error_message)
        """
        transaction = self.db.query(Transaction).filter(
            Transaction.id == transaction_id
        ).first()

        if not transaction:
            return False, "Transaction not found"

        # Update basic fields
        transaction.description = description
        transaction.amount = amount
        transaction.type = trans_type
        transaction.date = date

        # Clear existing tags
        transaction.tags = []

        # Add category tag
        if category:
            category_tag = self._get_or_create_tag(f'category:{category}')
            transaction.tags.append(category_tag)

        # Add additional tags
        if tags:
            tag_names = [
                t.strip()
                for t in tags
                if t.strip() and not t.strip().startswith('category:')
            ]
            for tag_name in tag_names:
                tag = self._get_or_create_tag(tag_name)
                if tag not in transaction.tags:
                    transaction.tags.append(tag)

        self.db.commit()
        return True, None

    def delete_transaction(self, transaction_id: int) -> bool:
        """
        Delete a transaction by ID.

        Args:
            transaction_id: ID of transaction to delete

        Returns:
            True if deleted, False if not found
        """
        transaction = self.db.query(Transaction).filter(
            Transaction.id == transaction_id
        ).first()
        if transaction:
            self.db.delete(transaction)
            self.db.commit()
            return True
        return False

    def _get_or_create_tag(self, tag_name: str) -> Tag:
        """
        Get existing tag or create new one.

        Args:
            tag_name: Name of tag

        Returns:
            Tag object
        """
        tag = self.db.query(Tag).filter_by(name=tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            self.db.add(tag)
            self.db.flush()
        return tag


class StatsService:
    """Service class for statistics and reporting."""

    def __init__(self, db_session: Session, database_type: str) -> None:
        """
        Initialize StatsService.

        Args:
            db_session: SQLAlchemy database session
            database_type: Database type ('sqlite', 'postgresql', 'mysql')
        """
        self.db = db_session
        self.database_type = database_type

    def _get_date_filter(
        self,
        time_range: Optional[str],
        start_date: Optional[str],
        end_date: Optional[str]
    ) -> str:
        """
        Generate date filter clause.

        Args:
            time_range: Time range identifier
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)

        Returns:
            SQL date filter string
        """
        if start_date and end_date:
            return f"date BETWEEN '{start_date}' AND '{end_date}'"
        if not time_range:
            return ""

        today = datetime.now().date()
        ranges = {
            'current_month': lambda: today.replace(day=1),
            '3_months': lambda: today - timedelta(days=90),
            '6_months': lambda: today - timedelta(days=180),
            '1_year': lambda: today - timedelta(days=365)
        }
        start = ranges.get(time_range, lambda: None)()
        return f"date >= '{start}'" if start else ""

    def get_summary_stats(
        self,
        category_filter: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        tag_filter: Optional[str] = None
    ) -> Dict[str, float]:
        """
        Get summary statistics with support for multiple categories and tags.

        Args:
            category_filter: Comma-separated category names
            time_range: Time range identifier
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            tag_filter: Comma-separated tag names

        Returns:
            Dict with income, expenses, and net balance
        """
        date_filter = self._get_date_filter(time_range, start_date, end_date)
        filters: List[str] = []
        params: Dict[str, str] = {}

        # Handle multiple categories - SANITIZED
        if category_filter:
            categories = [c.strip() for c in category_filter.split(',') if c.strip()]
            # Validate category names - only alphanumeric, hyphens, underscores
            categories = [c for c in categories if re.match(r'^[a-zA-Z0-9_-]+$', c)]
            if categories:
                category_placeholders = ", ".join([f":cat{i}" for i in range(len(categories))])
                filters.append(
                    f"id IN (SELECT transaction_id FROM transaction_tags tt "
                    f"JOIN tags t ON tt.tag_id = t.id WHERE t.name IN ({category_placeholders}))"
                )
                for i, cat in enumerate(categories):
                    params[f'cat{i}'] = f'category:{cat}'

        # Handle multiple tags - SANITIZED
        if tag_filter:
            tags = [t.strip() for t in tag_filter.split(',') if t.strip()]
            # Validate tag names - only alphanumeric, hyphens, underscores
            tags = [t for t in tags if re.match(r'^[a-zA-Z0-9_-]+$', t)]
            if tags:
                tag_placeholders = ", ".join([f":tag{i}" for i in range(len(tags))])
                filters.append(
                    f"id IN (SELECT transaction_id FROM transaction_tags tt "
                    f"JOIN tags t ON tt.tag_id = t.id WHERE t.name IN ({tag_placeholders}))"
                )
                for i, tag in enumerate(tags):
                    params[f'tag{i}'] = tag

        # Validate dates before using them
        if date_filter:
            if start_date and end_date:
                # Validate date format
                try:
                    datetime.strptime(start_date, '%Y-%m-%d')
                    datetime.strptime(end_date, '%Y-%m-%d')
                    filters.append("date BETWEEN :start_date AND :end_date")
                    params['start_date'] = start_date
                    params['end_date'] = end_date
                except ValueError:
                    pass  # Skip invalid dates
            elif time_range:
                # time_range is from a dropdown, so it's safe
                filters.append(date_filter)

        where_clause = "WHERE " + " AND ".join(filters) if filters else ""
        income_q = (
            f"SELECT COALESCE(SUM(amount), 0) FROM transactions "
            f"{where_clause}{' AND' if where_clause else ' WHERE'} type = 'income'"
        )
        expense_q = (
            f"SELECT COALESCE(SUM(amount), 0) FROM transactions "
            f"{where_clause}{' AND' if where_clause else ' WHERE'} type = 'expense'"
        )

        income: float = self.db.execute(text(income_q), params).scalar() or 0
        expenses: float = self.db.execute(text(expense_q), params).scalar() or 0

        return {
            'income': income,
            'expenses': expenses,
            'net': income - expenses
        }

    def get_category_breakdown(
        self,
        category_filter: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        tag_filter: Optional[str] = None
    ) -> List[Any]:
        """
        Get breakdown by category with tag filtering support.

        Args:
            category_filter: Comma-separated category names
            time_range: Time range identifier
            start_date: Start date
            end_date: End date
            tag_filter: Comma-separated tag names

        Returns:
            List of tuples (category, expenses, income)
        """
        if category_filter:
            return []

        date_filter = self._get_date_filter(time_range, start_date, end_date)

        filters: List[str] = []
        if date_filter:
            filters.append(date_filter)

        # Handle tag filtering
        if tag_filter:
            tags = [t.strip() for t in tag_filter.split(',') if t.strip()]
            if tags:
                tag_conditions = " OR ".join([f"t2.name = '{tag}'" for tag in tags])
                filters.append(
                    f"tr.id IN (SELECT transaction_id FROM transaction_tags tt2 "
                    f"JOIN tags t2 ON tt2.tag_id = t2.id WHERE {tag_conditions})"
                )

        where_clause = "AND " + " AND ".join(filters) if filters else ""

        query = (
            f"SELECT REPLACE(t.name, 'category:', '') as category, "
            f"SUM(CASE WHEN tr.type = 'expense' THEN tr.amount ELSE 0 END) as expenses, "
            f"SUM(CASE WHEN tr.type = 'income' THEN tr.amount ELSE 0 END) as income "
            f"FROM tags t JOIN transaction_tags tt ON t.id = tt.tag_id "
            f"JOIN transactions tr ON tt.transaction_id = tr.id "
            f"WHERE t.name LIKE 'category:%' {where_clause} "
            f"GROUP BY t.name ORDER BY expenses DESC"
        )

        queries = {
            'postgresql': query,
            'mysql': query,
            'sqlite': query
        }
        return self.db.execute(
            text(queries.get(self.database_type, queries['sqlite']))
        ).fetchall()

    def get_monthly_data(
        self,
        category_filter: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 12,
        tag_filter: Optional[str] = None
    ) -> List[Any]:
        """
        Get monthly breakdown with support for multiple categories and tags.

        Args:
            category_filter: Comma-separated category names
            time_range: Time range identifier
            start_date: Start date
            end_date: End date
            limit: Maximum number of months to return
            tag_filter: Comma-separated tag names

        Returns:
            List of tuples (month, expenses, income)
        """
        date_filter = self._get_date_filter(time_range, start_date, end_date)
        filters: List[str] = []

        # Handle multiple categories
        if category_filter:
            categories = [c.strip() for c in category_filter.split(',') if c.strip()]
            if categories:
                category_conditions = " OR ".join(
                    [f"t.name = 'category:{cat}'" for cat in categories]
                )
                filters.append(
                    f"id IN (SELECT transaction_id FROM transaction_tags tt "
                    f"JOIN tags t ON tt.tag_id = t.id WHERE {category_conditions})"
                )

        # Handle multiple tags
        if tag_filter:
            tags = [t.strip() for t in tag_filter.split(',') if t.strip()]
            if tags:
                tag_conditions = " OR ".join([f"t.name = '{tag}'" for tag in tags])
                filters.append(
                    f"id IN (SELECT transaction_id FROM transaction_tags tt "
                    f"JOIN tags t ON tt.tag_id = t.id WHERE {tag_conditions})"
                )

        if date_filter:
            filters.append(date_filter)

        filter_clause = "WHERE " + " AND ".join(filters) if filters else ""

        queries = {
            'postgresql': (
                f"SELECT TO_CHAR(date::date, 'YYYY-MM') as month, "
                f"SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses, "
                f"SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income "
                f"FROM transactions {filter_clause} "
                f"GROUP BY TO_CHAR(date::date, 'YYYY-MM') "
                f"ORDER BY month DESC LIMIT {limit}"
            ),
            'mysql': (
                f"SELECT DATE_FORMAT(STR_TO_DATE(date, '%Y-%m-%d'), '%Y-%m') as month, "
                f"SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses, "
                f"SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income "
                f"FROM transactions {filter_clause} "
                f"GROUP BY DATE_FORMAT(STR_TO_DATE(date, '%Y-%m-%d'), '%Y-%m') "
                f"ORDER BY month DESC LIMIT {limit}"
            ),
            'sqlite': (
                f"SELECT strftime('%Y-%m', date) as month, "
                f"SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses, "
                f"SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income "
                f"FROM transactions {filter_clause} "
                f"GROUP BY strftime('%Y-%m', date) "
                f"ORDER BY month DESC LIMIT {limit}"
            )
        }
        return self.db.execute(
            text(queries.get(self.database_type, queries['sqlite']))
        ).fetchall()

    def count_months(
        self,
        category_filter: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        tag_filter: Optional[str] = None
    ) -> int:
        """
        Count total months with support for multiple categories and tags.

        Args:
            category_filter: Comma-separated category names
            time_range: Time range identifier
            start_date: Start date
            end_date: End date
            tag_filter: Comma-separated tag names

        Returns:
            Number of distinct months
        """
        date_filter = self._get_date_filter(time_range, start_date, end_date)
        filters: List[str] = []

        # Handle multiple categories
        if category_filter:
            categories = [c.strip() for c in category_filter.split(',') if c.strip()]
            if categories:
                category_conditions = " OR ".join(
                    [f"t.name = 'category:{cat}'" for cat in categories]
                )
                filters.append(
                    f"id IN (SELECT transaction_id FROM transaction_tags tt "
                    f"JOIN tags t ON tt.tag_id = t.id WHERE {category_conditions})"
                )

        # Handle multiple tags
        if tag_filter:
            tags = [t.strip() for t in tag_filter.split(',') if t.strip()]
            if tags:
                tag_conditions = " OR ".join([f"t.name = '{tag}'" for tag in tags])
                filters.append(
                    f"id IN (SELECT transaction_id FROM transaction_tags tt "
                    f"JOIN tags t ON tt.tag_id = t.id WHERE {tag_conditions})"
                )

        if date_filter:
            filters.append(date_filter)

        filter_clause = "WHERE " + " AND ".join(filters) if filters else ""

        queries = {
            'postgresql': (
                f"SELECT COUNT(DISTINCT TO_CHAR(date::date, 'YYYY-MM')) "
                f"FROM transactions {filter_clause}"
            ),
            'mysql': (
                f"SELECT COUNT(DISTINCT DATE_FORMAT(STR_TO_DATE(date, '%Y-%m-%d'), '%Y-%m')) "
                f"FROM transactions {filter_clause}"
            ),
            'sqlite': (
                f"SELECT COUNT(DISTINCT strftime('%Y-%m', date)) "
                f"FROM transactions {filter_clause}"
            )
        }
        return self.db.execute(
            text(queries.get(self.database_type, queries['sqlite']))
        ).scalar() or 0


class CategoryService:
    """Service class for category operations."""

    def __init__(self, db_session: Session) -> None:
        """
        Initialize CategoryService.

        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session

    def get_all_categories(self) -> List[Dict[str, str]]:
        """
        Get all categories.

        Returns:
            List of dicts with category names
        """
        categories = self.db.query(Tag).filter(Tag.name.like('category:%')).all()
        return [{
            'name': cat.name.replace('category:', ''),
            'full_name': cat.name
        } for cat in categories]

    def get_all_tags(self) -> List[str]:
        """
        Get all non-category tags.

        Returns:
            List of tag names
        """
        tags = self.db.query(Tag).filter(~Tag.name.like('category:%')).all()
        return [tag.name for tag in tags]

    def create_category(self, category_name: str) -> Tuple[Optional[Tag], Optional[str]]:
        """
        Create a new category.

        Args:
            category_name: Name of category to create

        Returns:
            Tuple of (Tag object or None, error message or None)
        """
        tag_name = f'category:{category_name}'
        existing = self.db.query(Tag).filter_by(name=tag_name).first()

        if existing:
            return None, 'Category already exists'

        tag = Tag(name=tag_name)
        self.db.add(tag)
        self.db.commit()

        return tag, None

    def update_category(self, old_name: str, new_name: str) -> Tuple[bool, Optional[str]]:
        """
        Update a category name.

        Args:
            old_name: Current category name
            new_name: New category name

        Returns:
            Tuple of (success, error message)
        """
        old_tag_name = f'category:{old_name}'
        new_tag_name = f'category:{new_name}'

        # Check if new name already exists
        existing = self.db.query(Tag).filter_by(name=new_tag_name).first()
        if existing:
            return False, 'Category with new name already exists'

        # Find and update the tag
        tag = self.db.query(Tag).filter_by(name=old_tag_name).first()
        if not tag:
            return False, 'Category not found'

        tag.name = new_tag_name
        self.db.commit()

        return True, None

    def delete_category(self, category_name: str) -> Tuple[bool, Optional[str]]:
        """
        Delete a category.

        Args:
            category_name: Name of category to delete

        Returns:
            Tuple of (success, error message)
        """
        tag_name = f'category:{category_name}'
        tag = self.db.query(Tag).filter_by(name=tag_name).first()

        if not tag:
            return False, 'Category not found'

        self.db.delete(tag)
        self.db.commit()

        return True, None


class TestDataService:
    """Service class for generating test data."""

    def __init__(self, db_session: Session) -> None:
        """
        Initialize TestDataService.

        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session

    def populate_test_data(self) -> Tuple[Optional[int], Optional[str]]:
        """
        Populate database with test data.

        Returns:
            Tuple of (number of transactions added, error message)
        """
        # Check if there are already transactions
        count: int = self.db.query(Transaction).count()
        if count > 0:
            return None, 'Database already contains data'

        categories_data: Dict[str, List[str]] = {
            'food': ['Grocery store', 'Restaurant', 'Coffee shop', 'Fast food'],
            'transport': ['Gas station', 'Uber', 'Public transit', 'Parking'],
            'entertainment': ['Movie tickets', 'Streaming service', 'Concert', 'Books'],
            'utilities': ['Electric bill', 'Internet', 'Water bill', 'Phone bill'],
            'shopping': ['Clothing', 'Electronics', 'Home goods', 'Gift'],
            'healthcare': ['Pharmacy', 'Doctor visit', 'Gym membership', 'Vitamins'],
            'salary': ['Monthly salary', 'Bonus', 'Commission']
        }

        tags_list: List[str] = ['recurring', 'one-time', 'urgent', 'planned', 'subscription']

        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)

        added_count: int = 0

        # Add expenses
        for _ in range(70):
            category = random.choice(list(categories_data.keys())[:6])
            description = random.choice(categories_data[category])
            amount = round(random.uniform(5, 300), 2)
            random_days = random.randint(0, 90)
            trans_date = (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d')

            transaction = Transaction(
                description=description,
                amount=amount,
                type='expense',
                date=trans_date
            )

            # Add category tag
            category_tag_name = f'category:{category}'
            tag = self.db.query(Tag).filter_by(name=category_tag_name).first()
            if tag:
                transaction.tags.append(tag)

            # Randomly add additional tags
            if random.random() > 0.5:
                random_tag = random.choice(tags_list)
                tag = self.db.query(Tag).filter_by(name=random_tag).first()
                if not tag:
                    tag = Tag(name=random_tag)
                    self.db.add(tag)
                    self.db.flush()
                transaction.tags.append(tag)

            self.db.add(transaction)
            added_count += 1

        # Add income
        for _ in range(10):
            category = random.choice(['salary', 'freelance'])
            description = random.choice(categories_data[category])
            amount = round(random.uniform(500, 5000), 2)
            random_days = random.randint(0, 90)
            trans_date = (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d')

            transaction = Transaction(
                description=description,
                amount=amount,
                type='income',
                date=trans_date
            )

            # Add category tag
            category_tag_name = f'category:{category}'
            tag = self.db.query(Tag).filter_by(name=category_tag_name).first()
            if tag:
                transaction.tags.append(tag)

            self.db.add(transaction)
            added_count += 1

        self.db.commit()

        return added_count, None

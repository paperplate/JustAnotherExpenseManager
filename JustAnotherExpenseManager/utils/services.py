"""
Service layer for transaction operations.

This version requires proper types:
- TransactionType enum (not strings)
- Float amounts (converted to cents internally by model)
"""

import random
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
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
        """
        Create a new transaction.

        Args:
            description: Transaction description
            amount_dollars: Amount in dollars
            type: TransactionType enum (INCOME or EXPENSE)
            date: Date in YYYY-MM-DD format
            category: Category name (without 'category:' prefix)
            tags: List of tag names

        Returns:
            Transaction ID
        """
        transaction = Transaction(
            description=description,
            amount_dollars=amount_dollars,
            type=type,
            date=date
        )

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

        self.db.add(transaction)
        self.db.commit()

        return transaction.id

    def get_all_transactions(
        self,
        page: int = 1,
        per_page: int = 50,
        categories: Optional[str] = None,
        tags: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get paginated list of transactions with filtering.

        Args:
            page: Page number (1-indexed)
            per_page: Number of transactions per page
            categories: Comma-separated category names to filter
            tags: Comma-separated tag names to filter
            time_range: Time range identifier
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)

        Returns:
            Dict containing transactions list, total count, and pagination info
        """
        query = self.db.query(Transaction)

        # Apply date range filtering
        if start_date and end_date:
            try:
                datetime.strptime(start_date, '%Y-%m-%d')
                datetime.strptime(end_date, '%Y-%m-%d')
                query = query.filter(and_(
                    Transaction.date >= start_date,
                    Transaction.date <= end_date
                ))
            except ValueError:
                pass
        elif time_range:
            today = datetime.now().date()
            ranges = {
                'current_month': lambda: today.replace(day=1),
                '3_months': lambda: today - timedelta(days=90),
                '6_months': lambda: today - timedelta(days=180),
                'current_year': lambda: today.replace(month=1, day=1),
            }
            if time_range in ranges:
                start = ranges[time_range]().strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)

        # Apply category filter
        if categories:
            category_list = [f'category:{c.strip()}' for c in categories.split(',') if c.strip()]
            if category_list:
                query = query.join(Transaction.tags).filter(Tag.name.in_(category_list))

        # Apply tag filter
        if tags:
            tag_list = [t.strip() for t in tags.split(',') if t.strip()]
            if tag_list:
                query = query.join(Transaction.tags).filter(Tag.name.in_(tag_list))

        # Get total count
        total = query.count()

        # Apply pagination
        query = query.order_by(Transaction.date.desc(), Transaction.id.desc())
        transactions = query.offset((page - 1) * per_page).limit(per_page).all()

        # Calculate pagination
        total_pages = (total + per_page - 1) // per_page if total > 0 else 1

        return {
            'transactions': transactions,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
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
        """
        Update an existing transaction.

        Args:
            transaction_id: ID of transaction to update
            description: New description
            amount_dollars: New amount in dollars
            type: TransactionType enum
            date: New date
            category: New category (optional)
            tags: New tags (optional)

        Returns:
            True if successful

        Raises:
            ValueError: If transaction not found
        """
        transaction = self.db.query(Transaction).filter(
            Transaction.id == transaction_id
        ).first()

        if not transaction:
            raise ValueError("Transaction not found")

        # Update fields
        transaction.description = description
        transaction.amount_dollars = amount_dollars
        transaction.type = type
        transaction.date = date

        # Clear and update tags
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
        """
        Delete a transaction.

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

    def __init__(self, db_session: Session) -> None:
        """
        Initialize StatsService.

        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session

    def get_summary_stats(
        self,
        categories: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        tags: Optional[str] = None
    ) -> Dict[str, float]:
        """
        Get summary statistics (income, expenses, net).

        Returns amounts in dollars.

        Args:
            categories: Comma-separated category names
            time_range: Time range identifier
            start_date: Start date
            end_date: End date
            tags: Comma-separated tag names

        Returns:
            Dict with 'income', 'expenses', and 'net' in dollars
        """
        # Build base query with filters
        income_query = self._build_filtered_query(categories, time_range, start_date, end_date, tags)
        income_query = income_query.filter(Transaction.type == TransactionType.INCOME)

        expense_query = self._build_filtered_query(categories, time_range, start_date, end_date, tags)
        expense_query = expense_query.filter(Transaction.type == TransactionType.EXPENSE)

        # Get income total (in cents) - use the query directly, not a subquery
        income_cents = income_query.with_entities(func.sum(Transaction.amount_cents)).scalar() or 0

        # Get expense total (in cents) - use the query directly, not a subquery
        expense_cents = expense_query.with_entities(func.sum(Transaction.amount_cents)).scalar() or 0

        # Convert to dollars
        income = income_cents / 100.0
        expenses = expense_cents / 100.0

        return {
            'income': income,
            'expenses': expenses,
            'net': income - expenses
        }

    def get_category_breakdown(
        self,
        categories: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        tags: Optional[str] = None
    ) -> List[Tuple[str, float, float]]:
        """
        Get breakdown by category.

        Returns amounts in dollars.

        Returns:
            List of tuples: (category_name, expenses_dollars, income_dollars)
        """
        # Get all category tags
        category_tags = self.db.query(Tag).filter(Tag.name.like('category:%')).all()

        results = []
        for cat_tag in category_tags:
            category_name = cat_tag.category_name

            # Build filtered query for this category
            base_query = self._build_filtered_query(
                categories, time_range, start_date, end_date, tags
            )
            
            # Add category filter
            category_query = base_query.join(Transaction.tags).filter(
                Tag.name == cat_tag.name
            )

            # Get expenses (in cents) - use query directly
            expense_cents = category_query.filter(
                Transaction.type == TransactionType.EXPENSE
            ).with_entities(func.sum(Transaction.amount_cents)).scalar() or 0

            # Get income (in cents) - rebuild query to avoid reuse
            category_query_income = self._build_filtered_query(
                categories, time_range, start_date, end_date, tags
            ).join(Transaction.tags).filter(Tag.name == cat_tag.name)
            
            income_cents = category_query_income.filter(
                Transaction.type == TransactionType.INCOME
            ).with_entities(func.sum(Transaction.amount_cents)).scalar() or 0

            # Convert to dollars
            expenses = expense_cents / 100.0
            income = income_cents / 100.0

            if expenses > 0 or income > 0:
                results.append((category_name, expenses, income))

        # Sort by total amount descending
        results.sort(key=lambda x: x[1] + x[2], reverse=True)
        return results

    def get_monthly_data(
        self,
        categories: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 12,
        tag_filter: Optional[str] = None
    ) -> List[Tuple[str, float, float]]:
        """
        Get monthly income and expense data.

        Returns:
            List of tuples: (month_str, expenses_dollars, income_dollars)
        """
        query = self._build_filtered_query(categories, time_range, start_date, end_date, tag_filter)

        transactions = query.order_by(Transaction.date.desc()).all()

        # Group by month
        monthly_data = {}
        for trans in transactions:
            month_key = trans.date[:7]  # YYYY-MM
            if month_key not in monthly_data:
                monthly_data[month_key] = {'income': 0, 'expenses': 0}

            if trans.is_income:
                monthly_data[month_key]['income'] += trans.amount_dollars
            else:
                monthly_data[month_key]['expenses'] += trans.amount_dollars

        # Convert to list and sort
        results = [
            (month, data['expenses'], data['income'])
            for month, data in sorted(monthly_data.items(), reverse=True)
        ]

        return results[:limit]

    def count_months(
        self,
        categories: Optional[str] = None,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        tags: Optional[str] = None
    ) -> int:
        """Count unique months with transactions."""
        query = self._build_filtered_query(categories, time_range, start_date, end_date, tags)
        transactions = query.all()

        unique_months = set(trans.date[:7] for trans in transactions)
        return len(unique_months)

    def _build_filtered_query(
        self,
        categories: Optional[str],
        time_range: Optional[str],
        start_date: Optional[str],
        end_date: Optional[str],
        tags: Optional[str]
    ):
        """Build a query with common filters applied."""
        query = self.db.query(Transaction)

        # Date range
        if start_date and end_date:
            try:
                datetime.strptime(start_date, '%Y-%m-%d')
                datetime.strptime(end_date, '%Y-%m-%d')
                query = query.filter(and_(
                    Transaction.date >= start_date,
                    Transaction.date <= end_date
                ))
            except ValueError:
                pass
        elif time_range:
            today = datetime.now().date()
            ranges = {
                'current_month': lambda: today.replace(day=1),
                '3_months': lambda: today - timedelta(days=90),
                '6_months': lambda: today - timedelta(days=180),
                'current_year': lambda: today.replace(month=1, day=1),
            }
            if time_range in ranges:
                start = ranges[time_range]().strftime('%Y-%m-%d')
                query = query.filter(Transaction.date >= start)

        # Category filter
        if categories:
            category_list = [f'category:{c.strip()}' for c in categories.split(',') if c.strip()]
            if category_list:
                query = query.join(Transaction.tags).filter(Tag.name.in_(category_list))

        # Tag filter
        if tags:
            tag_list = [t.strip() for t in tags.split(',') if t.strip()]
            if tag_list:
                query = query.join(Transaction.tags).filter(Tag.name.in_(tag_list))

        return query


class CategoryService:
    """Service class for category operations."""

    def __init__(self, db_session: Session) -> None:
        """
        Initialize CategoryService.

        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session

    def get_all_categories(self) -> List[Dict[str, Any]]:
        """Get all categories."""
        categories = self.db.query(Tag).filter(Tag.name.like('category:%')).all()
        return [cat.to_dict() for cat in categories]

    def get_all_tags(self) -> List[str]:
        """Get all non-category tags."""
        tags = self.db.query(Tag).filter(~Tag.name.like('category:%')).all()
        return [tag.name for tag in tags]

    def create_category(self, category_name: str) -> Tuple[Optional[Tag], Optional[str]]:
        """Create a new category."""
        tag_name = f'category:{category_name}'
        existing = self.db.query(Tag).filter_by(name=tag_name).first()

        if existing:
            return None, 'Category already exists'

        tag = Tag(name=tag_name)
        self.db.add(tag)
        self.db.commit()

        return tag, None

    def update_category(self, old_name: str, new_name: str) -> Tuple[bool, Optional[str]]:
        """Update a category name."""
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
        """Delete a category."""
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
        """Initialize TestDataService."""
        self.db = db_session

    def populate_test_data(self) -> Tuple[int, Optional[str]]:
        """
        Generate test transactions.

        Returns:
            Tuple of (count, error_message)
        """
        try:
            # Sample data for generating realistic transactions
            expense_descriptions = [
                ("Grocery Store", "food", 50, 150),
                ("Gas Station", "transport", 30, 80),
                ("Restaurant", "food", 20, 100),
                ("Coffee Shop", "food", 3, 15),
                ("Electric Bill", "utilities", 80, 150),
                ("Internet Bill", "utilities", 50, 100),
                ("Movie Theater", "entertainment", 15, 50),
                ("Pharmacy", "healthcare", 10, 80),
                ("Clothing Store", "shopping", 30, 200),
                ("Uber", "transport", 10, 40),
                ("Gym Membership", "healthcare", 30, 100),
                ("Book Store", "entertainment", 10, 50),
            ]

            income_descriptions = [
                ("Monthly Salary", "salary", 3000, 6000),
                ("Freelance Project", "freelance", 500, 2000),
                ("Investment Return", "investment", 100, 500),
            ]

            # Generate transactions for last 90 days
            today = datetime.now().date()
            transaction_count = 0

            for days_ago in range(90):
                date = (today - timedelta(days=days_ago)).strftime('%Y-%m-%d')

                # Generate 0-3 random expenses per day
                num_expenses = random.randint(0, 3)
                for _ in range(num_expenses):
                    desc, category, min_amt, max_amt = random.choice(expense_descriptions)
                    amount = round(random.uniform(min_amt, max_amt), 2)

                    transaction = Transaction(
                        description=desc,
                        amount_dollars=amount,
                        type=TransactionType.EXPENSE,
                        date=date
                    )

                    # Add category
                    category_tag = self._get_or_create_tag(f'category:{category}')
                    transaction.add_tag(category_tag)

                    self.db.add(transaction)
                    transaction_count += 1

                # Generate income (less frequent)
                if random.random() < 0.1:  # 10% chance per day
                    desc, category, min_amt, max_amt = random.choice(income_descriptions)
                    amount = round(random.uniform(min_amt, max_amt), 2)

                    transaction = Transaction(
                        description=desc,
                        amount_dollars=amount,
                        type=TransactionType.INCOME,
                        date=date
                    )

                    # Add category
                    category_tag = self._get_or_create_tag(f'category:{category}')
                    transaction.add_tag(category_tag)

                    # Maybe add a tag
                    if random.random() < 0.3:
                        tag = self._get_or_create_tag('recurring')
                        transaction.add_tag(tag)

                    self.db.add(transaction)
                    transaction_count += 1

            self.db.commit()
            return transaction_count, None

        except Exception as e:
            self.db.rollback()
            return 0, str(e)

    def _get_or_create_tag(self, tag_name: str) -> Tag:
        """Get existing tag or create new one."""
        tag = self.db.query(Tag).filter_by(name=tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            self.db.add(tag)
            self.db.flush()
        return tag

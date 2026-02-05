"""
Business logic for transaction operations.
"""

from datetime import datetime, timedelta
import random
from models import Transaction, Tag
from sqlalchemy import func


class TransactionService:
    """Service class for transaction-related operations."""

    def __init__(self, db_session):
        self.db = db_session

    def get_all_transactions(self, page=1, per_page=50):
        """Get paginated list of transactions."""
        query = self.db.query(Transaction).order_by(
            Transaction.date.desc(), 
            Transaction.created_at.desc()
        )

        total = query.count()
        transactions = query.limit(per_page).offset((page - 1) * per_page).all()

        return {
            'transactions': transactions,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }

    def create_transaction(self, description, amount, trans_type, date, category=None, tags=None):
        """Create a new transaction."""
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
            tag_names = [t.strip() for t in tags if t.strip() and not t.strip().startswith('category:')]
            for tag_name in tag_names:
                tag = self._get_or_create_tag(tag_name)
                if tag not in transaction.tags:
                    transaction.tags.append(tag)

        self.db.add(transaction)
        self.db.commit()

        return transaction

    def delete_transaction(self, transaction_id):
        """Delete a transaction by ID."""
        transaction = self.db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if transaction:
            self.db.delete(transaction)
            self.db.commit()
            return True
        return False

    def _get_or_create_tag(self, tag_name):
        """Get existing tag or create new one."""
        tag = self.db.query(Tag).filter_by(name=tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            self.db.add(tag)
            self.db.flush()
        return tag


class StatsService:
    """Service class for statistics and reporting."""

    def __init__(self, db_session, database_type):
        self.db = db_session
        self.database_type = database_type

    def _get_date_filter(self, time_range, start_date, end_date):
        """Generate date filter clause."""
        from datetime import datetime, timedelta
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

    def get_summary_stats(self, category_filter=None, time_range=None, start_date=None, end_date=None):
        """Get summary statistics."""
        from sqlalchemy import text
        date_filter = self._get_date_filter(time_range, start_date, end_date)
        filters = []
        if category_filter:
            filters.append(f"id IN (SELECT transaction_id FROM transaction_tags tt JOIN tags t ON tt.tag_id = t.id WHERE t.name = 'category:{category_filter}')")
        if date_filter:
            filters.append(date_filter)
        where_clause = "WHERE " + " AND ".join(filters) if filters else ""
        income_q = f"SELECT COALESCE(SUM(amount), 0) FROM transactions {where_clause}{' AND' if where_clause else ' WHERE'} type = 'income'"
        expense_q = f"SELECT COALESCE(SUM(amount), 0) FROM transactions {where_clause}{' AND' if where_clause else ' WHERE'} type = 'expense'"
        return {'income': self.db.execute(text(income_q)).scalar() or 0, 'expenses': self.db.execute(text(expense_q)).scalar() or 0, 'net': (self.db.execute(text(income_q)).scalar() or 0) - (self.db.execute(text(expense_q)).scalar() or 0)}

    def get_category_breakdown(self, category_filter=None, time_range=None, start_date=None, end_date=None):
        """Get breakdown by category."""
        if category_filter:
            return []
        from sqlalchemy import text
        date_filter = self._get_date_filter(time_range, start_date, end_date)
        where_clause = f"AND {date_filter}" if date_filter else ""
        queries = {
            'postgresql': f"SELECT REPLACE(t.name, 'category:', '') as category, SUM(CASE WHEN tr.type = 'expense' THEN tr.amount ELSE 0 END) as expenses, SUM(CASE WHEN tr.type = 'income' THEN tr.amount ELSE 0 END) as income FROM tags t JOIN transaction_tags tt ON t.id = tt.tag_id JOIN transactions tr ON tt.transaction_id = tr.id WHERE t.name LIKE 'category:%' {where_clause} GROUP BY t.name ORDER BY expenses DESC",
            'mysql': f"SELECT REPLACE(t.name, 'category:', '') as category, SUM(CASE WHEN tr.type = 'expense' THEN tr.amount ELSE 0 END) as expenses, SUM(CASE WHEN tr.type = 'income' THEN tr.amount ELSE 0 END) as income FROM tags t JOIN transaction_tags tt ON t.id = tt.tag_id JOIN transactions tr ON tt.transaction_id = tr.id WHERE t.name LIKE 'category:%' {where_clause} GROUP BY t.name ORDER BY expenses DESC",
            'sqlite': f"SELECT REPLACE(t.name, 'category:', '') as category, SUM(CASE WHEN tr.type = 'expense' THEN tr.amount ELSE 0 END) as expenses, SUM(CASE WHEN tr.type = 'income' THEN tr.amount ELSE 0 END) as income FROM tags t JOIN transaction_tags tt ON t.id = tt.tag_id JOIN transactions tr ON tt.transaction_id = tr.id WHERE t.name LIKE 'category:%' {where_clause} GROUP BY t.name ORDER BY expenses DESC"
        }
        return self.db.execute(text(queries.get(self.database_type, queries['sqlite']))).fetchall()

    def get_monthly_data(self, category_filter=None, time_range=None, start_date=None, end_date=None, limit=12):
        """Get monthly breakdown."""
        from sqlalchemy import text
        date_filter = self._get_date_filter(time_range, start_date, end_date)
        filters = []
        if category_filter:
            filters.append(f"id IN (SELECT transaction_id FROM transaction_tags tt JOIN tags t ON tt.tag_id = t.id WHERE t.name = 'category:{category_filter}')")
        if date_filter:
            filters.append(date_filter)
        filter_clause = "WHERE " + " AND ".join(filters) if filters else ""
        queries = {
            'postgresql': f"SELECT TO_CHAR(date::date, 'YYYY-MM') as month, SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses, SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income FROM transactions {filter_clause} GROUP BY TO_CHAR(date::date, 'YYYY-MM') ORDER BY month DESC LIMIT {limit}",
            'mysql': f"SELECT DATE_FORMAT(STR_TO_DATE(date, '%Y-%m-%d'), '%Y-%m') as month, SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses, SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income FROM transactions {filter_clause} GROUP BY DATE_FORMAT(STR_TO_DATE(date, '%Y-%m-%d'), '%Y-%m') ORDER BY month DESC LIMIT {limit}",
            'sqlite': f"SELECT strftime('%Y-%m', date) as month, SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses, SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income FROM transactions {filter_clause} GROUP BY strftime('%Y-%m', date) ORDER BY month DESC LIMIT {limit}"
        }
        return self.db.execute(text(queries.get(self.database_type, queries['sqlite']))).fetchall()

    def count_months(self, category_filter=None, time_range=None, start_date=None, end_date=None):
        """Count total months."""
        from sqlalchemy import text
        date_filter = self._get_date_filter(time_range, start_date, end_date)
        filters = []
        if category_filter:
            filters.append(f"id IN (SELECT transaction_id FROM transaction_tags tt JOIN tags t ON tt.tag_id = t.id WHERE t.name = 'category:{category_filter}')")
        if date_filter:
            filters.append(date_filter)
        filter_clause = "WHERE " + " AND ".join(filters) if filters else ""
        queries = {
            'postgresql': f"SELECT COUNT(DISTINCT TO_CHAR(date::date, 'YYYY-MM')) FROM transactions {filter_clause}",
            'mysql': f"SELECT COUNT(DISTINCT DATE_FORMAT(STR_TO_DATE(date, '%Y-%m-%d'), '%Y-%m')) FROM transactions {filter_clause}",
            'sqlite': f"SELECT COUNT(DISTINCT strftime('%Y-%m', date)) FROM transactions {filter_clause}"
        }
        return self.db.execute(text(queries.get(self.database_type, queries['sqlite']))).scalar() or 0

class CategoryService:
    """Service class for category operations."""

    def __init__(self, db_session):
        self.db = db_session

    def get_all_categories(self):
        """Get all categories."""
        categories = self.db.query(Tag).filter(Tag.name.like('category:%')).all()
        return [{
            'name': cat.name.replace('category:', ''),
            'full_name': cat.name
        } for cat in categories]

    def create_category(self, category_name):
        """Create a new category."""
        tag_name = f'category:{category_name}'
        existing = self.db.query(Tag).filter_by(name=tag_name).first()

        if existing:
            return None, 'Category already exists'

        tag = Tag(name=tag_name)
        self.db.add(tag)
        self.db.commit()

        return tag, None


class TestDataService:
    """Service class for generating test data."""

    def __init__(self, db_session):
        self.db = db_session

    def populate_test_data(self):
        """Populate database with test data."""
        # Check if there are already transactions
        count = self.db.query(Transaction).count()
        if count > 0:
            return None, 'Database already contains data'

        categories_data = {
            'food': ['Grocery store', 'Restaurant', 'Coffee shop', 'Fast food'],
            'transport': ['Gas station', 'Uber', 'Public transit', 'Parking'],
            'entertainment': ['Movie tickets', 'Streaming service', 'Concert', 'Books'],
            'utilities': ['Electric bill', 'Internet', 'Water bill', 'Phone bill'],
            'shopping': ['Clothing', 'Electronics', 'Home goods', 'Gift'],
            'healthcare': ['Pharmacy', 'Doctor visit', 'Gym membership', 'Vitamins'],
            'salary': ['Monthly salary', 'Bonus', 'Commission']
        }

        tags_list = ['recurring', 'one-time', 'urgent', 'planned', 'subscription']

        end_date = datetime.now()
        start_date = end_date - timedelta(days=90)

        added_count = 0

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

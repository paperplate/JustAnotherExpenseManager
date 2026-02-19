"""
Test suite for service layer.
Tests business logic and database operations.
"""

import pytest
from datetime import datetime, timedelta
from JustAnotherExpenseManager.models import TransactionType
from JustAnotherExpenseManager.utils.services import TransactionService, StatsService


def _make_service(db):
    """Helper to create a TransactionService instance."""
    return TransactionService(db)


def _create(service, description, amount, trans_type, date, category=None, tags=None):
    """Helper wrapper with the correct API."""
    return service.create_transaction(
        description=description,
        amount_dollars=amount,
        type=TransactionType(trans_type),
        date=date,
        category=category,
        tags=tags or []
    )


class TestTransactionService:
    """Test TransactionService business logic."""

    def test_create_transaction_basic(self, app, db):
        """Test creating a basic transaction."""
        service = _make_service(db)

        trans_id = _create(service, 'Test Expense', 100.00, 'expense', '2026-02-01',
                           category='food', tags=['test'])

        assert trans_id is not None
        assert trans_id > 0

        result = service.get_all_transactions()
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Test Expense'

    def test_create_transaction_with_multiple_tags(self, app, db):
        """Test creating transaction with multiple tags."""
        service = _make_service(db)

        _create(service, 'Test', 50.00, 'expense', '2026-02-01',
                category='food', tags=['tag1', 'tag2', 'tag3'])

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        tag_names = [tag.name for tag in transaction.tags]

        assert 'tag1' in tag_names
        assert 'tag2' in tag_names
        assert 'tag3' in tag_names
        assert 'category:food' in tag_names

    def test_create_transaction_income(self, app, db):
        """Test creating an income transaction."""
        service = _make_service(db)

        _create(service, 'Salary', 5000.00, 'income', '2026-02-01',
                category='salary', tags=['recurring'])

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        assert transaction.type == TransactionType.INCOME
        assert transaction.amount_dollars == 5000.00

    def test_create_transaction_without_category(self, app, db):
        """Test creating transaction without category."""
        service = _make_service(db)

        _create(service, 'Test', 50.00, 'expense', '2026-02-01',
                category=None, tags=[])

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        assert transaction.category is None

    def test_update_transaction_success(self, app, db):
        """Test updating an existing transaction."""
        service = _make_service(db)

        trans_id = _create(service, 'Original', 100.00, 'expense', '2026-02-01',
                           category='food', tags=['test'])

        result = service.update_transaction(
            transaction_id=trans_id,
            description='Updated',
            amount_dollars=200.00,
            type=TransactionType.EXPENSE,
            date='2026-02-02',
            category='transport',
            tags=['new-tag']
        )

        assert result is True

        transactions = service.get_all_transactions()
        transaction = transactions['transactions'][0]
        assert transaction.description == 'Updated'
        assert transaction.amount_dollars == 200.00

    def test_update_nonexistent_transaction(self, app, db):
        """Test updating a transaction that doesn't exist raises ValueError."""
        service = _make_service(db)

        with pytest.raises(ValueError):
            service.update_transaction(
                transaction_id=99999,
                description='Updated',
                amount_dollars=100.00,
                type=TransactionType.EXPENSE,
                date='2026-02-01',
                category='food',
                tags=[]
            )

    def test_delete_transaction_success(self, app, db):
        """Test deleting an existing transaction."""
        service = _make_service(db)

        trans_id = _create(service, 'To Delete', 100.00, 'expense', '2026-02-01',
                           category='food', tags=[])

        result = service.get_all_transactions()
        assert result['total'] == 1

        service.delete_transaction(trans_id)

        result = service.get_all_transactions()
        assert result['total'] == 0

    def test_delete_nonexistent_transaction(self, app, db):
        """Test deleting a transaction that doesn't exist returns False."""
        service = _make_service(db)

        result = service.delete_transaction(99999)
        assert result is False

        total = service.get_all_transactions()['total']
        assert total == 0

    def test_get_all_transactions_month_pagination(self, app, db):
        """Test transaction pagination by month (each page = one month)."""
        service = _make_service(db)

        # Create transactions across two months
        for i in range(3):
            _create(service, f'Jan {i}', 100.00, 'expense', '2026-01-01',
                    category='food', tags=[])
        for i in range(2):
            _create(service, f'Feb {i}', 100.00, 'expense', '2026-02-01',
                    category='food', tags=[])

        result = service.get_all_transactions()
        assert result['total'] == 5
        assert result['total_pages'] == 2

        # Page 1 = most recent month (Feb)
        page1 = service.get_all_transactions(page=1)
        assert len(page1['transactions']) == 2

        # Page 2 = earlier month (Jan)
        page2 = service.get_all_transactions(page=2)
        assert len(page2['transactions']) == 3

    def test_get_all_transactions_ordering(self, app, db):
        """Test that transactions are ordered by date descending."""
        service = _make_service(db)

        _create(service, 'Oldest', 100.00, 'expense', '2026-01-01', category='food')
        _create(service, 'Newest', 100.00, 'expense', '2026-03-01', category='food')
        _create(service, 'Middle', 100.00, 'expense', '2026-02-01', category='food')

        result = service.get_all_transactions()
        # get_all_transactions returns current page (most recent month)
        # Sort all month pages to verify newest is first
        all_transactions = []
        for page in range(1, result['total_pages'] + 1):
            all_transactions.extend(service.get_all_transactions(page=page)['transactions'])

        descriptions = [t.description for t in all_transactions]
        assert descriptions.index('Newest') < descriptions.index('Middle')
        assert descriptions.index('Middle') < descriptions.index('Oldest')

    def test_filter_by_category(self, app, db):
        """Test filtering transactions by category."""
        service = _make_service(db)

        _create(service, 'Food', 100.00, 'expense', '2026-02-01', category='food')
        _create(service, 'Transport', 50.00, 'expense', '2026-02-01', category='transport')

        result = service.get_all_transactions(categories='food')
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Food'

    def test_filter_by_multiple_categories(self, app, db):
        """Test filtering by multiple categories."""
        service = _make_service(db)

        _create(service, 'Food', 100.00, 'expense', '2026-02-01', category='food')
        _create(service, 'Transport', 50.00, 'expense', '2026-02-01', category='transport')
        _create(service, 'Entertainment', 75.00, 'expense', '2026-02-01', category='entertainment')

        result = service.get_all_transactions(categories='food,transport')
        assert result['total'] == 2

    def test_filter_by_tags(self, app, db):
        """Test filtering transactions by tags."""
        service = _make_service(db)

        _create(service, 'Recurring', 100.00, 'expense', '2026-02-01',
                category='food', tags=['recurring'])
        _create(service, 'One-time', 50.00, 'expense', '2026-02-01',
                category='food', tags=['one-time'])

        result = service.get_all_transactions(tags='recurring')
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Recurring'

    def test_filter_by_date_range(self, app, db):
        """Test filtering by custom date range."""
        service = _make_service(db)

        _create(service, 'January', 100.00, 'expense', '2026-01-15', category='food')
        _create(service, 'February', 100.00, 'expense', '2026-02-15', category='food')
        _create(service, 'March', 100.00, 'expense', '2026-03-15', category='food')

        result = service.get_all_transactions(
            start_date='2026-02-01',
            end_date='2026-02-28'
        )
        assert result['total'] == 1
        assert result['transactions'][0].description == 'February'

    def test_filter_date_range_combined_with_category(self, app, db):
        """Test combining date range filter with category filter."""
        service = _make_service(db)

        _create(service, 'Feb Food', 100.00, 'expense', '2026-02-15',
                category='food', tags=[])
        _create(service, 'Jan Food', 100.00, 'expense', '2026-01-15',
                category='food', tags=[])
        _create(service, 'Feb Transport', 50.00, 'expense', '2026-02-15',
                category='transport', tags=[])

        result = service.get_all_transactions(
            categories='food',
            start_date='2026-02-01',
            end_date='2026-02-28'
        )
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Feb Food'

    def test_filter_date_range_combined_with_tag(self, app, db):
        """Test combining date range filter with tag filter."""
        service = _make_service(db)

        _create(service, 'Recurring Feb', 100.00, 'expense', '2026-02-15',
                category='food', tags=['recurring'])
        _create(service, 'Recurring Jan', 100.00, 'expense', '2026-01-15',
                category='food', tags=['recurring'])
        _create(service, 'One-time Feb', 50.00, 'expense', '2026-02-15',
                category='food', tags=['one-time'])

        result = service.get_all_transactions(
            tags='recurring',
            start_date='2026-02-01',
            end_date='2026-02-28'
        )
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Recurring Feb'


class TestStatsService:
    """Test StatsService calculations."""

    def test_get_summary_stats_empty(self, app, db):
        """Test summary stats with no transactions."""
        service = StatsService(db)
        stats = service.get_summary_stats()

        assert stats['income'] == 0.0
        assert stats['expenses'] == 0.0
        assert stats['net'] == 0.0

    def test_get_summary_stats_with_data(self, app, db):
        """Test summary stats with transactions."""
        trans_service = TransactionService(db)
        stats_service = StatsService(db)

        _create(trans_service, 'Income', 1000.00, 'income', '2026-02-01', category='salary')
        _create(trans_service, 'Expense', 300.00, 'expense', '2026-02-01', category='food')

        stats = stats_service.get_summary_stats()

        assert stats['income'] == 1000.00
        assert stats['expenses'] == 300.00
        assert stats['net'] == 700.00

    def test_get_summary_stats_filtered(self, app, db):
        """Test summary stats filtered by category."""
        trans_service = TransactionService(db)
        stats_service = StatsService(db)

        _create(trans_service, 'Food', 200.00, 'expense', '2026-02-01', category='food')
        _create(trans_service, 'Transport', 100.00, 'expense', '2026-02-01', category='transport')

        stats = stats_service.get_summary_stats(categories='food')
        assert stats['expenses'] == 200.00

    def test_get_category_breakdown(self, app, db):
        """Test category breakdown calculation."""
        trans_service = TransactionService(db)
        stats_service = StatsService(db)

        _create(trans_service, 'Food 1', 150.00, 'expense', '2026-02-01', category='food')
        _create(trans_service, 'Food 2', 50.00, 'expense', '2026-02-01', category='food')
        _create(trans_service, 'Transport', 100.00, 'expense', '2026-02-01', category='transport')

        breakdown = stats_service.get_category_breakdown()

        food_stat = next((s for s in breakdown if s[0] == 'food'), None)
        assert food_stat is not None
        # breakdown returns (category_name, expenses, income)
        assert food_stat[1] == 200.00

    def test_get_monthly_data(self, app, db):
        """Test monthly trend data."""
        trans_service = TransactionService(db)
        stats_service = StatsService(db)

        _create(trans_service, 'January', 500.00, 'expense', '2026-01-15', category='food')
        _create(trans_service, 'February', 300.00, 'expense', '2026-02-15', category='food')

        monthly = stats_service.get_monthly_data()

        assert len(monthly) >= 2
        # Returns (month_str, expenses, income)
        months = [row[0] for row in monthly]
        assert '2026-01' in months
        assert '2026-02' in months


class TestTagManagement:
    """Test tag creation and management."""

    def test_category_tag_creation(self, app, db):
        """Test that category tags are automatically created."""
        service = _make_service(db)

        _create(service, 'Test', 100.00, 'expense', '2026-02-01', category='food', tags=[])

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        tag_names = [tag.name for tag in transaction.tags]

        assert 'category:food' in tag_names

    def test_duplicate_tags_handled(self, app, db):
        """Test that duplicate tags are deduplicated."""
        service = _make_service(db)

        _create(service, 'Test', 100.00, 'expense', '2026-02-01',
                category='food', tags=['test', 'test', 'duplicate', 'duplicate'])

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        non_cat_names = [tag.name for tag in transaction.tags if not tag.name.startswith('category:')]

        assert non_cat_names.count('test') == 1
        assert non_cat_names.count('duplicate') == 1

    def test_tag_reuse(self, app, db):
        """Test that existing tags are reused across transactions."""
        service = _make_service(db)

        _create(service, 'First', 100.00, 'expense', '2026-02-01',
                category='food', tags=['recurring'])
        _create(service, 'Second', 100.00, 'expense', '2026-02-01',
                category='food', tags=['recurring'])

        result = service.get_all_transactions()
        all_trans = result['transactions']

        tag1 = next(tag for tag in all_trans[0].tags if tag.name == 'recurring')
        tag2 = next(tag for tag in all_trans[1].tags if tag.name == 'recurring')

        assert tag1.id == tag2.id

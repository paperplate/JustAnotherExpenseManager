"""
Test suite for service layer.
Tests business logic and database operations.
"""

import pytest
from datetime import datetime, timedelta
from JustAnotherExpenseManager.utils.services import TransactionService, StatsService


class TestTransactionService:
    """Test TransactionService business logic."""

    def test_create_transaction_basic(self, app, db):
        """Test creating a basic transaction."""
        service = TransactionService(db)

        trans_id = service.create_transaction(
            description='Test Expense',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=['test']
        )

        assert trans_id is not None
        assert trans_id > 0

        # Verify transaction was created
        result = service.get_all_transactions()
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Test Expense'

    def test_create_transaction_with_multiple_tags(self, app, db):
        """Test creating transaction with multiple tags."""
        service = TransactionService(db)

        trans_id = service.create_transaction(
            description='Test',
            amount=50.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=['tag1', 'tag2', 'tag3']
        )

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        tag_names = [tag.name for tag in transaction.tags]

        assert 'tag1' in tag_names
        assert 'tag2' in tag_names
        assert 'tag3' in tag_names
        assert f'category:food' in tag_names

    def test_create_transaction_income(self, app, db):
        """Test creating an income transaction."""
        service = TransactionService(db)

        trans_id = service.create_transaction(
            description='Salary',
            amount=5000.00,
            trans_type='income',
            date='2026-02-01',
            category='salary',
            tags=['recurring']
        )

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        assert transaction.type == 'income'
        assert transaction.amount == 5000.00

    def test_create_transaction_without_category(self, app, db):
        """Test creating transaction without category."""
        service = TransactionService(db)

        trans_id = service.create_transaction(
            description='Test',
            amount=50.00,
            trans_type='expense',
            date='2026-02-01',
            category=None,
            tags=[]
        )

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        assert transaction.category is None

    def test_update_transaction_success(self, app, db):
        """Test updating an existing transaction."""
        service = TransactionService(db)

        # Create transaction
        trans_id = service.create_transaction(
            description='Original',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=['test']
        )

        # Update transaction
        success, error = service.update_transaction(
            transaction_id=trans_id,
            description='Updated',
            amount=200.00,
            trans_type='expense',
            date='2026-02-02',
            category='transport',
            tags=['new-tag']
        )

        assert success is True
        assert error is None

        # Verify update
        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        assert transaction.description == 'Updated'
        assert transaction.amount == 200.00

    def test_update_nonexistent_transaction(self, app, db):
        """Test updating a transaction that doesn't exist."""
        service = TransactionService(db)

        success, error = service.update_transaction(
            transaction_id=99999,
            description='Updated',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )

        assert success is False
        assert error is not None

    def test_delete_transaction_success(self, app, db):
        """Test deleting an existing transaction."""
        service = TransactionService(db)

        # Create transaction
        trans_id = service.create_transaction(
            description='To Delete',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )

        # Verify it exists
        result = service.get_all_transactions()
        assert result['total'] == 1

        # Delete transaction
        service.delete_transaction(trans_id)

        # Verify it's gone
        result = service.get_all_transactions()
        assert result['total'] == 0

    def test_delete_nonexistent_transaction(self, app, db):
        """Test deleting a transaction that doesn't exist."""
        service = TransactionService(db)

        # Should not raise an error
        service.delete_transaction(99999)

        result = service.get_all_transactions()
        assert result['total'] == 0

    def test_get_all_transactions_pagination(self, app, db):
        """Test transaction pagination."""
        service = TransactionService(db)

        # Create multiple transactions
        for i in range(15):
            service.create_transaction(
                description=f'Transaction {i}',
                amount=100.00,
                trans_type='expense',
                date='2026-02-01',
                category='food',
                tags=[]
            )

        # Get first page
        result = service.get_all_transactions(page=1, per_page=10)
        assert result['total'] == 15
        assert len(result['transactions']) == 10
        assert result['total_pages'] == 2

        # Get second page
        result = service.get_all_transactions(page=2, per_page=10)
        assert len(result['transactions']) == 5

    def test_get_all_transactions_ordering(self, app, db):
        """Test that transactions are ordered by date descending."""
        service = TransactionService(db)

        # Create transactions with different dates
        service.create_transaction(
            description='Oldest',
            amount=100.00,
            trans_type='expense',
            date='2026-01-01',
            category='food',
            tags=[]
        )
        service.create_transaction(
            description='Newest',
            amount=100.00,
            trans_type='expense',
            date='2026-03-01',
            category='food',
            tags=[]
        )
        service.create_transaction(
            description='Middle',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )

        result = service.get_all_transactions()
        transactions = result['transactions']

        assert transactions[0].description == 'Newest'
        assert transactions[1].description == 'Middle'
        assert transactions[2].description == 'Oldest'

    def test_filter_by_category(self, app, db):
        """Test filtering transactions by category."""
        service = TransactionService(db)

        # Create transactions with different categories
        service.create_transaction(
            description='Food',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )
        service.create_transaction(
            description='Transport',
            amount=50.00,
            trans_type='expense',
            date='2026-02-01',
            category='transport',
            tags=[]
        )

        result = service.get_all_transactions(categories='food')
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Food'

    def test_filter_by_multiple_categories(self, app, db):
        """Test filtering by multiple categories."""
        service = TransactionService(db)

        # Create transactions
        service.create_transaction(
            description='Food',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )
        service.create_transaction(
            description='Transport',
            amount=50.00,
            trans_type='expense',
            date='2026-02-01',
            category='transport',
            tags=[]
        )
        service.create_transaction(
            description='Entertainment',
            amount=75.00,
            trans_type='expense',
            date='2026-02-01',
            category='entertainment',
            tags=[]
        )

        result = service.get_all_transactions(categories='food,transport')
        assert result['total'] == 2

    def test_filter_by_tags(self, app, db):
        """Test filtering transactions by tags."""
        service = TransactionService(db)

        # Create transactions with different tags
        service.create_transaction(
            description='Recurring',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=['recurring']
        )
        service.create_transaction(
            description='One-time',
            amount=50.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=['one-time']
        )

        result = service.get_all_transactions(tags='recurring')
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Recurring'

    def test_filter_by_date_range(self, app, db):
        """Test filtering by custom date range."""
        service = TransactionService(db)

        # Create transactions with different dates
        service.create_transaction(
            description='January',
            amount=100.00,
            trans_type='expense',
            date='2026-01-15',
            category='food',
            tags=[]
        )
        service.create_transaction(
            description='February',
            amount=100.00,
            trans_type='expense',
            date='2026-02-15',
            category='food',
            tags=[]
        )
        service.create_transaction(
            description='March',
            amount=100.00,
            trans_type='expense',
            date='2026-03-15',
            category='food',
            tags=[]
        )

        result = service.get_all_transactions(
            start_date='2026-02-01',
            end_date='2026-02-28'
        )
        assert result['total'] == 1
        assert result['transactions'][0].description == 'February'

    def test_filter_combined(self, app, db):
        """Test combining multiple filters."""
        service = TransactionService(db)

        # Create various transactions
        service.create_transaction(
            description='Match',
            amount=100.00,
            trans_type='expense',
            date='2026-02-15',
            category='food',
            tags=['recurring']
        )
        service.create_transaction(
            description='Wrong category',
            amount=100.00,
            trans_type='expense',
            date='2026-02-15',
            category='transport',
            tags=['recurring']
        )
        service.create_transaction(
            description='Wrong tag',
            amount=100.00,
            trans_type='expense',
            date='2026-02-15',
            category='food',
            tags=['one-time']
        )

        result = service.get_all_transactions(
            categories='food',
            tags='recurring',
            start_date='2026-02-01',
            end_date='2026-02-28'
        )
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Match'


class TestStatsService:
    """Test StatsService calculations."""

    def test_calculate_stats_empty(self, app, db):
        """Test calculating stats with no transactions."""
        service = StatsService(db)
        stats = service.calculate_stats()

        assert stats['total_income'] == 0.0
        assert stats['total_expenses'] == 0.0
        assert stats['net_balance'] == 0.0

    def test_calculate_stats_with_data(self, app, db):
        """Test calculating stats with transactions."""
        trans_service = TransactionService(db)
        stats_service = StatsService(db)

        # Create sample transactions
        trans_service.create_transaction(
            description='Income',
            amount=1000.00,
            trans_type='income',
            date='2026-02-01',
            category='salary',
            tags=[]
        )
        trans_service.create_transaction(
            description='Expense',
            amount=300.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )

        stats = stats_service.calculate_stats()

        assert stats['total_income'] == 1000.00
        assert stats['total_expenses'] == 300.00
        assert stats['net_balance'] == 700.00

    def test_calculate_stats_filtered(self, app, db):
        """Test calculating filtered stats."""
        trans_service = TransactionService(db)
        stats_service = StatsService(db)

        # Create transactions in different categories
        trans_service.create_transaction(
            description='Food',
            amount=200.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )
        trans_service.create_transaction(
            description='Transport',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='transport',
            tags=[]
        )

        stats = stats_service.calculate_stats(categories='food')

        assert stats['total_expenses'] == 200.00

    def test_category_breakdown(self, app, db):
        """Test category breakdown calculation."""
        trans_service = TransactionService(db)
        stats_service = StatsService(db)

        # Create transactions in different categories
        trans_service.create_transaction(
            description='Food 1',
            amount=150.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )
        trans_service.create_transaction(
            description='Food 2',
            amount=50.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )
        trans_service.create_transaction(
            description='Transport',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='transport',
            tags=[]
        )

        stats = stats_service.calculate_stats()

        # Find food category in breakdown
        food_stat = next((s for s in stats['category_breakdown'] if s['category'] == 'food'), None)
        assert food_stat is not None
        assert food_stat['amount'] == 200.00

    def test_monthly_trend(self, app, db):
        """Test monthly trend calculation."""
        trans_service = TransactionService(db)
        stats_service = StatsService(db)

        # Create transactions in different months
        trans_service.create_transaction(
            description='January',
            amount=500.00,
            trans_type='expense',
            date='2026-01-15',
            category='food',
            tags=[]
        )
        trans_service.create_transaction(
            description='February',
            amount=300.00,
            trans_type='expense',
            date='2026-02-15',
            category='food',
            tags=[]
        )

        stats = stats_service.calculate_stats()

        assert 'monthly_trend' in stats
        assert len(stats['monthly_trend']) >= 2


class TestTagManagement:
    """Test tag creation and management."""

    def test_category_tag_creation(self, app, db):
        """Test that category tags are automatically created."""
        service = TransactionService(db)

        service.create_transaction(
            description='Test',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=[]
        )

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        tag_names = [tag.name for tag in transaction.tags]

        assert 'category:food' in tag_names

    def test_duplicate_tags_handled(self, app, db):
        """Test that duplicate tags are not created."""
        service = TransactionService(db)

        # Create transaction with duplicate tags
        service.create_transaction(
            description='Test',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=['test', 'test', 'duplicate', 'duplicate']
        )

        result = service.get_all_transactions()
        transaction = result['transactions'][0]
        tag_names = [tag.name for tag in transaction.tags if not tag.name.startswith('category:')]

        # Should only have unique tags
        assert tag_names.count('test') == 1
        assert tag_names.count('duplicate') == 1

    def test_tag_reuse(self, app, db):
        """Test that existing tags are reused across transactions."""
        service = TransactionService(db)

        # Create two transactions with same tag
        service.create_transaction(
            description='First',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=['recurring']
        )
        service.create_transaction(
            description='Second',
            amount=100.00,
            trans_type='expense',
            date='2026-02-01',
            category='food',
            tags=['recurring']
        )

        # Both should use the same tag object
        result = service.get_all_transactions()
        tag1 = next(tag for tag in result['transactions'][0].tags if tag.name == 'recurring')
        tag2 = next(tag for tag in result['transactions'][1].tags if tag.name == 'recurring')

        assert tag1.id == tag2.id

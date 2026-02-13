"""
Test suite for database models.
Tests model creation, relationships, and constraints.
"""

import pytest
from datetime import datetime
from models import Transaction, Tag


class TestTransactionModel:
    """Test Transaction model."""

    def test_create_transaction(self, app, db):
        """Test creating a transaction instance."""
        transaction = Transaction(
            description='Test Transaction',
            amount=100.00,
            type='expense',
            date='2026-02-01',
            category='food'
        )

        db.add(transaction)
        db.commit()

        # Verify it was saved
        saved = db.query(Transaction).first()
        assert saved.description == 'Test Transaction'
        assert saved.amount == 100.00
        assert saved.type == 'expense'
        assert saved.category == 'food'

    def test_transaction_defaults(self, app, db):
        """Test transaction default values."""
        transaction = Transaction(
            description='Test',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )

        db.add(transaction)
        db.commit()

        saved = db.query(Transaction).first()
        assert saved.category is None
        assert saved.created_at is not None
        assert saved.updated_at is not None

    def test_transaction_repr(self, app, db):
        """Test transaction string representation."""
        transaction = Transaction(
            description='Test',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )

        db.add(transaction)
        db.commit()

        # Check that repr doesn't raise an error
        repr_str = repr(transaction)
        assert 'Transaction' in repr_str
        assert 'Test' in repr_str

    def test_transaction_amount_precision(self, app, db):
        """Test that amount is stored with correct precision."""
        transaction = Transaction(
            description='Test',
            amount=123.456789,
            type='expense',
            date='2026-02-01'
        )

        db.add(transaction)
        db.commit()

        saved = db.query(Transaction).first()
        # Should store to 2 decimal places
        assert saved.amount == pytest.approx(123.46, abs=0.01)


class TestTagModel:
    """Test Tag model."""

    def test_create_tag(self, app, db):
        """Test creating a tag instance."""
        tag = Tag(name='test-tag')

        db.add(tag)
        db.commit()

        saved = db.query(Tag).first()
        assert saved.name == 'test-tag'

    def test_tag_unique_constraint(self, app, db):
        """Test that tag names must be unique."""
        tag1 = Tag(name='duplicate')
        db.add(tag1)
        db.commit()

        # Try to create duplicate
        tag2 = Tag(name='duplicate')
        db.add(tag2)

        with pytest.raises(Exception):
            db.commit()

    def test_tag_repr(self, app, db):
        """Test tag string representation."""
        tag = Tag(name='test-tag')
        db.add(tag)
        db.commit()

        repr_str = repr(tag)
        assert 'Tag' in repr_str
        assert 'test-tag' in repr_str


class TestTransactionTagRelationship:
    """Test relationship between Transaction and Tag."""

    def test_add_tags_to_transaction(self, app, db):
        """Test adding tags to a transaction."""
        transaction = Transaction(
            description='Test',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )

        tag1 = Tag(name='tag1')
        tag2 = Tag(name='tag2')

        transaction.tags.append(tag1)
        transaction.tags.append(tag2)

        db.add(transaction)
        db.commit()

        # Verify relationship
        saved = db.query(Transaction).first()
        assert len(saved.tags) == 2
        tag_names = [tag.name for tag in saved.tags]
        assert 'tag1' in tag_names
        assert 'tag2' in tag_names

    def test_remove_tag_from_transaction(self, app, db):
        """Test removing a tag from a transaction."""
        transaction = Transaction(
            description='Test',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )

        tag1 = Tag(name='tag1')
        tag2 = Tag(name='tag2')

        transaction.tags.append(tag1)
        transaction.tags.append(tag2)

        db.add(transaction)
        db.commit()

        # Remove a tag
        saved = db.query(Transaction).first()
        saved.tags.remove(tag1)
        db.commit()

        # Verify
        updated = db.query(Transaction).first()
        assert len(updated.tags) == 1
        assert updated.tags[0].name == 'tag2'

    def test_delete_transaction_with_tags(self, app, db):
        """Test that deleting a transaction doesn't delete tags."""
        transaction = Transaction(
            description='Test',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )

        tag = Tag(name='shared-tag')
        transaction.tags.append(tag)

        db.add(transaction)
        db.commit()

        # Delete transaction
        db.delete(transaction)
        db.commit()

        # Tag should still exist
        saved_tag = db.query(Tag).filter_by(name='shared-tag').first()
        assert saved_tag is not None

    def test_tag_shared_across_transactions(self, app, db):
        """Test that tags can be shared between transactions."""
        tag = Tag(name='shared')
        db.add(tag)
        db.commit()

        transaction1 = Transaction(
            description='First',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )
        transaction1.tags.append(tag)

        transaction2 = Transaction(
            description='Second',
            amount=200.00,
            type='expense',
            date='2026-02-01'
        )
        transaction2.tags.append(tag)

        db.add_all([transaction1, transaction2])
        db.commit()

        # Verify both transactions share the same tag
        trans1 = db.query(Transaction).filter_by(description='First').first()
        trans2 = db.query(Transaction).filter_by(description='Second').first()

        assert trans1.tags[0].id == trans2.tags[0].id
        assert trans1.tags[0].name == 'shared'


class TestModelValidation:
    """Test model validation and constraints."""

    def test_transaction_without_description(self, app, db):
        """Test that transaction requires description."""
        transaction = Transaction(
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )

        db.add(transaction)

        # Should raise an error due to NOT NULL constraint
        with pytest.raises(Exception):
            db.commit()

    def test_transaction_without_amount(self, app, db):
        """Test that transaction requires amount."""
        transaction = Transaction(
            description='Test',
            type='expense',
            date='2026-02-01'
        )

        db.add(transaction)

        with pytest.raises(Exception):
            db.commit()

    def test_transaction_without_type(self, app, db):
        """Test that transaction requires type."""
        transaction = Transaction(
            description='Test',
            amount=100.00,
            date='2026-02-01'
        )

        db.add(transaction)

        with pytest.raises(Exception):
            db.commit()

    def test_transaction_without_date(self, app, db):
        """Test that transaction requires date."""
        transaction = Transaction(
            description='Test',
            amount=100.00,
            type='expense'
        )

        db.add(transaction)

        with pytest.raises(Exception):
            db.commit()

    def test_tag_without_name(self, app, db):
        """Test that tag requires name."""
        tag = Tag()

        db.add(tag)

        with pytest.raises(Exception):
            db.commit()


class TestModelQueries:
    """Test common query patterns."""

    def test_query_by_type(self, app, db):
        """Test querying transactions by type."""
        expense = Transaction(
            description='Expense',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )
        income = Transaction(
            description='Income',
            amount=500.00,
            type='income',
            date='2026-02-01'
        )

        db.add_all([expense, income])
        db.commit()

        expenses = db.query(Transaction).filter_by(type='expense').all()
        incomes = db.query(Transaction).filter_by(type='income').all()

        assert len(expenses) == 1
        assert len(incomes) == 1
        assert expenses[0].description == 'Expense'
        assert incomes[0].description == 'Income'

    def test_query_by_category(self, app, db):
        """Test querying transactions by category."""
        food = Transaction(
            description='Food',
            amount=100.00,
            type='expense',
            date='2026-02-01',
            category='food'
        )
        transport = Transaction(
            description='Transport',
            amount=50.00,
            type='expense',
            date='2026-02-01',
            category='transport'
        )

        db.add_all([food, transport])
        db.commit()

        food_trans = db.query(Transaction).filter_by(category='food').all()

        assert len(food_trans) == 1
        assert food_trans[0].description == 'Food'

    def test_query_by_date_range(self, app, db):
        """Test querying transactions by date range."""
        jan = Transaction(
            description='January',
            amount=100.00,
            type='expense',
            date='2026-01-15'
        )
        feb = Transaction(
            description='February',
            amount=100.00,
            type='expense',
            date='2026-02-15'
        )
        mar = Transaction(
            description='March',
            amount=100.00,
            type='expense',
            date='2026-03-15'
        )

        db.add_all([jan, feb, mar])
        db.commit()

        results = db.query(Transaction).filter(
            Transaction.date >= '2026-02-01',
            Transaction.date <= '2026-02-28'
        ).all()

        assert len(results) == 1
        assert results[0].description == 'February'

    def test_query_with_tags(self, app, db):
        """Test querying transactions with specific tags."""
        tag = Tag(name='important')
        db.add(tag)
        db.commit()

        trans1 = Transaction(
            description='Tagged',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )
        trans1.tags.append(tag)

        trans2 = Transaction(
            description='Not Tagged',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )

        db.add_all([trans1, trans2])
        db.commit()

        # Query transactions with 'important' tag
        results = db.query(Transaction).join(Transaction.tags).filter(
            Tag.name == 'important'
        ).all()

        assert len(results) == 1
        assert results[0].description == 'Tagged'

    def test_order_by_date_desc(self, app, db):
        """Test ordering transactions by date descending."""
        old = Transaction(
            description='Old',
            amount=100.00,
            type='expense',
            date='2026-01-01'
        )
        new = Transaction(
            description='New',
            amount=100.00,
            type='expense',
            date='2026-03-01'
        )
        middle = Transaction(
            description='Middle',
            amount=100.00,
            type='expense',
            date='2026-02-01'
        )

        db.add_all([old, new, middle])
        db.commit()

        results = db.query(Transaction).order_by(Transaction.date.desc()).all()

        assert results[0].description == 'New'
        assert results[1].description == 'Middle'
        assert results[2].description == 'Old'

    def test_aggregate_sum_by_type(self, app, db):
        """Test aggregating transaction amounts by type."""
        from sqlalchemy import func

        db.add_all([
            Transaction(description='E1', amount=100.00, type='expense', date='2026-02-01'),
            Transaction(description='E2', amount=200.00, type='expense', date='2026-02-01'),
            Transaction(description='I1', amount=500.00, type='income', date='2026-02-01'),
        ])
        db.commit()

        expense_sum = db.query(func.sum(Transaction.amount)).filter_by(type='expense').scalar()
        income_sum = db.query(func.sum(Transaction.amount)).filter_by(type='income').scalar()

        assert expense_sum == 300.00
        assert income_sum == 500.00

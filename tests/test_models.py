"""
Test suite for database models.
Tests model creation, relationships, and constraints.
"""

import pytest
from datetime import datetime
from JustAnotherExpenseManager.models import Transaction, Tag, TransactionType, DT_FORMAT
from JustAnotherExpenseManager.models.dtos import TransactionDTO


class TestTransactionModel:
    """Test Transaction model."""

    def test_create_transaction(self,  db):
        """Test creating a transaction instance."""
        row = TransactionDTO(
            description='Test Transaction',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )

        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=None
        )

        db.add(transaction)
        db.commit()

        saved = db.query(Transaction).first()
        assert saved.description == 'Test Transaction'
        assert saved.amount_cents == 10000
        assert saved.type == TransactionType.EXPENSE
        assert saved.is_expense is True
        assert saved.is_income is False
        assert saved.category is None
        assert saved.created_at is not None
        assert saved.updated_at is not None

    def test_transaction_with_category_tag(self, db):
        """Test that category is derived from category tags."""
        food_tag = Tag(name='category:food')
        db.add(food_tag)
        db.commit()

        row = TransactionDTO(
            description='Test Transaction',
            amount_dollars=50.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )

        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=[]
        )

        assert transaction.tags is not None
        transaction.tags.append(food_tag)

        db.add(transaction)
        db.commit()

        saved = db.query(Transaction).first()
        assert saved.category == 'food'

    def test_transaction_repr(self,  db):
        """Test transaction string representation."""
        row = TransactionDTO(
            description='Test Transaction',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=[]
        )

        db.add(transaction)
        db.commit()

        # Check that repr includes type and amount
        repr_str = repr(transaction)
        assert 'Transaction' in repr_str
        assert 'expense' in repr_str
        assert '100.00' in repr_str

    def test_transaction_amount_precision(self,  db):
        """Test that amount is stored with correct precision."""
        row = TransactionDTO(
            description='Test Transaction',
            amount_dollars=123.456789,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=[]
        )

        db.add(transaction)
        db.commit()

        saved = db.query(Transaction).first()
        # Should store to 2 decimal places (rounded to nearest cent)
        assert saved.amount_dollars == pytest.approx(123.46, abs=0.01)

    def test_transaction_is_income(self,  db):
        """Test is_income property."""
        row = TransactionDTO(
            description='Salary',
            amount_dollars=5000.00,
            type=TransactionType.INCOME,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )

        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )

        db.add(transaction)
        db.commit()

        saved = db.query(Transaction).first()
        assert saved.is_income is True
        assert saved.is_expense is False


class TestTagModel:
    """Test Tag model."""

    def test_create_tag(self,  db):
        """Test creating a tag instance."""
        tag = Tag(name='test-tag')

        db.add(tag)
        db.commit()

        saved = db.query(Tag).first()
        assert saved.name == 'test-tag'

    def test_tag_unique_constraint(self,  db):
        """Test that tag names must be unique."""
        tag1 = Tag(name='duplicate')
        db.add(tag1)
        db.commit()

        # Try to create duplicate
        tag2 = Tag(name='duplicate')
        db.add(tag2)

        with pytest.raises(Exception):
            db.commit()

    def test_tag_is_category_true(self,  db):
        """Test is_category property returns True for category tags."""
        tag = Tag(name='category:food')
        db.add(tag)
        db.commit()

        saved = db.query(Tag).first()
        assert saved.is_category is True
        assert saved.category_name == 'food'

    def test_tag_is_category_false(self,  db):
        """Test is_category property returns False for regular tags."""
        tag = Tag(name='recurring')
        db.add(tag)
        db.commit()

        saved = db.query(Tag).first()
        assert saved.is_category is False
        assert saved.category_name is None

    def test_tag_repr(self,  db):
        """Test tag string representation."""
        tag = Tag(name='test-tag')
        db.add(tag)
        db.commit()

        repr_str = repr(tag)
        assert 'Tag' in repr_str
        assert 'test-tag' in repr_str


class TestTransactionTagRelationship:
    """Test relationship between Transaction and Tag."""

    def test_add_tags_to_transaction(self,  db):
        """Test adding tags to a transaction."""
        tag1 = Tag(name='tag1')
        tag2 = Tag(name='tag2')
        db.add_all([tag1, tag2])
        db.commit()

        row = TransactionDTO(
            description='Test Transaction',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=[]
        )

        assert transaction.tags is not None
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

    def test_remove_tag_from_transaction(self,  db):
        """Test removing a tag from a transaction using remove_tag method."""
        tag1 = Tag(name='tag1')
        tag2 = Tag(name='tag2')
        db.add_all([tag1, tag2])
        db.commit()

        row = TransactionDTO(
            description='Test Transaction',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=[]
        )

        assert transaction.tags is not None
        transaction.tags.append(tag1)
        transaction.tags.append(tag2)

        db.add(transaction)
        db.commit()

        # Remove a tag using the model method
        saved = db.query(Transaction).first()
        saved.remove_tag(tag1)
        db.commit()

        # Verify
        db.expire(saved)
        updated = db.query(Transaction).first()
        assert len(updated.tags) == 1
        assert updated.tags[0].name == 'tag2'

    def test_delete_transaction_with_tags(self,  db):
        """Test that deleting a transaction doesn't delete tags."""
        tag = Tag(name='shared-tag')
        db.add(tag)
        db.commit()

        row = TransactionDTO(
            description='Test Transaction',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=[]
        )

        assert transaction.tags is not None
        transaction.tags.append(tag)

        db.add(transaction)
        db.commit()

        # Delete transaction
        db.delete(transaction)
        db.commit()

        # Tag should still exist
        saved_tag = db.query(Tag).filter_by(name='shared-tag').first()
        assert saved_tag is not None

    def test_tag_shared_across_transactions(self,  db):
        """Test that tags can be shared between transactions."""
        tag = Tag(name='shared')
        db.add(tag)
        db.commit()

        row = TransactionDTO(
            description='Test Transaction1',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transaction1 = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=[]
        )

        row = TransactionDTO(
            description='Test Transaction2',
            amount_dollars=200.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transaction2 = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=[]
        )

        assert transaction1.tags is not None
        transaction1.tags.append(tag)
        assert transaction2.tags is not None
        transaction2.tags.append(tag)

        db.add_all([transaction1, transaction2])
        db.commit()

        # Verify both transactions share the same tag
        trans1 = db.query(Transaction).filter_by(description='First').first()
        trans2 = db.query(Transaction).filter_by(description='Second').first()

        assert trans1.tags[0].id == trans2.tags[0].id
        assert trans1.tags[0].name == 'shared'

    def test_non_category_tags(self,  db):
        """Test that non_category_tags excludes category tags."""
        cat_tag = Tag(name='category:food')
        label_tag = Tag(name='recurring')
        db.add_all([cat_tag, label_tag])
        db.commit()

        row = TransactionDTO(
            description='Test Transaction',
            amount_dollars=50.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=TransactionType.EXPENSE,
            date=row.date,
            tags=[]
        )

        assert transaction.tags is not None
        transaction.tags.append(cat_tag)
        transaction.tags.append(label_tag)

        db.add(transaction)
        db.commit()

        saved = db.query(Transaction).first()
        assert saved.category == 'food'
        assert saved.non_category_tags == ['recurring']


class TestModelQueries:
    """Test common query patterns."""

    def test_query_by_type(self,  db):
        """Test querying transactions by type."""

        row = TransactionDTO(
            description='Expense',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        expense = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )

        row = TransactionDTO(
            description='Income',
            amount_dollars=500.00,
            type=TransactionType.INCOME,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        income = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )

        db.add_all([expense, income])
        db.commit()

        expenses = db.query(Transaction).filter_by(type=TransactionType.EXPENSE).all()
        incomes = db.query(Transaction).filter_by(type=TransactionType.INCOME).all()

        assert len(expenses) == 1
        assert len(incomes) == 1
        assert expenses[0].description == 'Expense'
        assert incomes[0].description == 'Income'

    def test_query_by_category_tag(self,  db):
        """Test querying transactions by their category tag."""
        food_tag = Tag(name='category:food')
        transport_tag = Tag(name='category:transport')
        db.add_all([food_tag, transport_tag])
        db.commit()

        row = TransactionDTO(
            description='Food',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        food_trans = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )
        assert food_trans.tags is not None
        food_trans.tags.append(food_tag)

        row = TransactionDTO(
            description='Transport',
            amount_dollars=50.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transport_trans = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )
        assert transport_trans.tags is not None
        transport_trans.tags.append(transport_tag)

        db.add_all([food_trans, transport_trans])
        db.commit()

        # Query transactions with the food category tag
        results = (
            db.query(Transaction)
            .join(Transaction.tags)
            .filter(Tag.name == 'category:food')
            .all()
        )

        assert len(results) == 1
        assert results[0].description == 'Food'
        assert results[0].category == 'food'

    def test_query_by_date_range(self,  db):
        """Test querying transactions by date range."""
        row = TransactionDTO(
            description='January',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-01-15', DT_FORMAT),
        )
        jan = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )

        row = TransactionDTO(
            description='February',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-15', DT_FORMAT),
        )
        feb = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )

        row = TransactionDTO(
            description='March',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-03-15', DT_FORMAT),
        )
        mar = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )

        db.add_all([jan, feb, mar])
        db.commit()

        results = db.query(Transaction).filter(
            Transaction.date >= '2026-02-01',
            Transaction.date <= '2026-02-28'
        ).all()

        assert len(results) == 1
        assert results[0].description == 'February'

    def test_query_with_specific_tag(self,  db):
        """Test querying transactions with a specific non-category tag."""
        important_tag = Tag(name='important')
        db.add(important_tag)
        db.commit()

        row = TransactionDTO(
            description='Tagged',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        trans1 = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )
        assert trans1.tags is not None
        trans1.tags.append(important_tag)

        row = TransactionDTO(
            description='Not Tagged',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        trans2 = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )

        db.add_all([trans1, trans2])
        db.commit()

        # Query transactions with 'important' tag via subquery to avoid join duplicates
        results = (
            db.query(Transaction)
            .join(Transaction.tags)
            .filter(Tag.name == 'important')
            .distinct()
            .all()
        )

        assert len(results) == 1
        assert results[0].description == 'Tagged'

    def test_order_by_date_desc(self,  db):
        """Test ordering transactions by date descending."""
        row = TransactionDTO(
            description='Old',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-01-01', DT_FORMAT),
        )
        old = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )
        row = TransactionDTO(
            description='New',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            date=datetime.strptime('2026-03-01', DT_FORMAT),
            category='test',
        )
        new = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )
        row = TransactionDTO(
            description='Middle',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        middle = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )

        db.add_all([old, new, middle])
        db.commit()

        results = db.query(Transaction).order_by(Transaction.date.desc()).all()

        assert results[0].description == 'New'
        assert results[1].description == 'Middle'
        assert results[2].description == 'Old'

    def test_aggregate_sum_by_type(self,  db):
        """Test aggregating transaction amounts by type."""
        from sqlalchemy import func

        row = TransactionDTO(
            description='E1',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        e1 = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )
        row = TransactionDTO(
            description='E2',
            amount_dollars=200.00,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        e2 = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )
        row = TransactionDTO(
            description='I1',
            amount_dollars=500.00,
            type=TransactionType.INCOME,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        i1 = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )
        db.add_all([e1, e2, i1])
        db.commit()

        expense_sum_cents = db.query(func.sum(Transaction.amount_cents)).filter_by(
            type=TransactionType.EXPENSE
        ).scalar()
        income_sum_cents = db.query(func.sum(Transaction.amount_cents)).filter_by(
            type=TransactionType.INCOME
        ).scalar()

        assert expense_sum_cents / 100.0 == 300.00
        assert income_sum_cents / 100.0 == 500.00

    def test_to_dict(self,  db):
        """Test Transaction.to_dict() returns expected structure."""
        food_tag = Tag(name='category:food')
        label_tag = Tag(name='recurring')
        db.add_all([food_tag, label_tag])
        db.commit()

        row = TransactionDTO(
            description='Groceries',
            amount_dollars=75.50,
            type=TransactionType.EXPENSE,
            category='test',
            date=datetime.strptime('2026-02-01', DT_FORMAT),
        )
        transaction = Transaction(
            description=row.description,
            amount_cents=row.amount_cents,
            type=row.type,
            date=row.date,
            tags=[]
        )
        assert transaction.tags is not None
        transaction.tags.append(food_tag)
        transaction.tags.append(label_tag)

        db.add(transaction)
        db.commit()

        saved = db.query(Transaction).first()
        d = saved.to_dict()

        assert d['description'] == 'Groceries'
        assert d['amount'] == 75.50
        assert d['type'] == 'expense'
        assert d['date'] == '2026-02-01'
        assert d['category'] == 'food'
        assert 'recurring' in d['non_category_tags']

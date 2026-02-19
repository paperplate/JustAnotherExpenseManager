"""
Integration tests for the expense manager application.
Tests complete workflows and feature interactions.
"""

import pytest
from io import BytesIO
from JustAnotherExpenseManager.models import TransactionType
from JustAnotherExpenseManager.utils.services import TransactionService


class TestCompleteWorkflow:
    """Test complete user workflows."""

    def test_add_edit_delete_workflow(self, client, app, db):
        """Test the complete lifecycle of a transaction."""
        # Step 1: Add a transaction
        data = {
            'description': 'Initial Transaction',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': 'test'
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 200

        # Step 2: Verify it appears in the list (page 1 = Feb 2026)
        response = client.get('/api/transactions?page=1')
        assert b'Initial Transaction' in response.data

        # Step 3: Get the transaction ID via service
        service = TransactionService(db)
        result = service.get_all_transactions()
        assert result['total'] == 1
        trans_id = result['transactions'][0].id

        # Step 4: Edit the transaction
        edit_data = {
            'description': 'Updated Transaction',
            'amount': '150.00',
            'type': 'expense',
            'date': '2026-02-02',
            'category': 'transport',
            'tags': 'updated'
        }
        response = client.put(f'/api/transactions/{trans_id}', data=edit_data)
        assert response.status_code == 200

        # Step 5: Verify the update
        response = client.get('/api/transactions?page=1')
        assert b'Updated Transaction' in response.data

        # Step 6: Delete the transaction
        response = client.delete(f'/api/transactions/{trans_id}')
        assert response.status_code == 200

        # Step 7: Verify it's gone
        response = client.get('/api/transactions?page=1')
        assert b'Updated Transaction' not in response.data

    def test_filtering_workflow(self, client, sample_transactions):
        """Test applying and combining filters - checking by page."""
        # Page 2 = January = Grocery, Salary, Gas
        response = client.get('/api/transactions?page=2')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data
        assert b'Salary' in response.data

        # Filter by category=food on page 2 (Jan month)
        response = client.get('/api/transactions?categories=food&page=2')
        assert b'Grocery shopping' in response.data

        # Filter by date range (January only)
        response = client.get('/api/transactions?start_date=2026-01-01&end_date=2026-01-31')
        assert b'Grocery shopping' in response.data
        assert b'Salary' in response.data
        assert b'Restaurant' not in response.data

    def test_stats_update_workflow(self, client):
        """Test that stats update when transactions change."""
        # Step 1: Check initial stats (should be empty)
        response = client.get('/api/stats')
        assert response.status_code == 200

        # Step 2: Add income
        client.post('/api/transactions', data={
            'description': 'Salary',
            'amount': '5000.00',
            'type': 'income',
            'date': '2026-02-01',
            'category': 'salary',
            'tags': ''
        })

        # Step 3: Add expense
        client.post('/api/transactions', data={
            'description': 'Rent',
            'amount': '1500.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'housing',
            'tags': ''
        })

        # Step 4: Check updated stats
        response = client.get('/api/stats')
        assert response.status_code == 200
        assert b'5000' in response.data or b'1500' in response.data

    def test_csv_import_workflow(self, client):
        """Test importing transactions from CSV."""
        csv_content = (
            b'description,amount,type,category,date,tags\n'
            b'Imported Expense 1,100.00,expense,food,2026-02-01,imported\n'
            b'Imported Expense 2,200.00,expense,transport,2026-02-02,imported\n'
            b'Imported Income,1000.00,income,salary,2026-02-01,imported\n'
        )

        data = {'csv_file': (BytesIO(csv_content), 'test.csv')}
        response = client.post(
            '/api/transactions/import',
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert result['imported'] == 3

        # Verify transactions appear in current month page (Feb 2026)
        response = client.get('/api/transactions?page=1')
        assert b'Imported Expense 1' in response.data or b'Imported Income' in response.data


class TestDataConsistency:
    """Test data consistency across operations."""

    def test_tag_consistency(self, app, db):
        """Test that tags are consistently handled via service layer."""
        service = TransactionService(db)

        service.create_transaction(
            description='Trans 1',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            date='2026-02-01',
            category='food',
            tags=['shared-tag', 'unique1']
        )
        service.create_transaction(
            description='Trans 2',
            amount_dollars=200.00,
            type=TransactionType.EXPENSE,
            date='2026-02-01',
            category='food',
            tags=['shared-tag', 'unique2']
        )

        # shared-tag should only exist once in DB (reused across transactions)
        from JustAnotherExpenseManager.models import Tag
        shared_tags = db.query(Tag).filter_by(name='shared-tag').all()
        assert len(shared_tags) == 1

    def test_category_tag_consistency(self, app, db):
        """Test that category tags are properly created and reused."""
        service = TransactionService(db)

        service.create_transaction(
            description='Food 1',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            date='2026-02-01',
            category='food',
            tags=[]
        )
        service.create_transaction(
            description='Food 2',
            amount_dollars=150.00,
            type=TransactionType.EXPENSE,
            date='2026-02-01',
            category='food',
            tags=[]
        )

        # category:food tag should only exist once
        from JustAnotherExpenseManager.models import Tag
        food_tags = db.query(Tag).filter_by(name='category:food').all()
        assert len(food_tags) == 1

        # Both transactions should reference the same tag object
        result = service.get_all_transactions()
        cat_tag_ids = [
            tag.id for t in result['transactions']
            for tag in t.tags if tag.name == 'category:food'
        ]
        assert len(set(cat_tag_ids)) == 1

    def test_pagination_consistency(self, client):
        """Test that month-based pagination shows all transactions in same month."""
        # Create 25 transactions all in the same month (Feb 2026)
        for i in range(25):
            client.post('/api/transactions', data={
                'description': f'Trans {i}',
                'amount': '100.00',
                'type': 'expense',
                'date': '2026-02-01',
                'category': 'food',
                'tags': ''
            })

        # All 25 should be on page 1 (all same month)
        response = client.get('/api/transactions?page=1')
        assert response.status_code == 200
        # Total count shown in footer
        assert b'25' in response.data

        # Page 2 shouldn't exist (only 1 month)
        response = client.get('/api/transactions?page=2')
        assert response.status_code == 200


class TestErrorHandling:
    """Test error handling across the application."""

    def test_sql_injection_prevention(self, client):
        """Test that SQL injection attempts are handled safely."""
        response = client.get("/api/transactions?categories=food'; DROP TABLE transactions; --")
        assert response.status_code == 200

        response = client.get("/api/transactions?tags=tag'; DELETE FROM tags; --")
        assert response.status_code == 200

        response = client.get('/api/transactions')
        assert response.status_code == 200

    def test_xss_prevention(self, client):
        """Test that XSS attempts in transaction descriptions are escaped."""
        data = {
            'description': '<script>alert("XSS")</script>',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': ''
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 200

        response = client.get('/api/transactions?page=1')
        # Script tag should be Jinja2-escaped in HTML output
        assert b'<script>alert' not in response.data

    def test_concurrent_updates_last_write_wins(self, client, app, db):
        """Test that sequential updates to the same transaction succeed."""
        service = TransactionService(db)

        trans_id = service.create_transaction(
            description='Original',
            amount_dollars=100.00,
            type=TransactionType.EXPENSE,
            date='2026-02-01',
            category='food',
            tags=[]
        )

        response1 = client.put(f'/api/transactions/{trans_id}', data={
            'description': 'Update 1',
            'amount': '150.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': ''
        })
        response2 = client.put(f'/api/transactions/{trans_id}', data={
            'description': 'Update 2',
            'amount': '200.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'transport',
            'tags': ''
        })

        assert response1.status_code == 200
        assert response2.status_code == 200

        # Latest update should be reflected
        result = service.get_all_transactions()
        db.expire_all()
        result = service.get_all_transactions()
        assert result['transactions'][0].description == 'Update 2'


class TestPerformance:
    """Test performance with larger datasets."""

    def test_complex_filtering(self, client):
        """Test filtering with multiple conditions and larger data set."""
        for i in range(50):
            client.post('/api/transactions', data={
                'description': f'Trans {i}',
                'amount': str(100.00 + i),
                'type': 'expense' if i % 2 == 0 else 'income',
                'date': f'2026-01-{(i % 28) + 1:02d}',
                'category': ['food', 'transport', 'entertainment'][i % 3],
                'tags': f'tag{i % 5}'
            })

        response = client.get(
            '/api/transactions?categories=food&start_date=2026-01-01&end_date=2026-01-31'
        )
        assert response.status_code == 200

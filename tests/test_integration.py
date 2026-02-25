"""
Integration tests for the expense manager application.
Tests complete workflows and cross-feature interactions.
"""

import pytest
from io import BytesIO
from JustAnotherExpenseManager.models import TransactionType, Tag
from JustAnotherExpenseManager.utils.services import TransactionService


# ---------------------------------------------------------------------------
# Complete user workflows
# ---------------------------------------------------------------------------

class TestCompleteWorkflow:

    def test_add_edit_delete_workflow(self, client, db):
        """Full transaction lifecycle via HTTP."""
        # Create
        r = client.post('/api/transactions', data={
            'description': 'Initial Transaction',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': 'test',
        })
        assert r.status_code == 200
        assert b'Initial Transaction' in client.get('/api/transactions?page=1').data

        # Retrieve ID via service
        service = TransactionService(db)
        trans_id = service.get_all_transactions()['transactions'][0].id

        # Edit
        r = client.put(f'/api/transactions/{trans_id}', data={
            'description': 'Updated Transaction',
            'amount': '150.00',
            'type': 'expense',
            'date': '2026-02-02',
            'category': 'transport',
            'tags': 'updated',
        })
        assert r.status_code == 200
        assert b'Updated Transaction' in client.get('/api/transactions?page=1').data

        # Delete
        assert client.delete(f'/api/transactions/{trans_id}').status_code == 200
        assert b'Updated Transaction' not in client.get('/api/transactions?page=1').data

    def test_filtering_workflow(self, client, sample_transactions):
        """Apply and combine filters across pages."""
        # Page 2 = January = Grocery, Salary, Gas
        r = client.get('/api/transactions?page=2')
        assert r.status_code == 200
        assert b'Grocery shopping' in r.data
        assert b'Salary' in r.data

        # Category filter on page 2
        r = client.get('/api/transactions?categories=food&page=2')
        assert b'Grocery shopping' in r.data

        # Date range — January only
        r = client.get('/api/transactions?start_date=2026-01-01&end_date=2026-01-31')
        assert b'Grocery shopping' in r.data
        assert b'Salary' in r.data
        assert b'Restaurant' not in r.data

    def test_stats_update_after_adding_transactions(self, client):
        """Stats endpoint reflects newly added transactions."""
        assert client.get('/api/stats').status_code == 200

        client.post('/api/transactions', data={
            'description': 'Salary', 'amount': '5000.00', 'type': 'income',
            'date': '2026-02-01', 'category': 'salary', 'tags': '',
        })
        client.post('/api/transactions', data={
            'description': 'Rent', 'amount': '1500.00', 'type': 'expense',
            'date': '2026-02-01', 'category': 'housing', 'tags': '',
        })

        r = client.get('/api/stats')
        assert r.status_code == 200
        assert b'5000' in r.data or b'1500' in r.data

    def test_csv_import_workflow(self, client):
        """Import CSV and verify transactions appear in the list."""
        csv_content = (
            b'description,amount,type,category,date,tags\n'
            b'Imported Expense 1,100.00,expense,food,2026-02-01,imported\n'
            b'Imported Expense 2,200.00,expense,transport,2026-02-02,imported\n'
            b'Imported Income,1000.00,income,salary,2026-02-01,imported\n'
        )
        r = client.post(
            '/api/transactions/import',
            data={'csv_file': (BytesIO(csv_content), 'test.csv')},
            content_type='multipart/form-data',
        )
        assert r.status_code == 200
        result = r.get_json()
        assert result['success'] is True
        assert result['imported'] == 3

        r = client.get('/api/transactions?page=1')
        assert b'Imported Expense 1' in r.data or b'Imported Income' in r.data


# ---------------------------------------------------------------------------
# Data consistency
# ---------------------------------------------------------------------------

class TestDataConsistency:

    def test_shared_tag_stored_once(self, app, db):
        """A tag shared by two transactions has exactly one DB row."""
        service = TransactionService(db)
        service.create_transaction(
            description='Trans 1', amount_dollars=100.00,
            type=TransactionType.EXPENSE, date='2026-02-01',
            category='food', tags=['shared-tag', 'unique1'],
        )
        service.create_transaction(
            description='Trans 2', amount_dollars=200.00,
            type=TransactionType.EXPENSE, date='2026-02-01',
            category='food', tags=['shared-tag', 'unique2'],
        )

        assert len(db.query(Tag).filter_by(name='shared-tag').all()) == 1

    def test_category_tag_stored_once_and_reused(self, app, db):
        """category:food tag is created once and referenced by both transactions."""
        service = TransactionService(db)
        service.create_transaction(
            description='Food 1', amount_dollars=100.00,
            type=TransactionType.EXPENSE, date='2026-02-01',
            category='food', tags=[],
        )
        service.create_transaction(
            description='Food 2', amount_dollars=150.00,
            type=TransactionType.EXPENSE, date='2026-02-01',
            category='food', tags=[],
        )

        assert len(db.query(Tag).filter_by(name='category:food').all()) == 1

        result = service.get_all_transactions()
        cat_tag_ids = [
            tag.id
            for t in result['transactions']
            for tag in t.tags
            if tag.name == 'category:food'
        ]
        assert len(set(cat_tag_ids)) == 1

    def test_pagination_same_month_on_single_page(self, client):
        """All transactions in the same month appear on a single page."""
        for i in range(25):
            client.post('/api/transactions', data={
                'description': f'Trans {i}',
                'amount': '100.00',
                'type': 'expense',
                'date': '2026-02-01',
                'category': 'food',
                'tags': '',
            })

        r = client.get('/api/transactions?page=1')
        assert r.status_code == 200
        assert b'25' in r.data

        # Only one month of data, so page 2 should gracefully return the same page
        assert client.get('/api/transactions?page=2').status_code == 200

    def test_sequential_updates_last_write_wins(self, client, db):
        """Two sequential PUT requests — only the last update is persisted."""
        service = TransactionService(db)
        trans_id = service.create_transaction(
            description='Original', amount_dollars=100.00,
            type=TransactionType.EXPENSE, date='2026-02-01',
            category='food', tags=[],
        )

        assert client.put(f'/api/transactions/{trans_id}', data={
            'description': 'Update 1', 'amount': '150.00', 'type': 'expense',
            'date': '2026-02-01', 'category': 'food', 'tags': '',
        }).status_code == 200

        assert client.put(f'/api/transactions/{trans_id}', data={
            'description': 'Update 2', 'amount': '200.00', 'type': 'expense',
            'date': '2026-02-01', 'category': 'transport', 'tags': '',
        }).status_code == 200

        db.expire_all()
        assert service.get_all_transactions()['transactions'][0].description == 'Update 2'


# ---------------------------------------------------------------------------
# Error handling and security
# ---------------------------------------------------------------------------

class TestErrorHandling:

    def test_sql_injection_in_query_params_is_safe(self, client):
        """Malicious query parameters must not raise errors or corrupt the DB."""
        assert client.get(
            "/api/transactions?categories=food'; DROP TABLE transactions; --"
        ).status_code == 200
        assert client.get(
            "/api/transactions?tags=tag'; DELETE FROM tags; --"
        ).status_code == 200
        assert client.get('/api/transactions').status_code == 200

    def test_xss_in_description_is_escaped(self, client):
        """Script tags in descriptions must be HTML-escaped in the response."""
        client.post('/api/transactions', data={
            'description': '<script>alert("XSS")</script>',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': '',
        })
        assert b'<script>alert' not in client.get('/api/transactions?page=1').data


# ---------------------------------------------------------------------------
# Performance smoke test
# ---------------------------------------------------------------------------

class TestPerformance:

    def test_complex_filtering_on_larger_dataset(self, client):
        """Filtering with multiple conditions should return 200 without errors."""
        for i in range(50):
            client.post('/api/transactions', data={
                'description': f'Trans {i}',
                'amount': str(100.00 + i),
                'type': 'expense' if i % 2 == 0 else 'income',
                'date': f'2026-01-{(i % 28) + 1:02d}',
                'category': ['food', 'transport', 'entertainment'][i % 3],
                'tags': f'tag{i % 5}',
            })

        r = client.get('/api/transactions?categories=food&start_date=2026-01-01&end_date=2026-01-31')
        assert r.status_code == 200

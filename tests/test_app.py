"""
Application-level unit tests for the Expense Manager.
Tests app factory, configuration, and core app behaviors.
"""

import pytest
from JustAnotherExpenseManager import create_app
from JustAnotherExpenseManager.utils.database import create_database_manager
from JustAnotherExpenseManager.models import Base, TransactionType
from JustAnotherExpenseManager.utils.services import TransactionService


class TestAppFactory:
    """Test Flask application factory and configuration."""

    def test_app_is_created(self, app):
        """Test that app is created successfully."""
        assert app is not None

    def test_app_testing_mode(self, app):
        """Test that app is in testing mode during tests."""
        assert app.config['TESTING'] is True

    def test_app_has_routes(self, app):
        """Test that expected routes are registered."""
        url_map = {str(rule) for rule in app.url_map.iter_rules()}
        assert '/api/transactions' in url_map
        assert '/api/stats' in url_map
        assert '/api/categories' in url_map
        assert '/api/tags' in url_map
        assert '/settings' in url_map

    def test_app_client_available(self, client):
        """Test that test client can make requests."""
        response = client.get('/')
        assert response.status_code in (200, 302)


class TestTransactionLifecycle:
    """Test full transaction lifecycle via HTTP."""

    def test_create_and_retrieve_transaction(self, client):
        """Test creating a transaction and retrieving it."""
        data = {
            'description': 'Test Expense',
            'amount': '50.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': 'test'
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 200

        response = client.get('/api/transactions?page=1')
        assert b'Test Expense' in response.data
        assert b'50' in response.data

    def test_delete_expense(self, client, app, db):
        """Test deleting an expense."""
        service = TransactionService(db)

        trans_id = service.create_transaction(
            description='To Delete',
            amount_dollars=25.00,
            type=TransactionType.EXPENSE,
            date='2026-02-01',
            category='other',
            tags=[]
        )

        response = client.delete(f'/api/transactions/{trans_id}')
        assert response.status_code == 200

        result = service.get_all_transactions()
        db.expire_all()
        result = service.get_all_transactions()
        assert result['total'] == 0

    def test_get_stats(self, client):
        """Test statistics endpoint returns valid response."""
        client.post('/api/transactions', data={
            'description': 'Food 1',
            'amount': '20.00',
            'type': 'expense',
            'category': 'food',
            'date': '2026-02-01',
            'tags': ''
        })
        client.post('/api/transactions', data={
            'description': 'Food 2',
            'amount': '30.00',
            'type': 'expense',
            'category': 'food',
            'date': '2026-02-01',
            'tags': ''
        })

        response = client.get('/api/stats')
        assert response.status_code == 200

    def test_csv_import_validation(self, client):
        """Test CSV import with validation errors (partially invalid rows)."""
        from io import BytesIO

        csv_content = (
            b'description,amount,type,category,date,tags\n'
            b'Valid Expense,25.00,expense,food,2026-01-15,\n'
            b'Invalid Amount,not_a_number,expense,food,2026-01-16,\n'
            b'Also Valid,30.00,expense,transport,2026-01-17,\n'
        )

        response = client.post(
            '/api/transactions/import',
            data={'csv_file': (BytesIO(csv_content), 'test.csv')},
            content_type='multipart/form-data'
        )

        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert result['imported'] == 2
        assert len(result['errors']) == 1

    def test_csv_import_wrong_extension(self, client):
        """Test CSV import with wrong file extension returns 400."""
        from io import BytesIO

        response = client.post(
            '/api/transactions/import',
            data={'csv_file': (BytesIO(b'test'), 'test.txt')},
            content_type='multipart/form-data'
        )

        assert response.status_code == 400
        result = response.get_json()
        assert 'error' in result

    def test_multiple_transactions(self, client):
        """Test adding multiple transactions and querying them."""
        transactions = [
            {'description': 'Expense 1', 'amount': '10.00', 'type': 'expense',
             'category': 'food', 'date': '2026-02-01', 'tags': ''},
            {'description': 'Expense 2', 'amount': '20.00', 'type': 'expense',
             'category': 'transport', 'date': '2026-02-02', 'tags': ''},
            {'description': 'Expense 3', 'amount': '30.00', 'type': 'expense',
             'category': 'shopping', 'date': '2026-02-03', 'tags': ''},
        ]

        for transaction in transactions:
            client.post('/api/transactions', data=transaction)

        response = client.get('/api/transactions?page=1')
        for transaction in transactions:
            assert transaction['description'].encode() in response.data

    def test_database_persistence(self, app, db):
        """Test that database operations persist correctly within test session."""
        service = TransactionService(db)

        trans_id = service.create_transaction(
            description='Persistent Test',
            amount_dollars=99.99,
            type=TransactionType.EXPENSE,
            date='2026-02-01',
            category='other',
            tags=[]
        )

        result = service.get_all_transactions()
        assert result['total'] == 1

        saved = result['transactions'][0]
        assert saved.description == 'Persistent Test'
        assert saved.amount_dollars == pytest.approx(99.99, abs=0.01)

"""
Application-level tests for the Expense Manager.
Covers the app factory, configuration, and end-to-end transaction lifecycle.
Tests that overlap with test_routes.py (CSV import, stats, filtering) live there.
"""

import pytest
from JustAnotherExpenseManager import create_app
from JustAnotherExpenseManager.models import TransactionType
from JustAnotherExpenseManager.utils.services import TransactionService


class TestAppFactory:

    def test_app_created(self, app):
        assert app is not None

    def test_app_testing_mode(self, app):
        assert app.config['TESTING'] is True

    def test_expected_routes_registered(self, app):
        url_map = {str(rule) for rule in app.url_map.iter_rules()}
        for route in ('/api/transactions', '/api/stats', '/api/categories',
                      '/api/tags', '/settings'):
            assert route in url_map

    def test_home_page_reachable(self, client):
        assert client.get('/').status_code in (200, 302)


class TestTransactionLifecycle:
    """Full create → retrieve → delete cycle exercised via HTTP and service layer."""

    def test_create_and_retrieve(self, client):
        response = client.post('/api/transactions', data={
            'description': 'Lifecycle Expense',
            'amount': '50.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': 'test',
        })
        assert response.status_code == 200
        assert b'Lifecycle Expense' in client.get('/api/transactions?page=1').data

    def test_delete_removes_transaction(self, client, db):
        service = TransactionService(db)
        trans_id = service.create_transaction(
            description='To Delete',
            amount_dollars=25.00,
            type=TransactionType.EXPENSE,
            date='2026-02-01',
            category='other',
            tags=[],
        )

        assert client.delete(f'/api/transactions/{trans_id}').status_code == 200

        db.expire_all()
        assert service.get_all_transactions()['total'] == 0

    def test_database_persistence_within_session(self, db):
        service = TransactionService(db)
        service.create_transaction(
            description='Persistent Test',
            amount_dollars=99.99,
            type=TransactionType.EXPENSE,
            date='2026-02-01',
            category='other',
            tags=[],
        )

        result = service.get_all_transactions()
        assert result['total'] == 1
        saved = result['transactions'][0]
        assert saved.description == 'Persistent Test'
        assert saved.amount_dollars == pytest.approx(99.99, abs=0.01)

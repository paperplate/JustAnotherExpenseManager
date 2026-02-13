"""
Test suite for Flask routes.
Tests basic route functionality, status codes, and response content.
"""

import pytest
from flask import url_for


class TestBasicRoutes:
    """Test basic application routes."""

    def test_home_page_redirect(self, client):
        """Test that home page redirects to summary."""
        response = client.get('/')
        assert response.status_code == 302
        assert '/summary' in response.location

    def test_summary_page_loads(self, client):
        """Test that summary page loads successfully."""
        response = client.get('/summary')
        assert response.status_code == 200
        assert b'Expense Manager' in response.data or b'Summary' in response.data

    def test_transactions_page_loads(self, client):
        """Test that transactions page loads successfully."""
        response = client.get('/transactions')
        assert response.status_code == 200

    def test_settings_page_loads(self, client):
        """Test that settings page loads successfully."""
        response = client.get('/settings')
        assert response.status_code == 200

    def test_404_error(self, client):
        """Test that non-existent routes return 404."""
        response = client.get('/nonexistent-page')
        assert response.status_code == 404


class TestTransactionAPI:
    """Test transaction API endpoints."""

    def test_get_transactions_empty(self, client):
        """Test getting transactions when database is empty."""
        response = client.get('/api/transactions')
        assert response.status_code == 200
        assert b'No transactions' in response.data or b'empty' in response.data.lower()

    def test_get_transactions_with_data(self, client, sample_transactions):
        """Test getting transactions with sample data."""
        response = client.get('/api/transactions')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data
        assert b'Salary' in response.data

    def test_create_transaction_success(self, client):
        """Test creating a new transaction."""
        data = {
            'description': 'Test Transaction',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': 'test,sample'
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 200

        # Verify transaction appears in list
        response = client.get('/api/transactions')
        assert b'Test Transaction' in response.data

    def test_create_transaction_missing_description(self, client):
        """Test that creating transaction without description fails."""
        data = {
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food'
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400
        assert b'Description is required' in response.data

    def test_create_transaction_missing_amount(self, client):
        """Test that creating transaction without amount fails."""
        data = {
            'description': 'Test',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food'
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400
        assert b'Amount is required' in response.data

    def test_create_transaction_invalid_amount(self, client):
        """Test that creating transaction with invalid amount fails."""
        data = {
            'description': 'Test',
            'amount': 'not-a-number',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food'
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400
        assert b'Invalid amount' in response.data

    def test_create_transaction_negative_amount(self, client):
        """Test that creating transaction with negative amount fails."""
        data = {
            'description': 'Test',
            'amount': '-100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food'
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400
        assert b'positive' in response.data.lower()

    def test_create_transaction_invalid_type(self, client):
        """Test that creating transaction with invalid type fails."""
        data = {
            'description': 'Test',
            'amount': '100.00',
            'type': 'invalid',
            'date': '2026-02-01',
            'category': 'food'
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400

    def test_create_transaction_invalid_date(self, client):
        """Test that creating transaction with invalid date fails."""
        data = {
            'description': 'Test',
            'amount': '100.00',
            'type': 'expense',
            'date': 'invalid-date',
            'category': 'food'
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400
        assert b'Invalid date' in response.data

    def test_update_transaction_success(self, client, sample_transactions):
        """Test updating an existing transaction."""
        trans_id = sample_transactions[0]
        data = {
            'description': 'Updated Description',
            'amount': '200.00',
            'type': 'expense',
            'date': '2026-01-16',
            'category': 'food',
            'tags': 'updated'
        }
        response = client.put(f'/api/transactions/{trans_id}', data=data)
        assert response.status_code == 200

        # Verify transaction was updated
        response = client.get('/api/transactions')
        assert b'Updated Description' in response.data
        assert b'200.00' in response.data

    def test_update_nonexistent_transaction(self, client):
        """Test updating a transaction that doesn't exist."""
        data = {
            'description': 'Updated',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food'
        }
        response = client.put('/api/transactions/99999', data=data)
        assert response.status_code == 400

    def test_delete_transaction_success(self, client, sample_transactions):
        """Test deleting an existing transaction."""
        trans_id = sample_transactions[0]
        response = client.delete(f'/api/transactions/{trans_id}')
        assert response.status_code == 200

        # Verify transaction was deleted
        response = client.get('/api/transactions')
        assert b'Grocery shopping' not in response.data

    def test_delete_nonexistent_transaction(self, client):
        """Test deleting a transaction that doesn't exist."""
        response = client.delete('/api/transactions/99999')
        # Should not fail, just return empty list
        assert response.status_code == 200


class TestTransactionFiltering:
    """Test transaction filtering functionality."""

    def test_filter_by_category(self, client, sample_transactions):
        """Test filtering transactions by category."""
        response = client.get('/api/transactions?categories=food')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data
        assert b'Restaurant' in response.data
        assert b'Gas' not in response.data

    def test_filter_by_multiple_categories(self, client, sample_transactions):
        """Test filtering by multiple categories."""
        response = client.get('/api/transactions?categories=food,transport')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data
        assert b'Gas' in response.data

    def test_filter_by_tags(self, client, sample_transactions):
        """Test filtering transactions by tags."""
        response = client.get('/api/transactions?tags=recurring')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data
        assert b'Salary' in response.data
        assert b'Restaurant' not in response.data

    def test_filter_by_time_range(self, client, sample_transactions):
        """Test filtering transactions by time range."""
        response = client.get('/api/transactions?range=current_month')
        assert response.status_code == 200

    def test_filter_by_custom_date_range(self, client, sample_transactions):
        """Test filtering by custom date range."""
        response = client.get('/api/transactions?start_date=2026-01-01&end_date=2026-01-31')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data
        assert b'Salary' in response.data
        assert b'Restaurant' not in response.data

    def test_filter_combined(self, client, sample_transactions):
        """Test combining multiple filters."""
        response = client.get('/api/transactions?categories=food&tags=recurring')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data
        assert b'Restaurant' not in response.data


class TestTransactionPagination:
    """Test transaction pagination."""

    def test_pagination_first_page(self, client, sample_transactions):
        """Test getting first page of transactions."""
        response = client.get('/api/transactions?page=1&per_page=2')
        assert response.status_code == 200

    def test_pagination_second_page(self, client, sample_transactions):
        """Test getting second page of transactions."""
        response = client.get('/api/transactions?page=2&per_page=2')
        assert response.status_code == 200

    def test_pagination_invalid_page(self, client, sample_transactions):
        """Test requesting invalid page number."""
        response = client.get('/api/transactions?page=999')
        assert response.status_code == 200


class TestStatsAPI:
    """Test statistics API endpoints."""

    def test_get_stats_empty(self, client):
        """Test getting stats when database is empty."""
        response = client.get('/api/stats')
        assert response.status_code == 200

    def test_get_stats_with_data(self, client, sample_transactions):
        """Test getting stats with sample data."""
        response = client.get('/api/stats')
        assert response.status_code == 200
        # Stats should contain some numerical data
        assert b'$' in response.data or b'0' in response.data

    def test_get_stats_filtered(self, client, sample_transactions):
        """Test getting filtered stats."""
        response = client.get('/api/stats?categories=food')
        assert response.status_code == 200


class TestCategoryAPI:
    """Test category API endpoints."""

    def test_get_categories_empty(self, client):
        """Test getting categories when database is empty."""
        response = client.get('/api/categories')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_get_categories_with_data(self, client, sample_transactions):
        """Test getting categories with sample data."""
        response = client.get('/api/categories')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        assert len(data) > 0


class TestTagAPI:
    """Test tag API endpoints."""

    def test_get_tags_empty(self, client):
        """Test getting tags when database is empty."""
        response = client.get('/api/tags')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_get_tags_with_data(self, client, sample_transactions):
        """Test getting tags with sample data."""
        response = client.get('/api/tags')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Should not include category tags
        assert not any(tag.startswith('category:') for tag in data)


class TestCSVImport:
    """Test CSV import functionality."""

    def test_import_csv_no_file(self, client):
        """Test importing without uploading a file."""
        response = client.post('/api/transactions/import')
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data

    def test_import_csv_invalid_extension(self, client):
        """Test importing file with wrong extension."""
        data = {'csv_file': (b'test data', 'test.txt')}
        response = client.post('/api/transactions/import', data=data)
        assert response.status_code == 400

    def test_import_csv_valid(self, client):
        """Test importing valid CSV file."""
        csv_content = b'description,amount,type,category,date,tags\n' \
                     b'Test Transaction,100.00,expense,food,2026-02-01,test\n' \
                     b'Test Income,500.00,income,salary,2026-02-01,monthly'

        data = {'csv_file': (csv_content, 'test.csv')}
        response = client.post(
            '/api/transactions/import',
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert result['imported'] == 2

    def test_import_csv_invalid_rows(self, client):
        """Test importing CSV with some invalid rows."""
        csv_content = b'description,amount,type,category,date,tags\n' \
                     b'Valid,100.00,expense,food,2026-02-01,test\n' \
                     b'Invalid,not-a-number,expense,food,2026-02-01,test\n' \
                     b'Also Valid,200.00,income,salary,2026-02-01,monthly'

        data = {'csv_file': (csv_content, 'test.csv')}
        response = client.post(
            '/api/transactions/import',
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 200
        result = response.get_json()
        assert result['imported'] == 2
        assert len(result['errors']) == 1


class TestSettingsAPI:
    """Test settings API endpoints."""

    def test_load_test_data(self, client):
        """Test loading test data."""
        response = client.post('/api/settings/test-data')
        assert response.status_code == 200
        data = response.get_json()
        assert 'message' in data

        # Verify transactions were created
        response = client.get('/api/transactions')
        assert response.status_code == 200

    def test_reset_database(self, client, sample_transactions):
        """Test resetting the database."""
        # Verify data exists
        response = client.get('/api/transactions')
        assert b'Grocery shopping' in response.data

        # Reset database
        response = client.post('/api/settings/reset')
        assert response.status_code == 200

        # Verify data is gone
        response = client.get('/api/transactions')
        assert b'Grocery shopping' not in response.data

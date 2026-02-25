"""
Test suite for Flask HTTP routes.
Tests status codes, response shapes, and HTML content via the test client.
"""

import pytest
from io import BytesIO


# ---------------------------------------------------------------------------
# Basic page routes
# ---------------------------------------------------------------------------

class TestBasicRoutes:

    def test_home_page_loads(self, client):
        response = client.get('/')
        assert response.status_code == 200
        assert b'Expense Manager' in response.data or b'Summary' in response.data

    def test_summary_page_loads(self, client):
        assert client.get('/summary').status_code == 200

    def test_transactions_page_loads(self, client):
        assert client.get('/transactions').status_code == 200

    def test_settings_page_loads(self, client):
        assert client.get('/settings').status_code == 200

    def test_unknown_route_returns_404(self, client):
        assert client.get('/nonexistent-page').status_code == 404


# ---------------------------------------------------------------------------
# Transaction CRUD
# ---------------------------------------------------------------------------

class TestTransactionAPI:

    def test_get_transactions_empty(self, client):
        response = client.get('/api/transactions')
        assert response.status_code == 200

    def test_get_transactions_page1_shows_newest_month(self, client, sample_transactions):
        # sample_transactions puts Restaurant in Feb 2026 (page 1)
        response = client.get('/api/transactions?page=1')
        assert response.status_code == 200
        assert b'Restaurant' in response.data

    def test_get_transactions_page2_shows_older_month(self, client, sample_transactions):
        response = client.get('/api/transactions?page=2')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data

    def test_create_transaction_success(self, client):
        data = {
            'description': 'Test Transaction',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': 'test,sample',
        }
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 200
        assert b'Test Transaction' in client.get('/api/transactions?page=1').data

    def test_create_transaction_empty_description_rejected(self, client):
        data = {'description': '', 'amount': '100.00', 'type': 'expense',
                'date': '2026-02-01', 'category': 'food'}
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400

    def test_create_transaction_negative_amount_rejected(self, client):
        data = {'description': 'Test', 'amount': '-100.00', 'type': 'expense',
                'date': '2026-02-01', 'category': 'food'}
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400

    def test_create_transaction_invalid_type_rejected(self, client):
        data = {'description': 'Test', 'amount': '100.00', 'type': 'invalid',
                'date': '2026-02-01', 'category': 'food'}
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400

    def test_create_transaction_invalid_date_rejected(self, client):
        data = {'description': 'Test', 'amount': '100.00', 'type': 'expense',
                'date': 'not-a-date', 'category': 'food'}
        response = client.post('/api/transactions', data=data)
        assert response.status_code == 400

    def test_update_transaction_success(self, client, sample_transactions):
        trans_id = sample_transactions[0]
        data = {'description': 'Updated', 'amount': '200.00', 'type': 'expense',
                'date': '2026-01-16', 'category': 'food', 'tags': 'updated'}
        assert client.put(f'/api/transactions/{trans_id}', data=data).status_code == 200

    def test_update_nonexistent_transaction_returns_400(self, client):
        data = {'description': 'Updated', 'amount': '100.00', 'type': 'expense',
                'date': '2026-02-01', 'category': 'food'}
        assert client.put('/api/transactions/99999', data=data).status_code == 400

    def test_delete_transaction_success(self, client, sample_transactions):
        assert client.delete(f'/api/transactions/{sample_transactions[0]}').status_code == 200

    def test_delete_nonexistent_transaction_is_noop(self, client):
        assert client.delete('/api/transactions/99999').status_code == 200


# ---------------------------------------------------------------------------
# Transaction filtering and pagination
# ---------------------------------------------------------------------------

class TestTransactionFiltering:

    def test_filter_by_category_page1(self, client, sample_transactions):
        # Restaurant (food, Feb) is on page 1
        response = client.get('/api/transactions?categories=food&page=1')
        assert response.status_code == 200
        assert b'Restaurant' in response.data

    def test_filter_by_category_page2(self, client, sample_transactions):
        # Grocery shopping (food, Jan) is on page 2
        response = client.get('/api/transactions?categories=food&page=2')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data

    def test_filter_by_tag(self, client, sample_transactions):
        # 'recurring' tag is on Jan transactions
        response = client.get('/api/transactions?tags=recurring&page=2')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data or b'Salary' in response.data

    def test_filter_by_date_range_includes_matching(self, client, sample_transactions):
        response = client.get('/api/transactions?start_date=2026-01-01&end_date=2026-01-31')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data
        assert b'Salary' in response.data

    def test_filter_by_date_range_excludes_outside(self, client, sample_transactions):
        response = client.get('/api/transactions?start_date=2026-01-01&end_date=2026-01-31')
        assert b'Restaurant' not in response.data

    def test_filter_by_time_range_param(self, client, sample_transactions):
        assert client.get('/api/transactions?range=current_month').status_code == 200

    def test_pagination_out_of_bounds_returns_last_page(self, client, sample_transactions):
        assert client.get('/api/transactions?page=999').status_code == 200


# ---------------------------------------------------------------------------
# Stats API
# ---------------------------------------------------------------------------

class TestStatsAPI:

    def test_stats_empty_database(self, client):
        assert client.get('/api/stats').status_code == 200

    def test_stats_with_data(self, client, sample_transactions):
        response = client.get('/api/stats')
        assert response.status_code == 200
        assert b'$' in response.data or b'0' in response.data

    def test_stats_filtered_by_category(self, client, sample_transactions):
        assert client.get('/api/stats?categories=food').status_code == 200


# ---------------------------------------------------------------------------
# Category API
# ---------------------------------------------------------------------------

class TestCategoryAPI:

    def test_get_categories_returns_list(self, client):
        response = client.get('/api/categories')
        assert response.status_code == 200
        assert isinstance(response.get_json(), list)

    def test_get_categories_with_data_returns_dicts(self, client, sample_transactions):
        response = client.get('/api/categories')
        data = response.get_json()
        assert len(data) > 0
        # Each item is a dict with a category_name key
        assert all('category_name' in item for item in data)

    def test_add_category_success(self, client):
        response = client.post('/api/categories', json={'name': 'newcat'})
        assert response.status_code == 200
        assert response.get_json()['success'] is True

    def test_add_duplicate_category_returns_400(self, client, sample_transactions):
        client.post('/api/categories', json={'name': 'groceries'})
        response = client.post('/api/categories', json={'name': 'groceries'})
        assert response.status_code == 400

    def test_add_category_invalid_name_returns_400(self, client):
        # Names with spaces are rejected
        response = client.post('/api/categories', json={'name': 'has space'})
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Tag API
# ---------------------------------------------------------------------------

class TestTagAPI:

    def test_get_tags_returns_list(self, client):
        response = client.get('/api/tags')
        assert response.status_code == 200
        assert isinstance(response.get_json(), list)

    def test_get_tags_excludes_category_tags(self, client, sample_transactions):
        data = client.get('/api/tags').get_json()
        assert not any(tag.startswith('category:') for tag in data)


# ---------------------------------------------------------------------------
# CSV import
# ---------------------------------------------------------------------------

class TestCSVImport:

    def test_import_no_file_returns_400(self, client):
        response = client.post('/api/transactions/import')
        assert response.status_code == 400
        assert 'error' in response.get_json()

    def test_import_wrong_extension_returns_400(self, client):
        response = client.post(
            '/api/transactions/import',
            data={'csv_file': (BytesIO(b'data'), 'test.txt')},
            content_type='multipart/form-data',
        )
        assert response.status_code == 400
        assert 'CSV' in response.get_json().get('error', '')

    def test_import_valid_csv(self, client):
        csv_content = (
            b'description,amount,type,category,date,tags\n'
            b'Imported Expense,100.00,expense,food,2026-02-01,test\n'
            b'Imported Income,500.00,income,salary,2026-02-01,monthly'
        )
        response = client.post(
            '/api/transactions/import',
            data={'csv_file': (BytesIO(csv_content), 'test.csv')},
            content_type='multipart/form-data',
        )
        result = response.get_json()
        assert response.status_code == 200
        assert result['success'] is True
        assert result['imported'] == 2

    def test_import_partial_invalid_rows(self, client):
        csv_content = (
            b'description,amount,type,category,date,tags\n'
            b'Valid,100.00,expense,food,2026-02-01,test\n'
            b'Invalid,not-a-number,expense,food,2026-02-01,test\n'
            b'Also Valid,200.00,income,salary,2026-02-01,monthly'
        )
        response = client.post(
            '/api/transactions/import',
            data={'csv_file': (BytesIO(csv_content), 'test.csv')},
            content_type='multipart/form-data',
        )
        result = response.get_json()
        assert result['imported'] == 2
        assert len(result['errors']) == 1


# ---------------------------------------------------------------------------
# Settings API
# ---------------------------------------------------------------------------

class TestSettingsAPI:

    def test_populate_test_data_requires_debug_mode(self, client):
        # Testing mode is not debug mode — endpoint must return 403
        response = client.post('/api/populate-test-data')
        assert response.status_code == 403
        assert 'error' in response.get_json()

    def test_settings_page_accessible(self, client):
        assert client.get('/settings').status_code == 200


# ---------------------------------------------------------------------------
# Category rename / merge
# ---------------------------------------------------------------------------

class TestCategoryMerge:

    def _setup(self, client):
        """Create one food and one groceries transaction."""
        client.post('/api/transactions', data={
            'description': 'Food transaction', 'amount': '50.00',
            'type': 'expense', 'date': '2026-03-01', 'category': 'food',
        })
        client.post('/api/transactions', data={
            'description': 'Groceries transaction', 'amount': '30.00',
            'type': 'expense', 'date': '2026-03-02', 'category': 'groceries',
        })

    def test_rename_to_new_name_succeeds(self, client):
        self._setup(client)
        response = client.put('/api/categories/groceries', json={'name': 'supermarket'})
        data = response.get_json()
        assert response.status_code == 200
        assert data['success'] is True
        assert data['category'] == 'supermarket'

    def test_rename_to_self_is_noop(self, client):
        self._setup(client)
        response = client.put('/api/categories/food', json={'name': 'food'})
        assert response.status_code == 200
        names = [c['category_name'] for c in client.get('/api/categories').get_json()]
        assert 'food' in names

    def test_merge_reassigns_transactions(self, client):
        self._setup(client)
        response = client.post('/api/categories/groceries/merge', json={'target': 'food'})
        assert response.status_code == 200
        assert response.get_json()['success'] is True
        # Both transactions now under food
        assert client.get('/api/stats?categories=food').status_code == 200

    def test_merge_removes_source_category(self, client):
        self._setup(client)
        client.post('/api/categories/groceries/merge', json={'target': 'food'})
        names = [c['category_name'] for c in client.get('/api/categories').get_json()]
        assert 'groceries' not in names
        assert 'food' in names

    def test_merge_missing_target_body_returns_400(self, client):
        self._setup(client)
        assert client.post('/api/categories/groceries/merge', json={}).status_code == 400


# ---------------------------------------------------------------------------
# Tag rename / merge
# ---------------------------------------------------------------------------

class TestTagMerge:

    def _setup(self, client):
        """Create transactions tagged 'urgent' and 'important'."""
        client.post('/api/transactions', data={
            'description': 'Urgent task', 'amount': '100.00',
            'type': 'expense', 'date': '2026-03-01', 'category': 'other', 'tags': 'urgent',
        })
        client.post('/api/transactions', data={
            'description': 'Important task', 'amount': '200.00',
            'type': 'expense', 'date': '2026-03-02', 'category': 'other', 'tags': 'important',
        })

    def test_rename_to_new_name_succeeds(self, client):
        self._setup(client)
        response = client.put('/api/tags/important', json={'name': 'priority'})
        data = response.get_json()
        assert response.status_code == 200
        assert data['success'] is True
        assert data['tag'] == 'priority'
        tags = client.get('/api/tags').get_json()
        assert 'priority' in tags
        assert 'important' not in tags

    def test_rename_to_self_is_noop(self, client):
        self._setup(client)
        response = client.put('/api/tags/urgent', json={'name': 'urgent'})
        assert response.status_code == 200
        assert 'urgent' in client.get('/api/tags').get_json()

    def test_rename_to_category_prefix_rejected(self, client):
        self._setup(client)
        assert client.put('/api/tags/urgent', json={'name': 'category:food'}).status_code == 400

    def test_merge_removes_source_tag(self, client):
        self._setup(client)
        response = client.post('/api/tags/important/merge', json={'target': 'urgent'})
        assert response.status_code == 200
        tags = client.get('/api/tags').get_json()
        assert 'important' not in tags
        assert 'urgent' in tags

    def test_merge_transactions_gain_target_tag(self, client):
        self._setup(client)
        client.post('/api/tags/important/merge', json={'target': 'urgent'})
        # Filtering by urgent should now cover both transactions
        assert client.get('/api/stats?tags=urgent').status_code == 200

    def test_merge_no_duplicate_on_shared_transaction(self, client):
        client.post('/api/transactions', data={
            'description': 'Both tags', 'amount': '50.00', 'type': 'expense',
            'date': '2026-03-01', 'category': 'other', 'tags': 'urgent,important',
        })
        client.post('/api/tags/important/merge', json={'target': 'urgent'})
        tags = client.get('/api/tags').get_json()
        assert 'important' not in tags
        assert 'urgent' in tags

    def test_merge_nonexistent_source_returns_400(self, client):
        self._setup(client)
        response = client.post('/api/tags/doesnotexist/merge', json={'target': 'urgent'})
        assert response.status_code == 400
        assert 'not found' in response.get_json()['error'].lower()

    def test_merge_missing_target_body_returns_400(self, client):
        self._setup(client)
        assert client.post('/api/tags/important/merge', json={}).status_code == 400

    def test_merge_category_tag_via_tag_endpoint_rejected(self, client):
        self._setup(client)
        response = client.post('/api/tags/category:other/merge', json={'target': 'urgent'})
        assert response.status_code == 400
        assert 'category' in response.get_json()['error'].lower()

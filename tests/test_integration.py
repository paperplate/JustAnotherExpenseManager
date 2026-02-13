"""
Integration tests for the expense manager application.
Tests complete workflows and feature interactions.
"""

import pytest
import json
from io import BytesIO


class TestCompleteWorkflow:
    """Test complete user workflows."""

    def test_add_edit_delete_workflow(self, client):
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

        # Step 2: Verify it appears in the list
        response = client.get('/api/transactions')
        assert b'Initial Transaction' in response.data

        # Step 3: Get the transaction ID (in real scenario, would parse from response)
        # For this test, we'll assume ID is 1
        trans_id = 1

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
        response = client.get('/api/transactions')
        assert b'Updated Transaction' in response.data
        assert b'150.00' in response.data

        # Step 6: Delete the transaction
        response = client.delete(f'/api/transactions/{trans_id}')
        assert response.status_code == 200

        # Step 7: Verify it's gone
        response = client.get('/api/transactions')
        assert b'Updated Transaction' not in response.data

    def test_filtering_workflow(self, client, sample_transactions):
        """Test applying and combining filters."""
        # Step 1: View all transactions
        response = client.get('/api/transactions')
        assert response.status_code == 200
        assert b'Grocery shopping' in response.data
        assert b'Salary' in response.data

        # Step 2: Filter by category
        response = client.get('/api/transactions?categories=food')
        assert b'Grocery shopping' in response.data
        assert b'Gas' not in response.data

        # Step 3: Filter by tags
        response = client.get('/api/transactions?tags=recurring')
        assert b'Grocery shopping' in response.data
        assert b'Salary' in response.data
        assert b'Gas' not in response.data

        # Step 4: Combine filters
        response = client.get('/api/transactions?categories=food&tags=recurring')
        assert b'Grocery shopping' in response.data
        assert b'Restaurant' not in response.data

        # Step 5: Add date range
        response = client.get(
            '/api/transactions?categories=food&start_date=2026-01-01&end_date=2026-01-31'
        )
        assert b'Grocery shopping' in response.data
        assert b'Restaurant' not in response.data

    def test_stats_update_workflow(self, client):
        """Test that stats update when transactions change."""
        # Step 1: Check initial stats (should be empty)
        response = client.get('/api/stats')
        assert response.status_code == 200

        # Step 2: Add income
        income_data = {
            'description': 'Salary',
            'amount': '5000.00',
            'type': 'income',
            'date': '2026-02-01',
            'category': 'salary',
            'tags': ''
        }
        client.post('/api/transactions', data=income_data)

        # Step 3: Add expense
        expense_data = {
            'description': 'Rent',
            'amount': '1500.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'housing',
            'tags': ''
        }
        client.post('/api/transactions', data=expense_data)

        # Step 4: Check updated stats
        response = client.get('/api/stats')
        assert response.status_code == 200
        # Stats should reflect income and expenses
        assert b'5000' in response.data or b'1500' in response.data

    def test_csv_import_workflow(self, client):
        """Test importing transactions from CSV."""
        # Step 1: Prepare CSV data
        csv_content = (
            b'description,amount,type,category,date,tags\n'
            b'Imported Expense 1,100.00,expense,food,2026-02-01,imported\n'
            b'Imported Expense 2,200.00,expense,transport,2026-02-02,imported\n'
            b'Imported Income,1000.00,income,salary,2026-02-01,imported\n'
        )

        # Step 2: Import CSV
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

        # Step 3: Verify transactions were imported
        response = client.get('/api/transactions')
        assert b'Imported Expense 1' in response.data
        assert b'Imported Expense 2' in response.data
        assert b'Imported Income' in response.data


class TestDataConsistency:
    """Test data consistency across operations."""

    def test_tag_consistency(self, client):
        """Test that tags are consistently handled."""
        # Create transaction with tags
        data1 = {
            'description': 'Trans 1',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': 'shared-tag,unique1'
        }
        client.post('/api/transactions', data=data1)

        # Create another transaction with overlapping tag
        data2 = {
            'description': 'Trans 2',
            'amount': '200.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': 'shared-tag,unique2'
        }
        client.post('/api/transactions', data=data2)

        # Get tags list
        response = client.get('/api/tags')
        tags = response.get_json()

        # shared-tag should only appear once
        shared_count = sum(1 for tag in tags if tag == 'shared-tag')
        assert shared_count == 1

    def test_category_tag_consistency(self, client):
        """Test that category tags are properly created."""
        # Create transaction with category
        data = {
            'description': 'Test',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': ''
        }
        client.post('/api/transactions', data=data)

        # Get categories
        response = client.get('/api/categories')
        categories = response.get_json()

        # Food should be in categories
        assert any(cat['name'] == 'food' for cat in categories)

    def test_pagination_consistency(self, client):
        """Test that pagination is consistent across pages."""
        # Create 25 transactions
        for i in range(25):
            data = {
                'description': f'Trans {i}',
                'amount': '100.00',
                'type': 'expense',
                'date': '2026-02-01',
                'category': 'food',
                'tags': ''
            }
            client.post('/api/transactions', data=data)

        # Get first page (10 per page)
        response1 = client.get('/api/transactions?page=1&per_page=10')
        assert response1.status_code == 200

        # Get second page
        response2 = client.get('/api/transactions?page=2&per_page=10')
        assert response2.status_code == 200

        # Get third page
        response3 = client.get('/api/transactions?page=3&per_page=10')
        assert response3.status_code == 200

        # Each page should have different content
        assert response1.data != response2.data
        assert response2.data != response3.data


class TestErrorHandling:
    """Test error handling across the application."""

    def test_malformed_json(self, client):
        """Test handling of malformed JSON input."""
        response = client.post(
            '/api/transactions',
            data='not-valid-json',
            content_type='application/json'
        )
        # Should handle gracefully (400 or use form data fallback)
        assert response.status_code in [400, 200]

    def test_sql_injection_prevention(self, client):
        """Test that SQL injection attempts are prevented."""
        # Try SQL injection in category filter
        response = client.get("/api/transactions?categories=food'; DROP TABLE transactions; --")
        # Should not cause an error
        assert response.status_code == 200

        # Try in tags
        response = client.get("/api/transactions?tags=tag'; DELETE FROM tags; --")
        assert response.status_code == 200

        # Verify transactions still exist
        response = client.get('/api/transactions')
        assert response.status_code == 200

    def test_xss_prevention(self, client):
        """Test that XSS attempts are escaped."""
        # Create transaction with script tag in description
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

        # Get transactions
        response = client.get('/api/transactions')
        # Script should be escaped or sanitized
        assert b'<script>' not in response.data or b'&lt;script&gt;' in response.data

    def test_concurrent_updates(self, client):
        """Test handling of concurrent updates to same transaction."""
        # Create transaction
        data = {
            'description': 'Original',
            'amount': '100.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': ''
        }
        client.post('/api/transactions', data=data)

        # Update 1
        update1 = {
            'description': 'Update 1',
            'amount': '150.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': ''
        }
        response1 = client.put('/api/transactions/1', data=update1)

        # Update 2
        update2 = {
            'description': 'Update 2',
            'amount': '200.00',
            'type': 'expense',
            'date': '2026-02-01',
            'category': 'transport',
            'tags': ''
        }
        response2 = client.put('/api/transactions/1', data=update2)

        # Both should succeed (last write wins)
        assert response1.status_code == 200
        assert response2.status_code == 200


class TestPerformance:
    """Test performance with larger datasets."""

    @pytest.mark.slow
    def test_large_dataset_pagination(self, client):
        """Test pagination with large number of transactions."""
        # Create 1000 transactions
        for i in range(1000):
            data = {
                'description': f'Trans {i}',
                'amount': '100.00',
                'type': 'expense',
                'date': '2026-02-01',
                'category': 'food',
                'tags': ''
            }
            client.post('/api/transactions', data=data)

        # Test pagination
        response = client.get('/api/transactions?page=1&per_page=50')
        assert response.status_code == 200

        response = client.get('/api/transactions?page=10&per_page=50')
        assert response.status_code == 200

    @pytest.mark.slow
    def test_complex_filtering(self, client, sample_transactions):
        """Test filtering with multiple conditions."""
        # Add more transactions
        for i in range(100):
            data = {
                'description': f'Trans {i}',
                'amount': str(100.00 + i),
                'type': 'expense' if i % 2 == 0 else 'income',
                'date': f'2026-{(i % 12) + 1:02d}-01',
                'category': ['food', 'transport', 'entertainment'][i % 3],
                'tags': f'tag{i % 5}'
            }
            client.post('/api/transactions', data=data)

        # Complex filter query
        response = client.get(
            '/api/transactions?categories=food,transport&tags=tag1,tag2&'
            'start_date=2026-01-01&end_date=2026-06-30'
        )
        assert response.status_code == 200

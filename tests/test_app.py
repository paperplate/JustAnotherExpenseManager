#!/usr/bin/env python3
"""
Unit tests for the Expense Manager application
"""

import unittest
import os
import json
import tempfile
from io import BytesIO
import sys

# Add parent directory to path to import app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

class ExpenseManagerTestCase(unittest.TestCase):
    """Test cases for Expense Manager application"""

    def setUp(self):
        """Set up test client and initialize database"""
        # Create temp database file
        self.db_fd, self.db_path = tempfile.mkstemp()
        os.environ['DATABASE_TYPE'] = 'sqlite'
        os.environ['SQLITE_PATH'] = self.db_path

        # Import app after setting environment variables
        import app as app_module
        self.app_module = app_module
        self.app = app_module.app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

        # Initialize database
        from utils.database import init_db
        init_db()

    def tearDown(self):
        """Clean up after tests"""
        # Close database connections
        self.app_module.SessionLocal.remove()
        self.app_module.engine.dispose()

        # Remove temp file
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def test_index_page(self):
        """Test that index page loads successfully"""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Expense Manager', response.data)

    def test_add_expense(self):
        """Test adding a new expense"""
        response = self.client.post('/api/transactions', data={
            'description': 'Test Expense',
            'amount': '50.00',
            'type': 'expense',
            'category': 'food',
            'date': '2024-01-15'
        })
        self.assertEqual(response.status_code, 200)

        # Verify expense was added
        response = self.client.get('/api/transactions')
        self.assertIn(b'Test Expense', response.data)
        self.assertIn(b'50.00', response.data)

    def test_delete_expense(self):
        """Test deleting an expense"""
        # First add an expense
        self.client.post('/api/transactions', data={
            'description': 'To Delete',
            'amount': '25.00',
            'type': 'expense',
            'category': 'other',
            'date': '2024-01-15'
        })

        # Get the transaction ID
        from models import Transaction
        db = self.app_module.get_db()
        transaction = db.query(Transaction).filter_by(description='To Delete').first()
        transaction_id = transaction.id
        db.close()

        # Delete the transaction
        response = self.client.delete(f'/api/transactions/{transaction_id}')
        self.assertEqual(response.status_code, 200)

        # Verify it's gone
        response = self.client.get('/api/transactions')
        self.assertNotIn(b'To Delete', response.data)

    def test_get_stats(self):
        """Test statistics endpoint"""
        # Add some test transactions
        self.client.post('/api/transactions', data={
            'description': 'Food 1',
            'amount': '20.00',
            'type': 'expense',
            'category': 'food',
            'date': '2024-01-15'
        })
        self.client.post('/api/transactions', data={
            'description': 'Food 2',
            'amount': '30.00',
            'type': 'expense',
            'category': 'food',
            'date': '2024-01-16'
        })

        response = self.client.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Total', response.data)

    def test_chart_data_api(self):
        """Test chart data API endpoint"""
        # Test with empty database or existing data from previous tests
        response = self.client.get('/api/chart-data')
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertIn('categories', data)
        self.assertIn('monthly', data)
        self.assertIsInstance(data['categories']['labels'], list)
        self.assertIsInstance(data['categories']['expenses'], list)

    def test_csv_import_success(self):
        """Test successful CSV import"""
        csv_content = b"""description,amount,type,category,date,tags
Grocery Store,45.50,expense,food,2024-01-15,
Gas Station,60.00,expense,transport,2024-01-16,
Movie Theater,25.00,expense,entertainment,2024-01-17,"""

        response = self.client.post('/api/transactions/import',
            data={'csv_file': (BytesIO(csv_content), 'test.csv')},
            content_type='multipart/form-data'
        )

        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)
        self.assertTrue(result['success'])
        self.assertEqual(result['imported'], 3)

        # Verify transactions were imported
        response = self.client.get('/api/transactions')
        self.assertIn(b'Grocery Store', response.data)
        self.assertIn(b'Gas Station', response.data)
        self.assertIn(b'Movie Theater', response.data)

    def test_csv_import_validation(self):
        """Test CSV import with validation errors"""
        csv_content = b"""description,amount,type,category,date,tags
Valid Expense,25.00,expense,food,2024-01-15,
Invalid Amount,not_a_number,expense,food,2024-01-16,
Missing Description,,50.00,expense,food,2024-01-15,
Invalid Date,30.00,expense,food,2024-13-45,"""

        response = self.client.post('/api/transactions/import',
            data={'csv_file': (BytesIO(csv_content), 'test.csv')},
            content_type='multipart/form-data'
        )

        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)
        self.assertTrue(result['success'])
        self.assertEqual(result['imported'], 1)  # Only the valid one
        self.assertEqual(len(result['errors']), 3)  # Three errors

    def test_csv_import_no_file(self):
        """Test CSV import without file"""
        response = self.client.post('/api/transactions/import',
            data={},
            content_type='multipart/form-data'
        )

        self.assertEqual(response.status_code, 400)
        result = json.loads(response.data)
        self.assertIn('error', result)

    def test_csv_import_wrong_extension(self):
        """Test CSV import with wrong file extension"""
        response = self.client.post('/api/transactions/import',
            data={'csv_file': (BytesIO(b'test'), 'test.txt')},
            content_type='multipart/form-data'
        )

        self.assertEqual(response.status_code, 400)
        result = json.loads(response.data)
        self.assertIn('must be a CSV', result['error'])

    def test_multiple_transactions(self):
        """Test adding multiple transactions and querying them"""
        transactions = [
            {'description': 'Expense 1', 'amount': '10.00', 'type': 'expense', 'category': 'food', 'date': '2024-01-01'},
            {'description': 'Expense 2', 'amount': '20.00', 'type': 'expense', 'category': 'transport', 'date': '2024-01-02'},
            {'description': 'Expense 3', 'amount': '30.00', 'type': 'expense', 'category': 'shopping', 'date': '2024-01-03'},
        ]

        for transaction in transactions:
            self.client.post('/api/transactions', data=transaction)

        response = self.client.get('/api/transactions')
        for transaction in transactions:
            self.assertIn(transaction['description'].encode(), response.data)

    def test_database_persistence(self):
        """Test that database operations persist correctly"""
        # Add transaction
        self.client.post('/api/transactions', data={
            'description': 'Persistent Test',
            'amount': '99.99',
            'type': 'expense',
            'category': 'other',
            'date': '2024-01-15'
        })

        # Query database directly
        from models import Transaction
        db = self.app_module.get_db()
        result = db.query(Transaction).filter_by(description='Persistent Test').first()
        db.close()

        self.assertIsNotNone(result)
        self.assertEqual(result.description, 'Persistent Test')
        self.assertEqual(float(result.amount), 99.99)


def run_tests():
    """Run all tests"""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    suite.addTests(loader.loadTestsFromTestCase(ExpenseManagerTestCase))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Return exit code
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    sys.exit(run_tests())

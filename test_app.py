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
        app_module.init_db()
    
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
        response = self.client.post('/expenses', data={
            'description': 'Test Expense',
            'amount': '50.00',
            'category': 'food',
            'date': '2024-01-15'
        })
        self.assertEqual(response.status_code, 200)
        
        # Verify expense was added
        response = self.client.get('/expenses')
        self.assertIn(b'Test Expense', response.data)
        self.assertIn(b'50.00', response.data)
    
    def test_delete_expense(self):
        """Test deleting an expense"""
        # First add an expense
        self.client.post('/expenses', data={
            'description': 'To Delete',
            'amount': '25.00',
            'category': 'other',
            'date': '2024-01-15'
        })
        
        # Get the expense ID
        db = self.app_module.get_db()
        expense = db.query(self.app_module.Expense).filter_by(description='To Delete').first()
        expense_id = expense.id
        db.close()
        
        # Delete the expense
        response = self.client.delete(f'/expenses/{expense_id}')
        self.assertEqual(response.status_code, 200)
        
        # Verify it's gone
        response = self.client.get('/expenses')
        self.assertNotIn(b'To Delete', response.data)
    
    def test_get_stats(self):
        """Test statistics endpoint"""
        # Add some test expenses
        self.client.post('/expenses', data={
            'description': 'Food 1',
            'amount': '20.00',
            'category': 'food',
            'date': '2024-01-15'
        })
        self.client.post('/expenses', data={
            'description': 'Food 2',
            'amount': '30.00',
            'category': 'food',
            'date': '2024-01-16'
        })
        
        response = self.client.get('/stats')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Total Expenses', response.data)
        self.assertIn(b'stat-value', response.data)
    
    def test_chart_data_api(self):
        """Test chart data API endpoint"""
        # Test with empty database or existing data from previous tests
        response = self.client.get('/api/chart-data')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertIn('categories', data)
        self.assertIn('monthly', data)
        self.assertIsInstance(data['categories']['labels'], list)
        self.assertIsInstance(data['categories']['data'], list)
    
    def test_csv_import_success(self):
        """Test successful CSV import"""
        csv_content = b"""description,amount,category,date
Grocery Store,45.50,food,2024-01-15
Gas Station,60.00,transport,2024-01-16
Movie Theater,25.00,entertainment,2024-01-17"""
        
        response = self.client.post('/expenses/import',
            data={'csv_file': (BytesIO(csv_content), 'test.csv')},
            content_type='multipart/form-data'
        )
        
        self.assertEqual(response.status_code, 200)
        result = json.loads(response.data)
        self.assertTrue(result['success'])
        self.assertEqual(result['imported'], 3)
        
        # Verify expenses were imported
        response = self.client.get('/expenses')
        self.assertIn(b'Grocery Store', response.data)
        self.assertIn(b'Gas Station', response.data)
        self.assertIn(b'Movie Theater', response.data)
    
    def test_csv_import_validation(self):
        """Test CSV import with validation errors"""
        csv_content = b"""description,amount,category,date
Valid Expense,25.00,food,2024-01-15
Invalid Amount,not_a_number,food,2024-01-16
Invalid Category,50.00,invalid_cat,2024-01-17
Invalid Date,30.00,food,2024-13-45"""
        
        response = self.client.post('/expenses/import',
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
        response = self.client.post('/expenses/import',
            data={},
            content_type='multipart/form-data'
        )
        
        self.assertEqual(response.status_code, 400)
        result = json.loads(response.data)
        self.assertIn('error', result)
    
    def test_csv_import_wrong_extension(self):
        """Test CSV import with wrong file extension"""
        response = self.client.post('/expenses/import',
            data={'csv_file': (BytesIO(b'test'), 'test.txt')},
            content_type='multipart/form-data'
        )
        
        self.assertEqual(response.status_code, 400)
        result = json.loads(response.data)
        self.assertIn('must be a CSV', result['error'])
    
    def test_multiple_expenses(self):
        """Test adding multiple expenses and querying them"""
        expenses = [
            {'description': 'Expense 1', 'amount': '10.00', 'category': 'food', 'date': '2024-01-01'},
            {'description': 'Expense 2', 'amount': '20.00', 'category': 'transport', 'date': '2024-01-02'},
            {'description': 'Expense 3', 'amount': '30.00', 'category': 'shopping', 'date': '2024-01-03'},
        ]
        
        for expense in expenses:
            self.client.post('/expenses', data=expense)
        
        response = self.client.get('/expenses')
        for expense in expenses:
            self.assertIn(expense['description'].encode(), response.data)
    
    def test_database_persistence(self):
        """Test that database operations persist correctly"""
        # Add expense
        self.client.post('/expenses', data={
            'description': 'Persistent Test',
            'amount': '99.99',
            'category': 'other',
            'date': '2024-01-15'
        })
        
        # Query database directly
        db = self.app_module.get_db()
        result = db.query(self.app_module.Expense).filter_by(description='Persistent Test').first()
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

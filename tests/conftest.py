"""
Pytest configuration file for the expense manager application.
Defines fixtures and test configuration.

Note: Pytest configuration (markers, coverage, etc.) is now in pyproject.toml
under [tool.pytest.ini_options]. This file only contains fixtures.
"""

import os
import tempfile
import pytest
from JustAnotherExpenseManager import create_app
from utils.database import init_db, get_db


@pytest.fixture(scope='session')
def app():
    """
    Create and configure a test Flask application instance.
    This fixture is session-scoped, so it's created once per test session.
    """
    # Create a temporary file for the test database
    db_fd, db_path = tempfile.mkstemp()

    # Configure app for testing
    test_config = {
        'TESTING': True,
        'DATABASE': db_path,
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret-key'
    }

    app = create_app(test_config)

    # Initialize the database
    with app.app_context():
        init_db()

    yield app

    # Cleanup: close and remove the temporary database
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture(scope='function')
def client(app):
    """
    Create a test client for the Flask application.
    This fixture is function-scoped, so a fresh client is created for each test.
    """
    return app.test_client()


@pytest.fixture(scope='function')
def runner(app):
    """
    Create a CLI runner for testing Flask CLI commands.
    """
    return app.test_cli_runner()


@pytest.fixture(scope='function')
def db(app):
    """
    Provide a database connection for tests.
    This fixture ensures each test has a fresh database state.
    """
    with app.app_context():
        connection = get_db()
        yield connection
        connection.close()


@pytest.fixture(scope='function')
def sample_transactions(app, db):
    """
    Create sample transactions for testing.
    This fixture populates the database with test data.
    """
    from utils.services import TransactionService

    service = TransactionService(db)

    # Create sample transactions
    transactions = [
        {
            'description': 'Grocery shopping',
            'amount': 150.50,
            'trans_type': 'expense',
            'date': '2026-01-15',
            'category': 'food',
            'tags': ['recurring', 'planned']
        },
        {
            'description': 'Salary',
            'amount': 5000.00,
            'trans_type': 'income',
            'date': '2026-01-01',
            'category': 'salary',
            'tags': ['recurring']
        },
        {
            'description': 'Gas',
            'amount': 45.00,
            'trans_type': 'expense',
            'date': '2026-01-20',
            'category': 'transport',
            'tags': []
        },
        {
            'description': 'Restaurant',
            'amount': 75.25,
            'trans_type': 'expense',
            'date': '2026-02-01',
            'category': 'food',
            'tags': ['dining']
        }
    ]

    created_transactions = []
    for trans_data in transactions:
        trans_id = service.create_transaction(**trans_data)
        created_transactions.append(trans_id)

    db.commit()

    return created_transactions


@pytest.fixture(autouse=True)
def reset_database(app):
    """
    Reset the database before each test.
    This fixture runs automatically before each test function.
    """
    with app.app_context():
        db = get_db()
        # Clear all tables
        db.execute('DELETE FROM transaction_tags')
        db.execute('DELETE FROM transactions')
        db.execute('DELETE FROM tags')
        db.commit()

    yield

    # Cleanup after test
    with app.app_context():
        db = get_db()
        db.execute('DELETE FROM transaction_tags')
        db.execute('DELETE FROM transactions')
        db.execute('DELETE FROM tags')
        db.commit()
        db.close()

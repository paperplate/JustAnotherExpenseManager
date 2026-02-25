"""
Pytest configuration file for the expense manager application.
Defines fixtures and test configuration.

Note: Pytest configuration (markers, coverage, etc.) is now in pyproject.toml
under [tool.pytest.ini_options]. This file only contains fixtures.
"""

import os
import tempfile
import pytest
from sqlalchemy import delete as sa_delete
from JustAnotherExpenseManager import create_app
from JustAnotherExpenseManager.utils.database import create_database_manager, db
from JustAnotherExpenseManager.models import Transaction, Tag, transaction_tags


def _clear_tables(session):
    """Delete all rows from transactional tables in dependency order."""
    session.execute(sa_delete(transaction_tags))
    session.query(Transaction).delete(synchronize_session=False)
    session.query(Tag).delete(synchronize_session=False)
    session.commit()


@pytest.fixture(scope='session')
def app():
    """
    Create and configure a test Flask application instance.
    This fixture is session-scoped, so it's created once per test session.
    """
    # Create a temporary file for the test database
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(db_fd)

    # Create a dedicated DatabaseManager for testing using the temp SQLite file
    db_manager = create_database_manager(
        db_type='sqlite',
        sqlite_path=db_path
    )

    # Configure app for testing
    test_config = {
        'TESTING': True,
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret-key'
    }

    app = create_app(test_config, db_manager=db_manager)

    yield app

    # Cleanup: dispose engine and remove the temporary database
    with app.app_context():
        db_manager.close_all_connections()
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
    Provide a database session for tests.
    This fixture ensures each test has a fresh database state.
    """
    session = app.db_manager.get_session()
    yield session
    session.close()


@pytest.fixture(scope='function')
def sample_transactions(app, db):
    """
    Create sample transactions for testing.
    This fixture populates the database with test data.
    """
    from JustAnotherExpenseManager.utils.services import TransactionService

    service = TransactionService(db)

    from JustAnotherExpenseManager.models import TransactionType

    # Create sample transactions using the current service API
    transactions_data = [
        {
            'description': 'Grocery shopping',
            'amount_dollars': 150.50,
            'type': TransactionType.EXPENSE,
            'date': '2026-01-15',
            'category': 'food',
            'tags': ['recurring', 'planned']
        },
        {
            'description': 'Salary',
            'amount_dollars': 5000.00,
            'type': TransactionType.INCOME,
            'date': '2026-01-01',
            'category': 'salary',
            'tags': ['recurring']
        },
        {
            'description': 'Gas',
            'amount_dollars': 45.00,
            'type': TransactionType.EXPENSE,
            'date': '2026-01-20',
            'category': 'transport',
            'tags': []
        },
        {
            'description': 'Restaurant',
            'amount_dollars': 75.25,
            'type': TransactionType.EXPENSE,
            'date': '2026-02-01',
            'category': 'food',
            'tags': ['dining']
        }
    ]

    created_transactions = []
    for trans_data in transactions_data:
        trans_id = service.create_transaction(**trans_data)
        created_transactions.append(trans_id)

    db.commit()

    return created_transactions


@pytest.fixture(autouse=True)
def reset_database(app):
    """
    Reset the database before and after each test.
    Clears junction table first to avoid FK/stale-data issues.
    """
    with app.app_context():
        session = app.db_manager.get_session()
        try:
            _clear_tables(session)
        finally:
            session.close()

    yield

    with app.app_context():
        session = app.db_manager.get_session()
        try:
            _clear_tables(session)
        finally:
            session.close()

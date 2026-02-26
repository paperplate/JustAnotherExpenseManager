"""
Sample data loader for development and manual database seeding.

Used by the `flask init-db --sample-data` CLI command.
Not intended for use in production or automated tests.
"""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session


def load_sample_data(session: Session) -> None:
    """
    Load a small set of fixed sample transactions into the database.

    Args:
        session: SQLAlchemy session to use for inserting data.
    """
    from JustAnotherExpenseManager.models import Transaction, Tag

    try:
        sample_transactions = [
            {
                'description': 'Monthly Salary',
                'amount': 5000.00,
                'type': 'income',
                'date': (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d'),
            },
            {
                'description': 'Grocery Shopping',
                'amount': 125.50,
                'type': 'expense',
                'date': (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d'),
            },
            {
                'description': 'Gas Station',
                'amount': 45.00,
                'type': 'expense',
                'date': (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d'),
            },
            {
                'description': 'Restaurant Dinner',
                'amount': 85.30,
                'type': 'expense',
                'date': (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d'),
            },
            {
                'description': 'Freelance Project',
                'amount': 1500.00,
                'type': 'income',
                'date': (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'),
            },
        ]

        food_category = session.query(Tag).filter_by(name='category:food').first()
        transport_category = session.query(Tag).filter_by(name='category:transport').first()
        salary_category = session.query(Tag).filter_by(name='category:salary').first()

        for i, trans_data in enumerate(sample_transactions):
            transaction = Transaction(**trans_data)

            if i == 1:  # Grocery
                transaction.tags.append(food_category)
            elif i == 2:  # Gas
                transaction.tags.append(transport_category)
            elif i == 3:  # Restaurant
                transaction.tags.append(food_category)
            elif i in (0, 4):  # Salary / Freelance
                transaction.tags.append(salary_category)

            session.add(transaction)

        session.commit()
    except Exception as e:
        session.rollback()
        raise e

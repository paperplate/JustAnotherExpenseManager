"""
Test data service for generating randomised sample transactions.

Used by the `/api/populate-test-data` endpoint (debug mode only).
Not intended for use in production or automated tests.
"""

import random
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from JustAnotherExpenseManager.models import Transaction, Tag, TransactionType


class TestDataService:
    """Service class for generating randomised test data."""

    def __init__(self, db_session: Session) -> None:
        """Initialize TestDataService."""
        self.db = db_session

    def populate_test_data(self) -> Tuple[int, Optional[str]]:
        """
        Generate randomised test transactions covering the last 90 days.

        Returns:
            Tuple of (count, error_message)
        """
        try:
            expense_descriptions = [
                ("Grocery Store", "food", 50, 150),
                ("Gas Station", "transport", 30, 80),
                ("Restaurant", "food", 20, 100),
                ("Coffee Shop", "food", 3, 15),
                ("Electric Bill", "utilities", 80, 150),
                ("Internet Bill", "utilities", 50, 100),
                ("Movie Theater", "entertainment", 15, 50),
                ("Pharmacy", "healthcare", 10, 80),
                ("Clothing Store", "shopping", 30, 200),
                ("Uber", "transport", 10, 40),
                ("Gym Membership", "healthcare", 30, 100),
                ("Book Store", "entertainment", 10, 50),
            ]

            income_descriptions = [
                ("Monthly Salary", "salary", 3000, 6000),
                ("Freelance Project", "freelance", 500, 2000),
                ("Investment Return", "investment", 100, 500),
            ]

            today = datetime.now().date()
            transaction_count = 0

            for days_ago in range(90):
                date = (today - timedelta(days=days_ago)).strftime('%Y-%m-%d')

                num_expenses = random.randint(0, 3)
                for _ in range(num_expenses):
                    desc, category, min_amt, max_amt = random.choice(expense_descriptions)
                    amount = round(random.uniform(min_amt, max_amt), 2)

                    transaction = Transaction(
                        description=desc,
                        amount_dollars=amount,
                        type=TransactionType.EXPENSE,
                        date=date
                    )

                    category_tag = self._get_or_create_tag(f'category:{category}')
                    transaction.add_tag(category_tag)

                    self.db.add(transaction)
                    transaction_count += 1

                if random.random() < 0.1:  # 10% chance per day
                    desc, category, min_amt, max_amt = random.choice(income_descriptions)
                    amount = round(random.uniform(min_amt, max_amt), 2)

                    transaction = Transaction(
                        description=desc,
                        amount_dollars=amount,
                        type=TransactionType.INCOME,
                        date=date
                    )

                    category_tag = self._get_or_create_tag(f'category:{category}')
                    transaction.add_tag(category_tag)

                    if random.random() < 0.3:
                        tag = self._get_or_create_tag('recurring')
                        transaction.add_tag(tag)

                    self.db.add(transaction)
                    transaction_count += 1

            self.db.commit()
            return transaction_count, None

        except Exception as e:
            self.db.rollback()
            return 0, str(e)

    def _get_or_create_tag(self, tag_name: str) -> Tag:
        """Get existing tag or create a new one."""
        tag = self.db.query(Tag).filter_by(name=tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            self.db.add(tag)
            self.db.flush()
        return tag

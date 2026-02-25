"""
Database models for the Expense Manager application.

This module uses integer storage for monetary amounts (stored in cents)
and proper enums for transaction types.
"""

import enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import Column, Integer, String, DateTime, Table, ForeignKey, Enum
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property

from JustAnotherExpenseManager.utils.database import db


class TransactionType(enum.Enum):
    """Enum for transaction types."""
    INCOME = "income"
    EXPENSE = "expense"

    def __str__(self):
        return self.value


# Association table for transaction-tag relationship
transaction_tags = Table(
    'transaction_tags',
    db.metadata,
    Column('transaction_id', Integer, ForeignKey('transactions.id', ondelete='CASCADE')),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'))
)


class Tag(db.Model):
    """Tag model for categorization and labeling."""

    __tablename__ = 'tags'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transactions = relationship(
        'Transaction',
        secondary=transaction_tags,
        back_populates='tags',
        lazy='select'
    )

    @property
    def is_category(self) -> bool:
        """Check if this tag is a category."""
        return self.name.startswith('category:')

    @property
    def category_name(self) -> Optional[str]:
        """Get the category name without the 'category:' prefix."""
        if self.is_category:
            return self.name.replace('category:', '')
        return None

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert tag to dictionary representation.

        Returns:
            Dict containing tag data
        """
        return {
            'id': self.id,
            'name': self.name,
            'is_category': self.is_category,
            'category_name': self.category_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self) -> str:
        return f"<Tag(id={self.id}, name='{self.name}')>"


class Transaction(db.Model):
    """
    Transaction model for both income and expenses.

    Amounts are stored as integers (cents) to avoid floating-point precision issues.
    Use the `amount_dollars` property to get/set values in dollars.
    """

    __tablename__ = 'transactions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    description = Column(String(500), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    type = Column(Enum(TransactionType), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD format
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    tags = relationship(
        'Tag',
        secondary=transaction_tags,
        back_populates='transactions',
        lazy='joined'
    )

    def __init__(
        self,
        description: str,
        amount_dollars: float,
        type: TransactionType,
        date: str,
        **kwargs
    ):
        """
        Initialize a Transaction.

        Args:
            description: Transaction description
            amount_dollars: Amount in dollars (will be converted to cents)
            type: TransactionType enum value
            date: Date in YYYY-MM-DD format
            **kwargs: Additional arguments
        """
        super().__init__(**kwargs)
        self.description = description
        self.amount_dollars = amount_dollars
        self.type = type
        self.date = date

    @hybrid_property
    def amount_dollars(self) -> float:
        """
        Get amount as a float (in dollars).

        Returns:
            Amount in dollars
        """
        return self.amount_cents / 100.0

    @amount_dollars.setter
    def amount_dollars(self, value: float) -> None:
        """
        Set amount from a float (in dollars).

        Args:
            value: Amount in dollars

        Raises:
            ValueError: If amount is negative
        """
        if value < 0:
            raise ValueError("Amount cannot be negative")
        self.amount_cents = round(value * 100)

    @validates('description')
    def validate_description(self, key: str, description: str) -> str:
        """
        Validate description field.

        Args:
            key: Field name
            description: Description value

        Returns:
            Validated description

        Raises:
            ValueError: If description is empty
        """
        if not description or not description.strip():
            raise ValueError("Description cannot be empty")
        return description.strip()

    @validates('date')
    def validate_date(self, key: str, date: str) -> str:
        """
        Validate date field.

        Args:
            key: Field name
            date: Date value

        Returns:
            Validated date string

        Raises:
            ValueError: If date format is invalid
        """
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError as exc:
            raise ValueError(f"Invalid date format: {date}. Expected YYYY-MM-DD") from exc
        return date

    @validates('amount_cents')
    def validate_amount_cents(self, key: str, amount_cents: int) -> int:
        """
        Validate amount_cents field.

        Args:
            key: Field name
            amount_cents: Amount in cents

        Returns:
            Validated amount

        Raises:
            ValueError: If amount is negative
        """
        if amount_cents < 0:
            raise ValueError("Amount cannot be negative")
        return amount_cents

    @property
    def category(self) -> Optional[str]:
        """
        Get the first category tag associated with this transaction.

        Returns:
            Category name without 'category:' prefix, or None
        """
        for tag in self.tags:
            if tag.is_category:
                return tag.category_name
        return None

    @property
    def non_category_tags(self) -> List[str]:
        """
        Get all non-category tags.

        Returns:
            List of tag names
        """
        return [tag.name for tag in self.tags if not tag.is_category]

    @property
    def is_income(self) -> bool:
        """Check if this is an income transaction."""
        return self.type == TransactionType.INCOME

    @property
    def is_expense(self) -> bool:
        """Check if this is an expense transaction."""
        return self.type == TransactionType.EXPENSE

    def add_tag(self, tag: Tag) -> None:
        """
        Add a tag to this transaction.

        Args:
            tag: Tag instance to add
        """
        if tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: Tag) -> None:
        """
        Remove a tag from this transaction.

        Args:
            tag: Tag instance to remove
        """
        if tag in self.tags:
            self.tags.remove(tag)

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert transaction to dictionary representation.

        Returns:
            Dict containing transaction data with amount in dollars
        """
        return {
            'id': self.id,
            'description': self.description,
            'amount': self.amount_dollars,
            'amount_cents': self.amount_cents,
            'type': self.type.value,
            'date': self.date,
            'tags': [tag.name for tag in self.tags],
            'category': self.category,
            'non_category_tags': self.non_category_tags,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self) -> str:
        return (
            f"<Transaction(id={self.id}, type={self.type.value}, "
            f"amount=${self.amount_dollars:.2f})>"
        )

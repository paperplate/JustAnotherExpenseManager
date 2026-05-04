"""
Database models for the Expense Manager application.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import Column, Integer, String, Table, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column

from JustAnotherExpenseManager.utils.database import db, Base
from JustAnotherExpenseManager.models.dtos import TransactionType


utcnow = lambda: datetime.now(timezone.utc).replace(tzinfo=None)
DT_FORMAT = '%Y-%m-%d'

# Association table for transaction-tag relationship
transaction_tags = Table(
    'transaction_tags',
    db.metadata,
    Column('transaction_id', Integer, ForeignKey('transactions.id', ondelete='CASCADE'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)


class Tag(Base):
    """Tag model for categorization and labeling."""

    __tablename__ = 'tags'

    transactions: Mapped[List['Transaction']] = relationship(
        secondary=transaction_tags,
        back_populates='tags',
        lazy='select',
        init=False
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, init=False)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0, server_default='0')
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False, init=False)

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
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self) -> str:
        return f"<Tag(id={self.id}, name='{self.name}')>"


class Transaction(Base):
    """
    Transaction model for both income and expenses.
    """

    __tablename__ = 'transactions'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, init=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount_cents: Mapped[int] = mapped_column(nullable=False)
    type: Mapped[TransactionType] = mapped_column(nullable=False, index=True)
    date: Mapped[datetime] = mapped_column(nullable=False, index=True)  # YYYY-MM-DD format
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False, init=False)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow, nullable=False, init=False)

    tags: Mapped[Optional[List['Tag']]] = relationship(
        secondary=transaction_tags,
        back_populates='transactions',
        lazy='select'
    )

    @property
    def category(self) -> Optional[str]:
        """
        Get the first category tag associated with this transaction.

        Returns:
            Category name without 'category:' prefix, or None
        """
        if not self.tags:
            return None

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
        return [tag.name for tag in self.tags if not tag.is_category] if self.tags else []

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
        if self.tags and tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: Tag) -> None:
        """
        Remove a tag from this transaction.

        Args:
            tag: Tag instance to remove
        """
        if self.tags and tag in self.tags:
            self.tags.remove(tag)

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert transaction to dictionary representation.
        """
        return {
            'id': self.id,
            'description': self.description,
            'amount_cents': self.amount_cents,
            'type': self.type.value,
            'date': self.date,
            'tags': [tag.name for tag in self.tags] if self.tags else [],
            'category': self.category,
            'non_category_tags': self.non_category_tags,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self) -> str:
        return (
            f"<Transaction(id={self.id}, type={self.type.value}, "
            f"amount=${self.amount_cents * 100.0:.2f})>"
        )

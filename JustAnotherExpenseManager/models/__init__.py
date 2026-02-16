"""
Database models for the Expense Manager application.
"""

import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Table, ForeignKey, Enum
from sqlalchemy.orm import relationship, declarative_base
from JustAnotherExpenseManager.utils.database import Base

class ExpenseType(enum.Enum):
    EXPENSE = 1
    INCOME = 2


# Association table for transaction-tag relationship
transaction_tags = Table('transaction_tags', Base.metadata,
    Column('transaction_id', Integer, ForeignKey('transactions.id')),
    Column('tag_id', Integer, ForeignKey('tags.id'))
)

class Tag(Base):
    """Tag model for categorization and labeling."""

    __tablename__ = 'tags'

    name = Column(String(100), primary_key=True, unique=True, nullable=False)

    def to_dict(self):
        """Convert tag to dictionary representation."""
        return {
            'name': self.name,
            'is_category': self.name.startswith('category:'),
            'category_name': self.name.replace('category:', '') if self.name.startswith('category:') else None
        }

    def __repr__(self):
        return f"<Tag(name='{self.name}')>"


class Transaction(Base):
    """Transaction model for both income and expenses."""

    __tablename__ = 'transactions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    description = Column(String(500), nullable=False)
    type = Column(Enum(ExpenseType))
    amount = Column(Integer, nullable=False)
    date = Column(String(10), nullable=False)  # YYYY-MM-DD format
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship to tags
    tags = relationship('Tag', secondary=transaction_tags, backref='transactions')

    def to_dict(self):
        """Convert transaction to dictionary representation."""
        return {
            'id': self.id,
            'description': self.description,
            'amount': self.amount,
            'type': self.type,
            'date': self.date,
            'tags': [tag.name for tag in self.tags],
            'category': next((tag.name.replace('category:', '') for tag in self.tags
                            if tag.name.startswith('category:')), None),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<Transaction(id={self.id}, type='{self.type}', amount={self.amount})>"

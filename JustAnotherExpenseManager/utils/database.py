"""
Database configuration and initialization.
"""

import os
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session, Session, declarative_base
from sqlalchemy.engine import Engine
from JustAnotherExpenseManager.models import Base, Tag


class DatabaseManager:
    """Manages database connections, sessions, and initialization."""

    def __init__(
        self,
        db_type: Optional[str] = None,
        db_host: Optional[str] = None,
        db_port: Optional[str] = None,
        db_name: Optional[str] = None,
        db_user: Optional[str] = None,
        db_password: Optional[str] = None,
        sqlite_path: Optional[str] = None
    ):
        """
        Initialize DatabaseManager.

        Args:
            db_type: Database type ('sqlite', 'postgresql', 'mysql')
            db_host: Database host
            db_port: Database port
            db_name: Database name
            db_user: Database username
            db_password: Database password
            sqlite_path: Path to SQLite database file
        """
        # Load from environment or use provided values
        self.db_type = (db_type or os.getenv('DATABASE_TYPE', 'sqlite')).lower()
        self.db_host = db_host or os.getenv('DATABASE_HOST', 'localhost')
        self.db_port = db_port or os.getenv('DATABASE_PORT', '5432')
        self.db_name = db_name or os.getenv('DATABASE_NAME', 'expenses')
        self.db_user = db_user or os.getenv('DATABASE_USER', 'expensemanager')
        self.db_password = db_password or os.getenv('DATABASE_PASSWORD', 'expensemanager')
        self.sqlite_path = sqlite_path or os.getenv('SQLITE_PATH', '/app/data/expenses.db')

        # Initialize engine and session factory
        self.database_url = self._build_database_url()
        self.engine: Engine = create_engine(self.database_url, echo=False)
        self.SessionLocal = scoped_session(
            sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        )

    def _build_database_url(self) -> str:
        """
        Generate database URL based on configuration.

        Returns:
            str: SQLAlchemy database URL
        """
        if self.db_type == 'postgresql':
            return (
                f'postgresql://{self.db_user}:{self.db_password}'
                f'@{self.db_host}:{self.db_port}/{self.db_name}'
            )
        elif self.db_type == 'mysql':
            port = self.db_port or '3306'
            return (
                f'mysql+pymysql://{self.db_user}:{self.db_password}'
                f'@{self.db_host}:{port}/{self.db_name}'
            )
        else:  # sqlite (default)
            data_dir = os.path.dirname(self.sqlite_path) if os.path.dirname(self.sqlite_path) else '.'
            os.makedirs(data_dir, exist_ok=True)
            return f'sqlite:///{self.sqlite_path}'

    def get_session(self) -> Session:
        """
        Get a new database session.

        Returns:
            Session: SQLAlchemy session object
        """
        return self.SessionLocal()

    def init_database(self) -> None:
        """Initialize database with tables and default data."""
        db_exists = os.path.exists(self.sqlite_path) if self.db_type == 'sqlite' else True

        if not db_exists:
            print(f"Creating new database at: {self.database_url}")
        else:
            print(f"Using database: {self.db_type}")

        # Create all tables
        Base.metadata.create_all(bind=self.engine)

        # Initialize default categories
        self._initialize_default_categories()

        if not db_exists:
            print("Database created successfully!")

        print("Database initialized and ready!")

    def _initialize_default_categories(self) -> None:
        """Initialize default category tags in the database."""
        db = self.SessionLocal()
        try:
            default_categories = [
                'food', 'transport', 'entertainment', 'utilities',
                'shopping', 'healthcare', 'other', 'salary',
                'investment'
            ]

            for cat in default_categories:
                tag_name = f'category:{cat}'
                existing = db.query(Tag).filter_by(name=tag_name).first()
                if not existing:
                    db.add(Tag(name=tag_name))

            db.commit()
        finally:
            db.close()

    def shutdown_session(self, exception: Optional[Exception] = None) -> None:
        """
        Remove database session at end of request.

        Args:
            exception: Exception that triggered shutdown (if any)
        """
        self.SessionLocal.remove()

    def close_all_connections(self) -> None:
        """Close all database connections and dispose of the engine."""
        self.SessionLocal.remove()
        self.engine.dispose()

    def reset_database(self) -> None:
        """
        Drop all tables and recreate them with default data.

        WARNING: This will delete all data!
        """
        print("WARNING: Dropping all tables and data!")
        Base.metadata.drop_all(bind=self.engine)
        self.init_database()

    @property
    def url(self) -> str:
        """Get the database URL."""
        return self.database_url

    @property
    def type(self) -> str:
        """Get the database type."""
        return self.db_type


# Global instance for backward compatibility
_db_manager = DatabaseManager()

# Export global variables for backward compatibility
DATABASE_TYPE = _db_manager.db_type
DATABASE_URL = _db_manager.database_url
engine = _db_manager.engine
SessionLocal = _db_manager.SessionLocal


# Backward compatible functions
def get_db() -> Session:
    """
    Get database session.

    Returns:
        Session: SQLAlchemy session object
    """
    return _db_manager.get_session()


def init_db() -> None:
    """Initialize database with tables and default data."""
    _db_manager.init_database()


def shutdown_session(exception: Optional[Exception] = None) -> None:
    """
    Remove database session at end of request.

    Args:
        exception: Exception that triggered shutdown (if any)
    """
    _db_manager.shutdown_session(exception)


# New convenience functions
def get_database_manager() -> DatabaseManager:
    """
    Get the global DatabaseManager instance.

    Returns:
        DatabaseManager: Global database manager
    """
    return _db_manager


def create_database_manager(**kwargs) -> DatabaseManager:
    """
    Create a new DatabaseManager instance with custom configuration.

    Args:
        **kwargs: Configuration parameters for DatabaseManager

    Returns:
        DatabaseManager: New database manager instance
    """
    return DatabaseManager(**kwargs)

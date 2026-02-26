"""
Database configuration and initialization using Flask-SQLAlchemy.
"""

import os
from typing import Optional

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

# The single shared Flask-SQLAlchemy extension instance.
# Import this object in models and wherever a session is needed directly.
db = SQLAlchemy()


def build_database_url(
    db_type: Optional[str] = None,
    db_host: Optional[str] = None,
    db_port: Optional[str] = None,
    db_name: Optional[str] = None,
    db_user: Optional[str] = None,
    db_password: Optional[str] = None,
    sqlite_path: Optional[str] = None,
) -> str:
    """
    Build a SQLAlchemy database URL from explicit arguments or environment variables.

    Does NOT create directories or touch the filesystem — that is deferred to
    ``init_database()`` so that importing this module never requires write access.

    Args:
        db_type: Database type ('sqlite', 'postgresql', 'mysql'). Defaults to
            ``DATABASE_TYPE`` env var or ``'sqlite'``.
        db_host: Database host. Defaults to ``DATABASE_HOST`` env var.
        db_port: Database port. Defaults to ``DATABASE_PORT`` env var.
        db_name: Database name. Defaults to ``DATABASE_NAME`` env var.
        db_user: Database username. Defaults to ``DATABASE_USER`` env var.
        db_password: Database password. Defaults to ``DATABASE_PASSWORD`` env var.
        sqlite_path: Path to the SQLite file. Defaults to ``SQLITE_PATH`` env var.

    Returns:
        str: A SQLAlchemy-compatible database URL.
    """

    path_str = ''
    resolved_type = (db_type or os.getenv('DATABASE_TYPE', 'sqlite')).lower()

    if resolved_type == 'postgresql':
        host = db_host or os.getenv('DATABASE_HOST', 'localhost')
        port = db_port or os.getenv('DATABASE_PORT', '5432')
        name = db_name or os.getenv('DATABASE_NAME', 'expenses')
        user = db_user or os.getenv('DATABASE_USER', 'expensemanager')
        password = db_password or os.getenv('DATABASE_PASSWORD', 'expensemanager')
        path_str = f'postgresql://{user}:{password}@{host}:{port}/{name}'
    elif resolved_type == 'mysql':
        host = db_host or os.getenv('DATABASE_HOST', 'localhost')
        port = db_port or os.getenv('DATABASE_PORT', '3306')
        name = db_name or os.getenv('DATABASE_NAME', 'expenses')
        user = db_user or os.getenv('DATABASE_USER', 'expensemanager')
        password = db_password or os.getenv('DATABASE_PASSWORD', 'expensemanager')
        path_str = f'mysql+pymysql://{user}:{password}@{host}:{port}/{name}'
    else:
        # SQLite (default)
        path = os.path.abspath(sqlite_path or os.getenv('SQLITE_PATH', './data/expenses.db'))
        path_str = f'sqlite:///{path}'
    return path_str


def init_database(app: Flask) -> None:
    """
    Create all tables and seed default category tags.

    For SQLite this also ensures the data directory exists. Must be called
    inside an active application context.

    Args:
        app: The Flask application instance.
    """
    database_url: str = app.config.get('SQLALCHEMY_DATABASE_URI', '')

    if database_url.startswith('sqlite:///'):
        sqlite_path = database_url[len('sqlite:///'):]
        data_dir = os.path.dirname(sqlite_path)
        if data_dir:
            os.makedirs(data_dir, exist_ok=True)

        db_exists = os.path.exists(sqlite_path)
        if not db_exists:
            print(f"Creating new database at: {database_url}")
        else:
            print("Using database: sqlite")
    else:
        db_exists = True
        db_type = database_url.split('://')[0].split('+')[0]
        print(f"Using database: {db_type}")

    db.create_all()
    _seed_default_categories()

    if not db_exists:
        print("Database created successfully!")

    print("Database initialized and ready!")


def reset_database(app: Flask) -> None:
    """
    Drop all tables and recreate them with default seed data.

    WARNING: This deletes all data. Must be called inside an active
    application context.

    Args:
        app: The Flask application instance.
    """
    print("WARNING: Dropping all tables and data!")
    db.drop_all()
    init_database(app)


def check_health() -> bool:
    """
    Execute a lightweight query to verify database connectivity.

    Must be called inside an active application context.

    Returns:
        bool: ``True`` if the database responds, ``False`` otherwise.
    """
    try:
        db.session.execute(text('SELECT 1'))
        return True
    except Exception:  # pylint: disable=broad-except
        return False


def _seed_default_categories() -> None:
    """Insert default category tags if they do not already exist."""
    # Import here to avoid a circular import at module load time.
    from sqlalchemy import select  # pylint: disable=import-outside-toplevel
    from JustAnotherExpenseManager.models import Tag  # pylint: disable=import-outside-toplevel

    default_categories = [
        'food', 'transport', 'entertainment', 'utilities',
        'shopping', 'healthcare', 'other', 'salary', 'investment',
    ]

    for cat in default_categories:
        tag_name = f'category:{cat}'
        existing = db.session.scalars(
            select(Tag).where(Tag.name == tag_name)
        ).first()
        if not existing:
            db.session.add(Tag(name=tag_name))

    db.session.commit()


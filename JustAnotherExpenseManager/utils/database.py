"""
Database configuration and initialization.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from JustAnotherExpenseManager.models import Base, Tag

import sqlite3
from datetime import datetime
import click
from flask import current_app, g

# Database configuration from environment
DATABASE_TYPE = os.getenv('DATABASE_TYPE', 'sqlite').lower()
DATABASE_HOST = os.getenv('DATABASE_HOST', 'localhost')
DATABASE_PORT = os.getenv('DATABASE_PORT', '5432')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'expenses')
DATABASE_USER = os.getenv('DATABASE_USER', 'expensemanager')
DATABASE_PASSWORD = os.getenv('DATABASE_PASSWORD', 'expensemanager')
#SQLITE_PATH = os.getenv('SQLITE_PATH', '/app/data/expenses.db')
SQLITE_PATH = ''


sqlite3.register_converter(
    'timestamp', lambda v: datetime.fromisoformat(v.decode())
)


@click.command('init-db')
def init_db_command():
    '''Clear the existing data and create new tables'''
    init_db()
    click.echo('Initialized the database.')


def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)


def close_db(e=None):
    db = g.pop('db', None)

    if db is not None:
        db.close()


def get_database_url():
    """Generate database URL based on configuration."""
    if DATABASE_TYPE == 'postgresql':
        return f'postgresql://{DATABASE_USER}:{DATABASE_PASSWORD}@{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_NAME}'
    elif DATABASE_TYPE == 'mysql':
        port = DATABASE_PORT or '3306'
        return f'mysql+pymysql://{DATABASE_USER}:{DATABASE_PASSWORD}@{DATABASE_HOST}:{port}/{DATABASE_NAME}'
    else:  # sqlite (default)
        data_dir = os.path.dirname(SQLITE_PATH) if os.path.dirname(SQLITE_PATH) else '.'
        os.makedirs(data_dir, exist_ok=True)
        return f'sqlite:///{SQLITE_PATH}'


# Create database URL
DATABASE_URL = get_database_url()

# Create engine and session factory
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))


def get_db():
    """Get database session."""
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db
    #return SessionLocal()


def init_db():
    """Initialize database with tables and default data."""
    db = get_db()

    with current_app.open_resource('schema.sql') as f:
        db.executescript(f.read().decode('utf8'))
    return

    db_exists = os.path.exists(SQLITE_PATH) if DATABASE_TYPE == 'sqlite' else True

    if not db_exists:
        print(f"Creating new database at: {DATABASE_URL}")
    else:
        print(f"Using database: {DATABASE_TYPE}")

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Initialize default categories
    db = SessionLocal()
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
        close_db()

    if not db_exists:
        print("Database created successfully!")

    print("Database initialized and ready!")


def shutdown_session(exception=None):
    """Remove database session at end of request."""
    SessionLocal.remove()

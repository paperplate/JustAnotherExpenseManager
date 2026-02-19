"""
Main Flask application entry point.

This application follows SOLID principles with separation of concerns:
- Models: Database models (models/)
- Services: Business logic (utils/services.py)
- Routes: HTTP handlers (routes/)
- Database: Configuration and session management (utils/database.py)
"""

import sys
import click
from flask import Flask, g
from dotenv import dotenv_values
from JustAnotherExpenseManager.utils.database import (
    get_database_manager,
    create_database_manager,
    DatabaseManager
)
from JustAnotherExpenseManager.routes.transactions import transaction_bp
from JustAnotherExpenseManager.routes.stats import stats_bp
from JustAnotherExpenseManager.routes.categories import categories_bp
from JustAnotherExpenseManager.routes.settings import settings_bp


def create_app(test_config=None, db_manager: DatabaseManager = None):
    """
    Create and configure the Flask application.

    Args:
        test_config: Optional test configuration dictionary
        db_manager: Optional DatabaseManager instance (for testing)

    Returns:
        Flask: Configured Flask application
    """
    app = Flask(__name__)

    # Load configuration
    if test_config is None:
        try:
            config = dotenv_values('.flaskenv')
            app.config.from_mapping(config)
        except Exception as err:
            print(f"Warning: Could not load .flaskenv file: {err}")
            app.config.from_mapping({})
    else:
        app.config.from_mapping(test_config)

    # Set up database manager
    if db_manager is None:
        db_manager = get_database_manager()
    app.db_manager = db_manager

    # Register blueprints
    app.register_blueprint(stats_bp)
    app.register_blueprint(transaction_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(settings_bp)

    # Database session management
    @app.before_request
    def before_request():
        """Create database session before each request."""
        g.db = app.db_manager.get_session()

    @app.teardown_appcontext
    def teardown_db(exception=None):
        """Remove database session at end of request."""
        db = g.pop('db', None)
        if db is not None:
            if exception is not None:
                db.rollback()
            db.close()
        app.db_manager.shutdown_session(exception)

    # Register CLI commands
    register_cli_commands(app)

    return app


def register_cli_commands(app: Flask):
    """
    Register Flask CLI commands.

    Args:
        app: Flask application instance
    """

    @app.cli.command('init-db')
    @click.option('--drop', is_flag=True, help='Drop existing tables before creating new ones')
    @click.option('--sample-data', is_flag=True, help='Load sample data after initialization')
    def init_db_command(drop, sample_data):
        """
        Initialize the database.

        Examples:
            flask init-db
            flask init-db --drop
            flask init-db --drop --sample-data
        """
        if drop:
            click.echo('Dropping existing tables...')
            app.db_manager.reset_database()
            click.echo('Database reset complete.')
        else:
            click.echo('Initializing database...')
            app.db_manager.init_database()
            click.echo('Database initialized successfully.')

        if sample_data:
            click.echo('Loading sample data...')
            load_sample_data(app.db_manager)
            click.echo('Sample data loaded.')

    @app.cli.command('db-info')
    def db_info_command():
        """Display database information."""
        click.echo('Database Configuration:')
        click.echo(f'  Type: {app.db_manager.type}')
        click.echo(f'  URL: {app.db_manager.url}')
        click.echo(f'  Engine: {app.db_manager.engine}')

    @app.cli.command('db-reset')
    @click.confirmation_option(
        prompt='Are you sure you want to reset the database? This will delete all data!'
    )
    def db_reset_command():
        """
        Reset the database (drop and recreate all tables).

        This will DELETE ALL DATA!
        """
        click.echo('Resetting database...')
        app.db_manager.reset_database()
        click.echo('Database has been reset.')

    @app.cli.command('db-health')
    def db_health_command():
        """Check database health/connectivity."""
        click.echo('Checking database health...')
        try:
            db = app.db_manager.get_session()
            db.execute('SELECT 1')
            db.close()
            click.echo('✓ Database is healthy and responding.')
        except Exception as e:
            click.echo(f'✗ Database health check failed: {e}', err=True)
            sys.exit(1)

    @app.cli.command('db-stats')
    def db_stats_command():
        """Display database statistics."""
        from JustAnotherExpenseManager.models import Transaction, Tag

        db = app.db_manager.get_session()
        try:
            transaction_count = db.query(Transaction).count()
            tag_count = db.query(Tag).count()
            category_count = db.query(Tag).filter(Tag.name.like('category:%')).count()

            income_count = db.query(Transaction).filter_by(type='income').count()
            expense_count = db.query(Transaction).filter_by(type='expense').count()

            click.echo('Database Statistics:')
            click.echo(f'  Total Transactions: {transaction_count}')
            click.echo(f'    Income: {income_count}')
            click.echo(f'    Expenses: {expense_count}')
            click.echo(f'  Total Tags: {tag_count}')
            click.echo(f'  Categories: {category_count}')
        finally:
            db.close()


def load_sample_data(db_manager: DatabaseManager):
    """
    Load sample data into the database.

    Args:
        db_manager: DatabaseManager instance
    """
    from JustAnotherExpenseManager.models import Transaction, Tag
    from datetime import datetime, timedelta

    db = db_manager.get_session()
    try:
        # Sample transactions
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

        # Get food category
        food_category = db.query(Tag).filter_by(name='category:food').first()
        transport_category = db.query(Tag).filter_by(name='category:transport').first()
        salary_category = db.query(Tag).filter_by(name='category:salary').first()

        # Create transactions
        for i, trans_data in enumerate(sample_transactions):
            transaction = Transaction(**trans_data)

            # Add categories
            if i == 1:  # Grocery
                transaction.tags.append(food_category)
            elif i == 2:  # Gas
                transaction.tags.append(transport_category)
            elif i == 3:  # Restaurant
                transaction.tags.append(food_category)
            elif i == 0 or i == 4:  # Salary/Freelance
                transaction.tags.append(salary_category)

            db.add(transaction)

        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def main():
    """Main entry point for the application."""
    # Load configuration
    try:
        config = dotenv_values('.flaskenv')
    except Exception as err:
        print(f"Warning: Could not load .flaskenv file: {err}")
        config = {}

    # Initialize database
    db_manager = get_database_manager()
    db_manager.init_database()

    # Create and run app
    app = create_app()
    app.run(
        host='0.0.0.0',
        port=int(config.get('PORT', 5000)),
        debug=(config.get('FLASK_ENV') == 'development')
    )


if __name__ == '__main__':
    main()

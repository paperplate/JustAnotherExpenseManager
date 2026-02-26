"""
Main Flask application entry point.

This application follows SOLID principles with separation of concerns:
- Models: Database models (models/)
- Services: Business logic (utils/services.py)
- Routes: HTTP handlers (routes/)
- Database: Flask-SQLAlchemy extension and helpers (utils/database.py)
"""

import os
import sys
import click
from flask import Flask, g
from flask_debugtoolbar import DebugToolbarExtension
from dotenv import dotenv_values

from JustAnotherExpenseManager.utils.database import (
    db,
    build_database_url,
    init_database,
    reset_database,
    check_health,
)
from JustAnotherExpenseManager.routes.transactions import transaction_bp
from JustAnotherExpenseManager.routes.stats import stats_bp
from JustAnotherExpenseManager.routes.categories import categories_bp
from JustAnotherExpenseManager.routes.settings import settings_bp


toolbar = DebugToolbarExtension()


def create_app(test_config=None):
    """
    Create and configure the Flask application.

    When ``db_manager`` is supplied (e.g. from test fixtures) its
    ``database_url`` is used directly so the caller controls which database
    is targeted.  When omitted the URL is derived from environment variables
    via ``build_database_url()``.

    Args:
        test_config: Optional test configuration dictionary.
        db_manager: Optional DatabaseManager instance (for testing).

    Returns:
        Flask: Configured Flask application.
    """
    app = Flask(__name__)

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------
    if test_config is None:
        try:
            config = dotenv_values('.flaskenv')
            app.config.from_mapping(config)
        except Exception as err:  # pylint: disable=broad-except
            print(f"Warning: Could not load .flaskenv file: {err}")
            app.config.from_mapping({})
    else:
        app.config.from_mapping(test_config)

    # Resolve SECRET_KEY in priority order:
    #   1. test_config / .flaskenv (already applied above)
    #   2. environment variable (covers Docker and CI)
    #   3. dev-only fallback — warns loudly so it is never used in production
    if not app.config.get('SECRET_KEY'):
        app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
    if not app.config.get('SECRET_KEY'):
        app.logger.warning(
            'SECRET_KEY is not set. Using an insecure default — '
            'set SECRET_KEY in .flaskenv or as an environment variable.'
        )
        app.config['SECRET_KEY'] = 'dev-insecure-default-change-me'

    toolbar.init_app(app)
    # ------------------------------------------------------------------
    # Database URL
    # ------------------------------------------------------------------
    if 'SQLALCHEMY_DATABASE_URI' not in app.config:
        app.config['SQLALCHEMY_DATABASE_URI'] = build_database_url()

    app.config.setdefault('SQLALCHEMY_TRACK_MODIFICATIONS', False)

    # ------------------------------------------------------------------
    # Flask-SQLAlchemy initialisation
    # ------------------------------------------------------------------
    db.init_app(app)

    with app.app_context():
        init_database(app)

    # ------------------------------------------------------------------
    # Blueprints
    # ------------------------------------------------------------------
    app.register_blueprint(stats_bp)
    app.register_blueprint(transaction_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(settings_bp)

    # ------------------------------------------------------------------
    # Request-scoped session alias
    #
    # Routes currently access the session via ``g.db``.  We keep that
    # working by pointing ``g.db`` at the Flask-SQLAlchemy scoped session.
    # Flask-SQLAlchemy already calls ``db.session.remove()`` on
    # ``teardown_appcontext``, so no extra cleanup hook is required here.
    # ------------------------------------------------------------------
    @app.before_request
    def _set_g_db():
        """Expose db.session as g.db for backward compatibility with routes."""
        g.db = db.session

    # ------------------------------------------------------------------
    # CLI commands
    # ------------------------------------------------------------------
    register_cli_commands(app)

    return app


def register_cli_commands(app: Flask):
    """
    Register Flask CLI commands.

    Args:
        app: Flask application instance.
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
            reset_database(app)
            click.echo('Database reset complete.')
        else:
            click.echo('Initializing database...')
            init_database(app)
            click.echo('Database initialized successfully.')

        if sample_data:
            from JustAnotherExpenseManager.utils.sample_data import load_sample_data  # pylint: disable=import-outside-toplevel
            click.echo('Loading sample data...')
            load_sample_data(db.session)
            click.echo('Sample data loaded.')

    @app.cli.command('db-info')
    def db_info_command():
        """Display database information."""
        url = str(db.engine.url)
        db_type = url.split('://')[0].split('+')[0]
        click.echo('Database Configuration:')
        click.echo(f'  Type: {db_type}')
        click.echo(f'  URL: {url}')
        click.echo(f'  Engine: {db.engine}')

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
        reset_database(app)
        click.echo('Database has been reset.')

    @app.cli.command('db-health')
    def db_health_command():
        """Check database health/connectivity."""
        click.echo('Checking database health...')
        if check_health():
            click.echo('✓ Database is healthy and responding.')
        else:
            click.echo('✗ Database health check failed.', err=True)
            sys.exit(1)

    @app.cli.command('db-stats')
    def db_stats_command():
        """Display database statistics."""
        from JustAnotherExpenseManager.models import Transaction, Tag  # pylint: disable=import-outside-toplevel
        transaction_count = db.session.query(Transaction).count()
        tag_count = db.session.query(Tag).count()
        click.echo('Database Statistics:')
        click.echo(f'  Transactions: {transaction_count}')
        click.echo(f'  Tags:         {tag_count}')


def main():
    """Entry point for the installed ``JustAnotherExpenseManager`` command."""
    import os  # pylint: disable=import-outside-toplevel
    app = create_app()
    host = os.getenv('FLASK_RUN_HOST', '127.0.0.1')
    port = int(os.getenv('FLASK_RUN_PORT', '5000'))
    debug = os.getenv('FLASK_DEBUG', '0') == '1'
    app.run(host=host, port=port)

"""
Main Flask application entry point.

This application follows SOLID principles with separation of concerns:
- Config:    Environment/deployment settings (config.py)
- Models:    Database models (models/)
- Services:  Business logic (utils/services.py)
- Routes:    HTTP handlers (routes/)
- Database:  Flask-SQLAlchemy extension and helpers (utils/database.py)
"""

import os
import sys
import click
from flask import Flask, g

from JustAnotherExpenseManager.config import Config, get_config_class
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


def create_app(
    config_class: type[Config] | None = None,
    config_overrides: dict | None = None,
) -> Flask:
    """
    Create and configure the Flask application.

    The active configuration is determined by the ``JAEM_CONFIG`` environment
    variable (``'production'`` by default) unless *config_class* is supplied
    explicitly.  *config_overrides* is applied on top of the selected class
    and is intended for test fixtures that need to swap the database URI.

    Args:
        config_class: A :class:`~JustAnotherExpenseManager.config.Config`
            subclass to load.  When ``None`` the class is resolved from
            ``JAEM_CONFIG``.
        config_overrides: Optional mapping of config keys to override after
            the class is loaded (e.g. ``{'SQLALCHEMY_DATABASE_URI': ...}``).

    Returns:
        Configured :class:`flask.Flask` application instance.
    """
    app = Flask(__name__)

    # ------------------------------------------------------------------ #
    # Load configuration                                                   #
    # ------------------------------------------------------------------ #
    if config_class is None:
        config_class = get_config_class()
    app.config.from_object(config_class)

    if config_overrides:
        app.config.from_mapping(config_overrides)

    # Warn loudly if the insecure default secret key is still in place in
    # a non-testing environment so operators notice it immediately.
    _insecure_defaults = {'dev-insecure-default-change-me', 'debug-secret-key-change-me'}
    if not app.testing and app.config.get('SECRET_KEY') in _insecure_defaults:
        app.logger.warning(
            'SECRET_KEY is not set or uses an insecure default. '
            'Set the SECRET_KEY environment variable before deploying.'
        )

    # ------------------------------------------------------------------ #
    # Debug toolbar (only when DEBUG=True and the package is installed)   #
    # ------------------------------------------------------------------ #
    if app.debug:
        try:
            from flask_debugtoolbar import DebugToolbarExtension  # pylint: disable=import-outside-toplevel
            DebugToolbarExtension(app)
        except ImportError:
            app.logger.debug('flask-debugtoolbar not installed; skipping.')

    # ------------------------------------------------------------------ #
    # Database                                                             #
    # ------------------------------------------------------------------ #
    if 'SQLALCHEMY_DATABASE_URI' not in app.config:
        app.config['SQLALCHEMY_DATABASE_URI'] = build_database_url(
            db_type=app.config.get('DATABASE_TYPE'),
            db_host=app.config.get('DATABASE_HOST'),
            db_port=app.config.get('DATABASE_PORT'),
            db_name=app.config.get('DATABASE_NAME'),
            db_user=app.config.get('DATABASE_USER'),
            db_password=app.config.get('DATABASE_PASSWORD'),
            sqlite_path=app.config.get('SQLITE_PATH'),
        )

    db.init_app(app)
    with app.app_context():
        init_database(app)

    # ------------------------------------------------------------------ #
    # Blueprints                                                           #
    # ------------------------------------------------------------------ #
    app.register_blueprint(stats_bp)
    app.register_blueprint(transaction_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(settings_bp)

    @app.before_request
    def _set_g_db():
        """Expose db.session as g.db to make use of Flask's g global variable."""
        g.db = db.session

    register_cli_commands(app)

    return app


def register_cli_commands(app: Flask) -> None:
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


def main() -> None:
    """
    Entry point for the installed ``JustAnotherExpenseManager`` command.

    The active configuration is controlled entirely by environment variables.
    Set ``JAEM_CONFIG`` to ``debug``, ``testing``, or ``production`` (default).
    Override individual settings by setting the corresponding environment
    variable, e.g. ``SECRET_KEY``, ``DATABASE_TYPE``, ``FLASK_RUN_HOST``, etc.
    """
    app = create_app()

    host = app.config.get('FLASK_RUN_HOST', '0.0.0.0')
    port = int(app.config.get('FLASK_RUN_PORT', 5000))
    debug = app.debug

    app.run(host=host, port=port, debug=debug)

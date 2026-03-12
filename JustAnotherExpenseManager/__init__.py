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

def _load_config_file(path: str) -> dict:
    """
    Load a dotenv-style config file and return its contents as a dictionary.
 
    Args:
        path: Path to the config file.
 
    Returns:
        dict: Parsed key/value pairs from the file.
 
    Raises:
        SystemExit: If the file does not exist or cannot be read.
    """
    if not os.path.isfile(path):
        print(f"Error: config file not found: {path}", file=sys.stderr)
        sys.exit(1)
    try:
        return dict(dotenv_values(path))
    except Exception as err:  # pylint: disable=broad-except
        print(f"Error: could not read config file '{path}': {err}", file=sys.stderr)
        sys.exit(1)


def create_app(config=None):
    """
    Create and configure the Flask application.

    Returns:
        Flask: Configured Flask application.
    """
    app = Flask(__name__)

    # Configuration
    if config is None:
        try:
            loaded = dotenv_values('.flaskenv')
            app.config.from_mapping(loaded)
        except Exception as err:  # pylint: disable=broad-except
            print(f"Warning: Could not load .flaskenv file: {err}")
            app.config.from_mapping({})
    else:
        app.config.from_mapping(config)

    _BOOL_KEYS = ('TESTING', 'FLASK_DEBUG', 'WTF_CSRF_ENABLED')
    for _key in _BOOL_KEYS:
        _val = app.config.get(_key)
        if isinstance(_val, str):
            app.config[_key] = _val.strip().lower() in ('1', 'true', 'yes')

    if not app.config.get('SECRET_KEY'):
        app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
    if not app.config.get('SECRET_KEY'):
        app.logger.warning(
            'SECRET_KEY is not set. Using an insecure default — '
            'set SECRET_KEY in .flaskenv or as an environment variable.'
        )
        app.config['SECRET_KEY'] = 'dev-insecure-default-change-me'

    if app.config.get('FLASK_DEBUG') == 1:
        from flask_debugtoolbar import DebugToolbarExtension
        DebugToolbarExtension(app)

    if 'SQLALCHEMY_DATABASE_URI' not in app.config:
        app.config['SQLALCHEMY_DATABASE_URI'] = build_database_url(
            db_type=app.config.get('DATABASE_TYPE'),
            db_host=app.config.get('DATABASE_HOST'),
            db_port=app.config.get('DATABASE_PORT'),
            db_name=app.config.get('DATABASE_NAME'),
            db_user=app.config.get('DATABASE_USER'),
            db_password=app.config.get('DATABASE_PASSWORD'),
            sqlite_path=app.config.get('SQLITE_PATH')
        )

    app.config.setdefault('SQLALCHEMY_TRACK_MODIFICATIONS', False)

    db.init_app(app)
    with app.app_context():
        init_database(app)

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
    import argparse
    parser = argparse.ArgumentParser(
        prog='JustAnotherExpenseManager',
        description='Run the JustAnotherExpenseManager application.'
    )
    #parser.add_argument('--config', type=str, action='store_const', help='Path to config file')

    #if parser.parse_args('--config') is None:
    #    import os  # pylint: disable=import-outside-toplevel
    #    host = os.getenv('FLASK_RUN_HOST', '127.0.0.1')
    #    port = int(os.getenv('FLASK_RUN_PORT', '5000'))
    #    debug = os.getenv('FLASK_DEBUG', '0') == '1'
    parser.add_argument(
        '--config', '-c',
        metavar='FILE',
        default=None,
        help='Path to a dotenv-style config file (e.g. .flaskenv, production.env). '
             'Defaults to .flaskenv in the current directory when omitted.',
    )
    args = parser.parse_args()
 
    config = _load_config_file(args.config) if args.config else None
    app = create_app(config)
 

    host = app.config.get('FLASK_RUN_HOST') or os.getenv('FLASK_RUN_HOST', '127.0.0.1')
    port = int(app.config.get('FLASK_RUN_PORT') or os.getenv('FLASK_RUN_PORT', '5000'))
    debug = (app.config.get('FLASK_DEBUG') or os.getenv('FLASK_DEBUG', '0')) == '1'

    app = create_app()
    app.run(host=host, port=port, debug=debug)

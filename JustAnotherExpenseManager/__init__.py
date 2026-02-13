"""
Main Flask application entry point.

This application follows SOLID principles with separation of concerns:
- Models: Database models (models/)
- Services: Business logic (utils/services.py)
- Routes: HTTP handlers (routes/)
- Database: Configuration and session management (utils/database.py)
"""

import sys
from dotenv import dotenv_values
from flask import Flask
from JustAnotherExpenseManager.utils.database import init_db, shutdown_session, get_db, engine, SessionLocal
from JustAnotherExpenseManager.models import Transaction, Tag
from JustAnotherExpenseManager.routes.transactions import transaction_bp
from JustAnotherExpenseManager.routes.stats import stats_bp
from JustAnotherExpenseManager.routes.categories import categories_bp
from JustAnotherExpenseManager.routes.settings import settings_bp

def create_app(test_config=None):
    # Create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'expenses.sqlite')
    )

    if test_config is None:
        # load hte instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    from .utils import database
    database.init_app(app)

    # ensure the instance folder exists
    os.makedirs(app.instance_path, exists_ok=True)
    # Register blueprints
    app.register_blueprint(stats_bp)
    app.register_blueprint(transaction_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(settings_bp)

    # Teardown database session
    app.teardown_appcontext(shutdown_session)

    try:
        config = dotenv_values('.env')
    except Exception as err:
        print(f"Unexpected {err=}, {type(err)=}")
        sys.exit(1)
    return app


def main():
    """Main entry point for the application."""
    config = dotenv_values('.env')
    init_db()
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=(config.get('FLASK_ENV') == 'development'))


if __name__ == '__main__':
    main()

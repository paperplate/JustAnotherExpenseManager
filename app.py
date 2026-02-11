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
from utils.database import init_db, shutdown_session, get_db, engine, SessionLocal
from models import Transaction, Tag
from routes.transactions import transaction_bp
from routes.stats import stats_bp
from routes.categories import categories_bp
from routes.settings import settings_bp

app = Flask(__name__)

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


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=(config.get('FLASK_ENV') == 'development'))

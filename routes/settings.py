"""
Routes for settings page and test data.
"""

from flask import Blueprint, render_template, jsonify, current_app
from utils.database import get_db
from utils.services import TestDataService

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/settings')
def settings_page():
    """Display settings page."""
    return render_template('settings.html', debug_mode=current_app.debug)


@settings_bp.route('/api/populate-test-data', methods=['POST'])
def populate_test_data():
    """Populate database with test data (only in debug mode)."""
    if not current_app.debug:
        return jsonify({'error': 'Test data generation is only available in debug mode'}), 403

    db = get_db()
    try:
        service = TestDataService(db)
        count, error = service.populate_test_data()

        if error:
            return jsonify({'error': error}), 400

        return jsonify({
            'success': True,
            'message': f'Added {count} test transactions',
            'count': count
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

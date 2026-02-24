"""
Routes for settings page and test data.
"""

from typing import Tuple, Union
from flask import Blueprint, render_template, jsonify, current_app, Response, g
from JustAnotherExpenseManager.utils.services import CategoryService, TestDataService

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/settings')
def settings_page() -> str:
    """
    Display settings page.

    Returns:
        str: Rendered settings HTML template
    """
    service = CategoryService(g.db)
    categories = service.get_all_categories()
    tags = service.get_all_tags()

    return render_template(
        'settings.html',
        debug_mode=current_app.debug,
        categories=categories,
        tags=tags,
    )


@settings_bp.route('/api/populate-test-data', methods=['POST'])
def populate_test_data() -> Union[Response, Tuple[Response, int]]:
    """
    Populate database with test data (only in debug mode).

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not current_app.debug:
        return jsonify({
            'error': 'Test data generation is only available in debug mode'
        }), 403

    try:
        service = TestDataService(g.db)
        count, error = service.populate_test_data()

        if error:
            return jsonify({'error': error}), 400

        return jsonify({
            'success': True,
            'message': f'Added {count} test transactions',
            'count': count
        })
    except Exception as exc:  # pylint: disable=broad-except
        g.db.rollback()
        return jsonify({'error': str(exc)}), 500


@settings_bp.route('/api/transactions/clear-all', methods=['POST'])
def clear_all_transactions() -> Union[Response, Tuple[Response, int]]:
    """
    Delete all transactions and tags (only in debug or testing mode).

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not current_app.debug and not current_app.testing:
        return jsonify({'error': 'Only available in debug/testing mode'}), 403

    try:
        from JustAnotherExpenseManager.models import Transaction, Tag, transaction_tags
        from sqlalchemy import delete as sa_delete

        g.db.execute(sa_delete(transaction_tags))
        g.db.query(Transaction).delete(synchronize_session=False)
        g.db.query(Tag).delete(synchronize_session=False)
        g.db.commit()

        return jsonify({'success': True})
    except Exception as exc:  # pylint: disable=broad-except
        g.db.rollback()
        return jsonify({'error': str(exc)}), 500

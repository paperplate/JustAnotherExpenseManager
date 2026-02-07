"""
Routes for category operations.
"""

from flask import Blueprint, request, jsonify
from utils.database import get_db
from utils.services import CategoryService

categories_bp = Blueprint('categories', __name__)


@categories_bp.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all categories."""
    db = get_db()
    try:
        service = CategoryService(db)
        categories = service.get_all_categories()
        return jsonify(categories)
    finally:
        db.close()


@categories_bp.route('/api/categories', methods=['POST'])
def add_category():
    """Add a new category."""
    category_name = request.json.get('name', '').strip().lower()

    # Validate category name
    if not category_name:
        return jsonify({'error': 'Category name required'}), 400

    if len(category_name) > 50:
        return jsonify({'error': 'Category name too long (max 50 characters)'}), 400

    # Check for invalid characters
    if not category_name.replace('_', '').replace('-', '').isalnum():
        return jsonify(
            {'error': 'Category name can only contain letters, numbers, hyphens and underscores'}), 400

    db = get_db()
    try:
        service = CategoryService(db)
        tag, error = service.create_category(category_name)

        if error:
            return jsonify({'error': error}), 400

        return jsonify({'success': True, 'category': category_name})
    except Exception as e:
        db.rollback()
        return jsonify({'error': f'Failed to create category: {str(e)}'}), 500
    finally:
        db.close()


@categories_bp.route('/api/categories/<category_name>', methods=['PUT'])
def update_category(category_name):
    """Update a category name."""
    new_name = request.json.get('name', '').strip().lower()

    if not new_name:
        return jsonify({'error': 'Category name required'}), 400

    db = get_db()
    try:
        service = CategoryService(db)
        success, error = service.update_category(category_name, new_name)

        if error:
            return jsonify({'error': error}), 400

        return jsonify({'success': True, 'category': new_name})
    finally:
        db.close()


@categories_bp.route('/api/categories/<category_name>', methods=['DELETE'])
def delete_category(category_name):
    """Delete a category."""
    db = get_db()
    try:
        service = CategoryService(db)
        success, error = service.delete_category(category_name)

        if error:
            return jsonify({'error': error}), 400

        return jsonify({'success': True})
    finally:
        db.close()


@categories_bp.route('/api/tags', methods=['GET'])
def get_tags():
    """Get all non-category tags."""
    db = get_db()
    try:
        service = CategoryService(db)
        tags = service.get_all_tags()
        return jsonify(tags)
    finally:
        db.close()

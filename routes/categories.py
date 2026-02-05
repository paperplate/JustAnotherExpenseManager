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
    
    if not category_name:
        return jsonify({'error': 'Category name required'}), 400
    
    db = get_db()
    try:
        service = CategoryService(db)
        tag, error = service.create_category(category_name)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({'success': True, 'category': category_name})
    finally:
        db.close()

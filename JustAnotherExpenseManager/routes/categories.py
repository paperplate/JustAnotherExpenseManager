"""
Routes for category operations.
"""

from typing import Tuple, Union
from flask import Blueprint, request, jsonify, Response, g
from JustAnotherExpenseManager.utils.services import CategoryService

categories_bp = Blueprint('categories', __name__)


@categories_bp.route('/api/categories', methods=['GET'])
def get_categories() -> Response:
    """
    Get all categories, ordered by sort_order then name.

    Returns:
        Response: JSON response with list of categories
    """
    service = CategoryService(g.db)
    categories = service.get_all_categories()
    return jsonify(categories)


@categories_bp.route('/api/categories', methods=['POST'])
def add_category() -> Union[Response, Tuple[Response, int]]:
    """
    Add a new category.

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    category_name: str = request.json.get('name', '').strip().lower()

    if not category_name:
        return jsonify({'error': 'Category name required'}), 400

    if len(category_name) > 50:
        return jsonify({'error': 'Category name too long (max 50 characters)'}), 400

    if not category_name.replace('_', '').replace('-', '').isalnum():
        return jsonify({
            'error': 'Category name can only contain letters, numbers, hyphens and underscores'
        }), 400

    try:
        service = CategoryService(g.db)
        tag, error = service.add_category(category_name)

        if error:
            return jsonify({'error': error}), 400

        return jsonify({'success': True, 'category': category_name})
    except Exception as exc:  # pylint: disable=broad-except
        g.db.rollback()
        return jsonify({'error': f'Failed to create category: {str(exc)}'}), 500


@categories_bp.route('/api/categories', methods=['PUT'])
def update_category() -> Union[Response, Tuple[Response, int]]:
    """
    Rename a category.

    Body: {"name": "<current name>", "new_name": "<desired name>"}

    Returns 409 with conflict=true when the new name already exists,
    allowing the client to offer a merge via POST /api/categories/merge.

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    name: str = request.json.get('name', '').strip().lower()
    new_name: str = request.json.get('new_name', '').strip().lower()

    if not name:
        return jsonify({'error': 'Category name required'}), 400
    if not new_name:
        return jsonify({'error': 'New category name required'}), 400

    service = CategoryService(g.db)
    success, error = service.update_category(name, new_name)

    if error:
        if 'already exists' in error:
            return jsonify({'error': error, 'conflict': True, 'target': new_name}), 409
        return jsonify({'error': error}), 400

    return jsonify({'success': True, 'category': new_name})


@categories_bp.route('/api/categories/order', methods=['PATCH'])
def update_categories_order() -> Union[Response, Tuple[Response, int]]:
    """
    Persist a new display order for categories.

    Body: {"order": ["food", "transport", "entertainment", ...]}

    The list should contain bare category names (no ``category:`` prefix) in
    the desired display order.  Each name's ``sort_order`` is set to its
    index in the list.

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    order = request.json.get('order', [])
    if not isinstance(order, list):
        return jsonify({'error': "'order' must be a list of category names"}), 400

    service = CategoryService(g.db)
    success, error = service.update_categories_order(order)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True})


@categories_bp.route('/api/categories/merge', methods=['POST'])
def merge_category() -> Union[Response, Tuple[Response, int]]:
    """
    Merge one category into another.

    Body: {"source": "<name to merge from>", "target": "<name to merge into>"}

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    source_name: str = request.json.get('source', '').strip().lower()
    target_name: str = request.json.get('target', '').strip().lower()

    if not source_name:
        return jsonify({'error': 'Source category name required'}), 400
    if not target_name:
        return jsonify({'error': 'Target category name required'}), 400

    service = CategoryService(g.db)
    success, error = service.merge_category(source_name, target_name)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True, 'category': target_name})


@categories_bp.route('/api/categories', methods=['DELETE'])
def delete_category() -> Union[Response, Tuple[Response, int]]:
    """
    Delete a category.

    Body: {"name": "<category name>"}

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    category_name: str = request.json.get('name', '').strip().lower()

    if not category_name:
        return jsonify({'error': 'Category name required'}), 400

    service = CategoryService(g.db)
    success, error = service.delete_category(category_name)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True})


@categories_bp.route('/api/tags', methods=['GET'])
def get_tags() -> Response:
    """
    Get all non-category tags, ordered by sort_order then name.

    Returns:
        Response: JSON response with list of tags
    """
    service = CategoryService(g.db)
    tags = service.get_all_tags()
    return jsonify(tags)


@categories_bp.route('/api/tags/order', methods=['PATCH'])
def update_tags_order() -> Union[Response, Tuple[Response, int]]:
    """
    Persist a new display order for non-category tags.

    Body: {"order": ["recurring", "urgent", "planned", ...]}

    Each tag's ``sort_order`` is set to its index in the list.

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    order = request.json.get('order', [])
    if not isinstance(order, list):
        return jsonify({'error': "'order' must be a list of tag names"}), 400

    service = CategoryService(g.db)
    success, error = service.update_tags_order(order)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True})


@categories_bp.route('/api/tags', methods=['PUT'])
def rename_tag() -> Union[Response, Tuple[Response, int]]:
    """
    Rename a non-category tag.

    Body: {"name": "<current name>", "new_name": "<desired name>"}

    Returns 409 with conflict=true when the new name already exists,
    allowing the client to offer a merge via POST /api/tags/merge.

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    name: str = request.json.get('name', '').strip()
    new_name: str = request.json.get('new_name', '').strip()

    if not name:
        return jsonify({'error': 'Tag name required'}), 400
    if not new_name:
        return jsonify({'error': 'New tag name required'}), 400

    service = CategoryService(g.db)
    success, error = service.update_tag(name, new_name)

    if error:
        if 'already exists' in error:
            return jsonify({'error': error, 'conflict': True, 'target': new_name}), 409
        return jsonify({'error': error}), 400

    return jsonify({'success': True, 'tag': new_name})


@categories_bp.route('/api/tags/merge', methods=['POST'])
def merge_tag() -> Union[Response, Tuple[Response, int]]:
    """
    Merge one tag into another.

    Body: {"source": "<tag to merge from>", "target": "<tag to merge into>"}

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    source_name: str = request.json.get('source', '').strip()
    target_name: str = request.json.get('target', '').strip()

    if not source_name:
        return jsonify({'error': 'Source tag name required'}), 400
    if not target_name:
        return jsonify({'error': 'Target tag name required'}), 400

    service = CategoryService(g.db)
    success, error = service.merge_tag(source_name, target_name)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True, 'tag': target_name})


@categories_bp.route('/api/tags', methods=['DELETE'])
def delete_tag() -> Union[Response, Tuple[Response, int]]:
    """
    Delete a non-category tag.

    Body: {"name": "<tag name>"}

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    tag_name: str = request.json.get('name', '').strip()

    if not tag_name:
        return jsonify({'error': 'Tag name required'}), 400

    service = CategoryService(g.db)
    success, error = service.delete_tag(tag_name)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True})

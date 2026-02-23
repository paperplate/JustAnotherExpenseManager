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
    Get all categories.

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
        tag, error = service.create_category(category_name)

        if error:
            return jsonify({'error': error}), 400

        return jsonify({'success': True, 'category': category_name})
    except Exception as exc:  # pylint: disable=broad-except
        g.db.rollback()
        return jsonify({'error': f'Failed to create category: {str(exc)}'}), 500


@categories_bp.route('/api/categories/<category_name>', methods=['PUT'])
def update_category(category_name: str) -> Union[Response, Tuple[Response, int]]:
    """
    Update a category name.

    Returns 409 with conflict=true when the new name already exists,
    allowing the client to offer a merge.

    Args:
        category_name: Current category name

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    new_name: str = request.json.get('name', '').strip().lower()

    if not new_name:
        return jsonify({'error': 'Category name required'}), 400

    service = CategoryService(g.db)
    success, error = service.update_category(category_name, new_name)

    if error:
        if 'already exists' in error:
            return jsonify({'error': error, 'conflict': True, 'target': new_name}), 409
        return jsonify({'error': error}), 400

    return jsonify({'success': True, 'category': new_name})


@categories_bp.route('/api/categories/<category_name>/merge', methods=['POST'])
def merge_category(category_name: str) -> Union[Response, Tuple[Response, int]]:
    """
    Merge category_name into another existing category.

    Args:
        category_name: Source category name (will be deleted after merge)

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    target_name: str = request.json.get('target', '').strip().lower()

    if not target_name:
        return jsonify({'error': 'Target category name required'}), 400

    service = CategoryService(g.db)
    success, error = service.merge_categories(category_name, target_name)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True, 'category': target_name})


@categories_bp.route('/api/categories/<category_name>', methods=['DELETE'])
def delete_category(category_name: str) -> Union[Response, Tuple[Response, int]]:
    """
    Delete a category.

    Args:
        category_name: Name of category to delete

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    service = CategoryService(g.db)
    success, error = service.delete_category(category_name)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True})


@categories_bp.route('/api/tags', methods=['GET'])
def get_tags() -> Response:
    """
    Get all non-category tags.

    Returns:
        Response: JSON response with list of tags
    """
    service = CategoryService(g.db)
    tags = service.get_all_tags()
    return jsonify(tags)


@categories_bp.route('/api/tags/<tag_name>', methods=['PUT'])
def rename_tag(tag_name: str) -> Union[Response, Tuple[Response, int]]:
    """
    Rename a non-category tag.

    Returns 409 with conflict=true when the new name already exists,
    allowing the client to offer a merge.

    Args:
        tag_name: Current tag name

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    new_name: str = request.json.get('name', '').strip()

    if not new_name:
        return jsonify({'error': 'Tag name required'}), 400

    service = CategoryService(g.db)
    success, error = service.rename_tag(tag_name, new_name)

    if error:
        if 'already exists' in error:
            return jsonify({'error': error, 'conflict': True, 'target': new_name}), 409
        return jsonify({'error': error}), 400

    return jsonify({'success': True, 'tag': new_name})


@categories_bp.route('/api/tags/<tag_name>/merge', methods=['POST'])
def merge_tag(tag_name: str) -> Union[Response, Tuple[Response, int]]:
    """
    Merge tag_name into another existing tag.

    Args:
        tag_name: Source tag name (will be deleted after merge)

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    if not request.json:
        return jsonify({'error': 'Invalid request'}), 400

    target_name: str = request.json.get('target', '').strip()

    if not target_name:
        return jsonify({'error': 'Target tag name required'}), 400

    service = CategoryService(g.db)
    success, error = service.merge_tags(tag_name, target_name)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True, 'tag': target_name})


@categories_bp.route('/api/tags/<tag_name>', methods=['DELETE'])
def delete_tag(tag_name: str) -> Union[Response, Tuple[Response, int]]:
    """
    Delete a non-category tag.

    Args:
        tag_name: Name of tag to delete

    Returns:
        Union[Response, Tuple[Response, int]]: JSON response with success or error
    """
    service = CategoryService(g.db)
    success, error = service.delete_tag(tag_name)

    if error:
        return jsonify({'error': error}), 400

    return jsonify({'success': True})

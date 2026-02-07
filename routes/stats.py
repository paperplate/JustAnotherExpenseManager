"""
Routes for statistics and summary.
"""

from flask import Blueprint, render_template, request, jsonify
from utils.database import get_db, DATABASE_TYPE
from utils.services import StatsService
from models import Tag

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/')
@stats_bp.route('/summary')
def summary():
    """Display summary page."""
    return render_template('summary.html')


@stats_bp.route('/api/stats')
def get_stats():
    """Get statistics data with support for multiple categories and tags."""
    # Handle multiple categories
    categories_param = request.args.get('categories', None)
    tags_param = request.args.get('tags', None)
    time_range = request.args.get('range', None)
    start_date = request.args.get('start_date', None)
    end_date = request.args.get('end_date', None)
    page = request.args.get('page', 1, type=int)
    per_page = 6  # Show 6 months per page

    db = get_db()
    try:
        service = StatsService(db, DATABASE_TYPE)

        # Get summary stats
        stats = service.get_summary_stats(
            categories_param,
            time_range,
            start_date,
            end_date,
            tags_param)

        # Get all categories for dropdown
        categories = db.query(Tag).filter(Tag.name.like('category:%')).all()

        # Get category breakdown
        category_breakdown = service.get_category_breakdown(
            categories_param,
            time_range,
            start_date,
            end_date,
            tags_param)

        # Get monthly data with pagination
        monthly = service.get_monthly_data(
            categories_param,
            time_range,
            start_date,
            end_date,
            limit=per_page,
            tag_filter=tags_param)

        # Calculate pagination for monthly data
        total_months = service.count_months(
            categories_param,
            time_range,
            start_date,
            end_date,
            tags_param)
        total_pages = (total_months + per_page - 1) // per_page if total_months > 0 else 1

        return render_template('stats.html',
                             income=stats['income'],
                             expenses=stats['expenses'],
                             net=stats['net'],
                             categories=categories,
                             selected_category=categories_param,
                             time_range=time_range,
                             start_date=start_date,
                             end_date=end_date,
                             category_breakdown=category_breakdown,
                             monthly=monthly,
                             pagination={'page': page, 'total_pages': total_pages})
    finally:
        db.close()


@stats_bp.route('/api/chart-data')
def chart_data():
    """Get chart data in JSON format with support for multiple categories and tags."""
    categories_param = request.args.get('categories', None)
    tags_param = request.args.get('tags', None)
    time_range = request.args.get('range', None)
    start_date = request.args.get('start_date', None)
    end_date = request.args.get('end_date', None)

    db = get_db()
    try:
        service = StatsService(db, DATABASE_TYPE)

        # Category data
        category_data = service.get_category_breakdown(
            categories_param,
            time_range,
            start_date,
            end_date,
            tags_param)

        # Monthly data
        monthly_data = service.get_monthly_data(
            categories_param,
            time_range,
            start_date,
            end_date,
            limit=12,
            tag_filter=tags_param)

        return jsonify({
            'categories': {
                'labels': [cat[0] for cat in category_data],
                'expenses': [float(cat[1]) for cat in category_data],
                'income': [float(cat[2]) for cat in category_data]
            },
            'monthly': {
                'labels': [mon[0] for mon in monthly_data],
                'expenses': [float(mon[1]) for mon in monthly_data],
                'income': [float(mon[2]) for mon in monthly_data]
            }
        })
    finally:
        db.close()

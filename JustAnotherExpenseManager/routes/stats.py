"""
Routes for statistics and summary.
"""

from typing import Optional, Dict
from flask import Blueprint, render_template, request, jsonify, Response
from JustAnotherExpenseManager.utils.database import get_db, DATABASE_TYPE
from JustAnotherExpenseManager.utils.services import StatsService
from JustAnotherExpenseManager.models import Tag

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/')
@stats_bp.route('/summary')
def summary() -> str:
    """
    Display summary page.

    Returns:
        str: Rendered summary HTML template
    """
    return render_template('summary.html')


@stats_bp.route('/api/stats')
def get_stats() -> str:
    """
    Get statistics data with support for multiple categories and tags.

    Returns:
        str: Rendered stats HTML template with data
    """
    # Handle multiple categories
    categories_param: Optional[str] = request.args.get('categories', None)
    tags_param: Optional[str] = request.args.get('tags', None)
    time_range: Optional[str] = request.args.get('range', None)
    start_date: Optional[str] = request.args.get('start_date', None)
    end_date: Optional[str] = request.args.get('end_date', None)
    page: int = request.args.get('page', 1, type=int)
    per_page: int = 6  # Show 6 months per page

    db = get_db()
    try:
        service = StatsService(db, DATABASE_TYPE)

        # Get summary stats
        stats: Dict[str, float] = service.get_summary_stats(
            categories_param, time_range, start_date, end_date, tags_param
        )

        # Get all categories for dropdown
        categories = db.query(Tag).filter(Tag.name.like('category:%')).all()

        # Get category breakdown
        category_breakdown = service.get_category_breakdown(
            categories_param, time_range, start_date, end_date, tags_param
        )

        # Get monthly data with pagination
        monthly = service.get_monthly_data(
            categories_param, time_range, start_date, end_date,
            limit=per_page, tag_filter=tags_param
        )

        # Calculate pagination for monthly data
        total_months: int = service.count_months(
            categories_param, time_range, start_date, end_date, tags_param
        )
        total_pages: int = (total_months + per_page - 1) // per_page if total_months > 0 else 1

        return render_template(
            'stats.html',
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
            pagination={'page': page, 'total_pages': total_pages}
        )
    finally:
        db.close()


@stats_bp.route('/api/chart-data')
def chart_data() -> Response:
    """
    Get chart data in JSON format with support for multiple categories and tags.

    Returns:
        Response: JSON response with chart data
    """
    categories_param: Optional[str] = request.args.get('categories', None)
    tags_param: Optional[str] = request.args.get('tags', None)
    time_range: Optional[str] = request.args.get('range', None)
    start_date: Optional[str] = request.args.get('start_date', None)
    end_date: Optional[str] = request.args.get('end_date', None)

    db = get_db()
    try:
        service = StatsService(db, DATABASE_TYPE)

        # Category data
        category_data = service.get_category_breakdown(
            categories_param, time_range, start_date, end_date, tags_param
        )

        # Monthly data
        monthly_data = service.get_monthly_data(
            categories_param, time_range, start_date, end_date,
            limit=12, tag_filter=tags_param
        )

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

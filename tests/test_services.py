"""
Test suite for the service layer.
Tests business logic and database operations directly, without HTTP.
"""

import pytest
from JustAnotherExpenseManager.models import TransactionType
from JustAnotherExpenseManager.utils.services import (
    TransactionService,
    StatsService,
    CategoryService,
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_service(db):
    return TransactionService(db)


def _create(service, description, amount, trans_type, date, category=None, tags=None):
    """Thin wrapper that accepts a plain string type for convenience."""
    return service.create_transaction(
        description=description,
        amount_dollars=amount,
        type=TransactionType(trans_type),
        date=date,
        category=category,
        tags=tags or [],
    )


# ---------------------------------------------------------------------------
# TransactionService — CRUD
# ---------------------------------------------------------------------------

class TestTransactionCRUD:
    """Create / read / update / delete operations."""

    def test_create_returns_positive_id(self, app, db):
        service = _make_service(db)
        trans_id = _create(service, 'Expense', 100.00, 'expense', '2026-02-01',
                           category='food', tags=['test'])
        assert trans_id is not None and trans_id > 0

    def test_create_stores_correct_fields(self, app, db):
        service = _make_service(db)
        _create(service, 'Salary', 5000.00, 'income', '2026-02-01',
                category='salary', tags=['recurring'])

        result = service.get_all_transactions()
        t = result['transactions'][0]
        assert t.description == 'Salary'
        assert t.type == TransactionType.INCOME
        assert t.amount_dollars == 5000.00

    def test_create_without_category(self, app, db):
        service = _make_service(db)
        _create(service, 'Uncategorised', 50.00, 'expense', '2026-02-01')

        t = service.get_all_transactions()['transactions'][0]
        assert t.category is None

    def test_create_with_multiple_tags(self, app, db):
        service = _make_service(db)
        _create(service, 'Tagged', 50.00, 'expense', '2026-02-01',
                category='food', tags=['tag1', 'tag2', 'tag3'])

        t = service.get_all_transactions()['transactions'][0]
        tag_names = [tag.name for tag in t.tags]
        assert 'tag1' in tag_names
        assert 'tag2' in tag_names
        assert 'tag3' in tag_names
        assert 'category:food' in tag_names

    def test_update_changes_fields(self, app, db):
        service = _make_service(db)
        trans_id = _create(service, 'Original', 100.00, 'expense', '2026-02-01',
                           category='food', tags=['test'])

        result = service.update_transaction(
            transaction_id=trans_id,
            description='Updated',
            amount_dollars=200.00,
            type=TransactionType.EXPENSE,
            date='2026-02-02',
            category='transport',
            tags=['new-tag'],
        )
        assert result is True

        t = service.get_all_transactions()['transactions'][0]
        assert t.description == 'Updated'
        assert t.amount_dollars == 200.00
        assert t.category == 'transport'

    def test_update_nonexistent_raises(self, app, db):
        service = _make_service(db)
        with pytest.raises(ValueError):
            service.update_transaction(
                transaction_id=99999,
                description='X',
                amount_dollars=1.00,
                type=TransactionType.EXPENSE,
                date='2026-02-01',
            )

    def test_delete_removes_transaction(self, app, db):
        service = _make_service(db)
        trans_id = _create(service, 'Delete Me', 100.00, 'expense', '2026-02-01',
                           category='food')
        service.delete_transaction(trans_id)
        assert service.get_all_transactions()['total'] == 0

    def test_delete_nonexistent_returns_false(self, app, db):
        service = _make_service(db)
        assert service.delete_transaction(99999) is False


# ---------------------------------------------------------------------------
# TransactionService — pagination
# ---------------------------------------------------------------------------

class TestTransactionPagination:
    """Month-based pagination behaviour."""

    def test_totals_across_two_months(self, app, db):
        service = _make_service(db)
        for i in range(3):
            _create(service, f'Jan {i}', 100.00, 'expense', '2026-01-01', category='food')
        for i in range(2):
            _create(service, f'Feb {i}', 100.00, 'expense', '2026-02-01', category='food')

        result = service.get_all_transactions()
        assert result['total'] == 5
        assert result['total_pages'] == 2

    def test_page_1_shows_newest_month(self, app, db):
        service = _make_service(db)
        for i in range(3):
            _create(service, f'Jan {i}', 100.00, 'expense', '2026-01-01', category='food')
        for i in range(2):
            _create(service, f'Feb {i}', 100.00, 'expense', '2026-02-01', category='food')

        page1 = service.get_all_transactions(page=1)
        assert len(page1['transactions']) == 2
        assert page1['current_month'] == '2026-02'

    def test_page_2_shows_older_month(self, app, db):
        service = _make_service(db)
        for i in range(3):
            _create(service, f'Jan {i}', 100.00, 'expense', '2026-01-01', category='food')
        for i in range(2):
            _create(service, f'Feb {i}', 100.00, 'expense', '2026-02-01', category='food')

        page2 = service.get_all_transactions(page=2)
        assert len(page2['transactions']) == 3
        assert page2['current_month'] == '2026-01'

    def test_months_ordered_newest_first(self, app, db):
        service = _make_service(db)
        _create(service, 'Oldest', 100.00, 'expense', '2026-01-01', category='food')
        _create(service, 'Newest', 100.00, 'expense', '2026-03-01', category='food')
        _create(service, 'Middle', 100.00, 'expense', '2026-02-01', category='food')

        result = service.get_all_transactions()
        all_transactions = []
        for page in range(1, result['total_pages'] + 1):
            all_transactions.extend(service.get_all_transactions(page=page)['transactions'])

        descriptions = [t.description for t in all_transactions]
        assert descriptions.index('Newest') < descriptions.index('Middle')
        assert descriptions.index('Middle') < descriptions.index('Oldest')


# ---------------------------------------------------------------------------
# TransactionService — filtering
# ---------------------------------------------------------------------------

class TestTransactionFiltering:
    """Category, tag, and date-range filters."""

    def test_filter_by_single_category(self, app, db):
        service = _make_service(db)
        _create(service, 'Food', 100.00, 'expense', '2026-02-01', category='food')
        _create(service, 'Transport', 50.00, 'expense', '2026-02-01', category='transport')

        result = service.get_all_transactions(categories='food')
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Food'

    def test_filter_by_multiple_categories(self, app, db):
        service = _make_service(db)
        _create(service, 'Food', 100.00, 'expense', '2026-02-01', category='food')
        _create(service, 'Transport', 50.00, 'expense', '2026-02-01', category='transport')
        _create(service, 'Entertainment', 75.00, 'expense', '2026-02-01', category='entertainment')

        result = service.get_all_transactions(categories='food,transport')
        assert result['total'] == 2

    def test_filter_by_tag(self, app, db):
        service = _make_service(db)
        _create(service, 'Recurring', 100.00, 'expense', '2026-02-01',
                category='food', tags=['recurring'])
        _create(service, 'One-time', 50.00, 'expense', '2026-02-01',
                category='food', tags=['one-time'])

        result = service.get_all_transactions(tags='recurring')
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Recurring'

    def test_filter_by_date_range(self, app, db):
        service = _make_service(db)
        _create(service, 'January', 100.00, 'expense', '2026-01-15', category='food')
        _create(service, 'February', 100.00, 'expense', '2026-02-15', category='food')
        _create(service, 'March', 100.00, 'expense', '2026-03-15', category='food')

        result = service.get_all_transactions(start_date='2026-02-01', end_date='2026-02-28')
        assert result['total'] == 1
        assert result['transactions'][0].description == 'February'

    def test_filter_by_category_and_date_range(self, app, db):
        service = _make_service(db)
        _create(service, 'Feb Food', 100.00, 'expense', '2026-02-15', category='food')
        _create(service, 'Jan Food', 100.00, 'expense', '2026-01-15', category='food')
        _create(service, 'Feb Transport', 50.00, 'expense', '2026-02-15', category='transport')

        result = service.get_all_transactions(
            categories='food', start_date='2026-02-01', end_date='2026-02-28'
        )
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Feb Food'

    def test_filter_by_tag_and_date_range(self, app, db):
        service = _make_service(db)
        _create(service, 'Recurring Feb', 100.00, 'expense', '2026-02-15',
                category='food', tags=['recurring'])
        _create(service, 'Recurring Jan', 100.00, 'expense', '2026-01-15',
                category='food', tags=['recurring'])
        _create(service, 'One-time Feb', 50.00, 'expense', '2026-02-15',
                category='food', tags=['one-time'])

        result = service.get_all_transactions(
            tags='recurring', start_date='2026-02-01', end_date='2026-02-28'
        )
        assert result['total'] == 1
        assert result['transactions'][0].description == 'Recurring Feb'


# ---------------------------------------------------------------------------
# Tag deduplication
# ---------------------------------------------------------------------------

class TestTagDeduplication:
    """Tag reuse and deduplication across transactions."""

    def test_category_tag_is_created(self, app, db):
        service = _make_service(db)
        _create(service, 'Test', 100.00, 'expense', '2026-02-01', category='food')

        t = service.get_all_transactions()['transactions'][0]
        assert 'category:food' in [tag.name for tag in t.tags]

    def test_duplicate_tags_are_deduplicated(self, app, db):
        service = _make_service(db)
        _create(service, 'Test', 100.00, 'expense', '2026-02-01',
                category='food', tags=['dup', 'dup', 'other', 'other'])

        t = service.get_all_transactions()['transactions'][0]
        non_cat = [tag.name for tag in t.tags if not tag.name.startswith('category:')]
        assert non_cat.count('dup') == 1
        assert non_cat.count('other') == 1

    def test_shared_tag_reused_across_transactions(self, app, db):
        service = _make_service(db)
        _create(service, 'First', 100.00, 'expense', '2026-02-01',
                category='food', tags=['recurring'])
        _create(service, 'Second', 100.00, 'expense', '2026-02-01',
                category='food', tags=['recurring'])

        result = service.get_all_transactions()['transactions']
        tag1 = next(tag for tag in result[0].tags if tag.name == 'recurring')
        tag2 = next(tag for tag in result[1].tags if tag.name == 'recurring')
        assert tag1.id == tag2.id


# ---------------------------------------------------------------------------
# StatsService
# ---------------------------------------------------------------------------

class TestStatsService:
    """Summary stats, category breakdown, and monthly trends."""

    def test_empty_database_returns_zeros(self, app, db):
        stats = StatsService(db).get_summary_stats()
        assert stats['income'] == 0.0
        assert stats['expenses'] == 0.0
        assert stats['net'] == 0.0

    def test_income_and_expense_totals(self, app, db):
        svc = _make_service(db)
        _create(svc, 'Income', 1000.00, 'income', '2026-02-01', category='salary')
        _create(svc, 'Expense', 300.00, 'expense', '2026-02-01', category='food')

        stats = StatsService(db).get_summary_stats()
        assert stats['income'] == 1000.00
        assert stats['expenses'] == 300.00
        assert stats['net'] == 700.00

    def test_stats_filtered_by_category(self, app, db):
        svc = _make_service(db)
        _create(svc, 'Food', 200.00, 'expense', '2026-02-01', category='food')
        _create(svc, 'Transport', 100.00, 'expense', '2026-02-01', category='transport')

        stats = StatsService(db).get_summary_stats(categories='food')
        assert stats['expenses'] == 200.00

    def test_category_breakdown(self, app, db):
        svc = _make_service(db)
        _create(svc, 'Food 1', 150.00, 'expense', '2026-02-01', category='food')
        _create(svc, 'Food 2', 50.00, 'expense', '2026-02-01', category='food')
        _create(svc, 'Transport', 100.00, 'expense', '2026-02-01', category='transport')

        breakdown = StatsService(db).get_category_breakdown()
        food_stat = next((s for s in breakdown if s[0] == 'food'), None)
        assert food_stat is not None
        assert food_stat[1] == 200.00  # (category_name, expenses, income)

    def test_monthly_data_covers_all_months(self, app, db):
        svc = _make_service(db)
        _create(svc, 'January', 500.00, 'expense', '2026-01-15', category='food')
        _create(svc, 'February', 300.00, 'expense', '2026-02-15', category='food')

        monthly = StatsService(db).get_monthly_data()
        months = [row[0] for row in monthly]
        assert '2026-01' in months
        assert '2026-02' in months


# ---------------------------------------------------------------------------
# CategoryService
# ---------------------------------------------------------------------------

class TestCategoryService:
    """Category CRUD and merge operations via CategoryService."""

    def test_create_category(self, app, db):
        svc = CategoryService(db)
        tag, error = svc.add_category('groceries')
        assert error is None
        assert tag is not None

        names = [c['category_name'] for c in svc.get_all_categories()]
        assert 'groceries' in names

    def test_create_duplicate_category_returns_error(self, app, db):
        svc = CategoryService(db)
        svc.add_category('groceries')
        _, error = svc.add_category('groceries')
        assert error is not None

    def test_update_category_renames(self, app, db):
        svc = CategoryService(db)
        svc.add_category('oldname')
        success, error = svc.update_category('oldname', 'newname')
        assert success is True
        assert error is None

        names = [c['category_name'] for c in svc.get_all_categories()]
        assert 'newname' in names
        assert 'oldname' not in names

    def test_update_category_to_existing_name_returns_error(self, app, db):
        svc = CategoryService(db)
        svc.add_category('alpha')
        svc.add_category('beta')
        success, error = svc.update_category('alpha', 'beta')
        assert success is False
        assert error is not None

    def test_update_category_to_self_is_noop(self, app, db):
        svc = CategoryService(db)
        svc.add_category('alpha')
        success, error = svc.update_category('alpha', 'alpha')
        assert success is True
        assert error is None

    def test_merge_categories_reassigns_transactions(self, app, db):
        trans_svc = _make_service(db)
        cat_svc = CategoryService(db)
        _create(trans_svc, 'Food item', 50.00, 'expense', '2026-02-01', category='food')
        cat_svc.add_category('groceries')
        _create(trans_svc, 'Grocery item', 30.00, 'expense', '2026-02-01', category='groceries')

        success, error = cat_svc.update_category('groceries', 'food')
        assert success is True
        assert error is None

        result = trans_svc.get_all_transactions(categories='food')
        assert result['total'] == 2

    def test_merge_categories_removes_source(self, app, db):
        trans_svc = _make_service(db)
        cat_svc = CategoryService(db)
        cat_svc.add_category('groceries')
        _create(trans_svc, 'Item', 30.00, 'expense', '2026-02-01', category='groceries')

        cat_svc.update_category('groceries', 'food')
        names = [c['category_name'] for c in cat_svc.get_all_categories()]
        assert 'groceries' not in names

    def test_merge_nonexistent_source_returns_error(self, app, db):
        svc = CategoryService(db)
        success, error = svc.update_category('doesnotexist', 'food')
        assert success is False
        assert 'not found' in error.lower()

    def test_delete_category(self, app, db):
        svc = CategoryService(db)
        svc.add_category('temporary')
        success, error = svc.delete_category('temporary')
        assert success is True
        assert error is None

        names = [c['category_name'] for c in svc.get_all_categories()]
        assert 'temporary' not in names


# ---------------------------------------------------------------------------
# CategoryService — tag operations
# ---------------------------------------------------------------------------

class TestTagService:
    """Tag rename, merge, and delete via CategoryService."""

    def _setup_tags(self, db):
        """Create two transactions carrying distinct tags."""
        svc = _make_service(db)
        _create(svc, 'Trans A', 100.00, 'expense', '2026-02-01',
                category='other', tags=['urgent'])
        _create(svc, 'Trans B', 100.00, 'expense', '2026-02-01',
                category='other', tags=['important'])

    def test_rename_tag(self, app, db):
        self._setup_tags(db)
        svc = CategoryService(db)
        success, error = svc.update_tag('important', 'priority')
        assert success is True
        assert error is None
        assert 'priority' in svc.get_all_tags()
        assert 'important' not in svc.get_all_tags()

    def test_rename_tag_to_self_is_noop(self, app, db):
        self._setup_tags(db)
        svc = CategoryService(db)
        success, error = svc.update_tag('urgent', 'urgent')
        assert success is True
        assert error is None

    def test_rename_tag_to_category_prefix_rejected(self, app, db):
        self._setup_tags(db)
        svc = CategoryService(db)
        success, error = svc.update_tag('urgent', 'category:food')
        assert success is False
        assert error is not None

    def test_merge_tags_removes_source(self, app, db):
        self._setup_tags(db)
        svc = CategoryService(db)
        svc.update_tag('important', 'urgent')
        assert 'important' not in svc.get_all_tags()
        assert 'urgent' in svc.get_all_tags()

    def test_merge_nonexistent_source_returns_error(self, app, db):
        self._setup_tags(db)
        svc = CategoryService(db)
        success, error = svc.update_tag('doesnotexist', 'urgent')
        assert success is False
        assert 'not found' in error.lower()

    def test_delete_tag(self, app, db):
        self._setup_tags(db)
        svc = CategoryService(db)
        success, error = svc.delete_tag('urgent')
        assert success is True
        assert error is None
        assert 'urgent' not in svc.get_all_tags()

"""
Routes for transaction operations with month-based pagination.
"""

from flask import Blueprint, render_template, request, jsonify, g
import csv
import itertools
from io import StringIO
from datetime import datetime
from typing import Optional, Dict, Any, List
from JustAnotherExpenseManager.models import TransactionType
from JustAnotherExpenseManager.utils.services import TransactionService

transaction_bp = Blueprint('transactions', __name__)


def _parse_transaction_type(type_str: str) -> TransactionType:
    """Convert string to TransactionType enum."""
    type_str = type_str.lower().strip()
    if type_str == 'income' or type_str == 'credit':
        return TransactionType.INCOME
    elif type_str == 'expense' or type_str == 'debit':
        return TransactionType.EXPENSE
    else:
        raise ValueError(f"Invalid transaction type: {type_str}")


def _compute_month_totals(transactions: List) -> Dict[str, float]:
    """
    Compute income and expense totals for a list of transactions.

    Jinja2 variables mutated inside a {% for %} loop are scoped to that loop
    and never propagate back to the outer template scope, so accumulating totals
    in the template always produces 0.  We compute them here in Python instead
    and pass the results as explicit template variables.

    Returns:
        dict with keys 'month_income' and 'month_expense' (both floats)
    """
    month_income = sum(t.amount_dollars for t in transactions if t.is_income)
    month_expense = sum(t.amount_dollars for t in transactions if not t.is_income)
    return {'month_income': month_income, 'month_expense': month_expense}


def _render_transactions_list(result: Dict[str, Any]) -> str:
    """Render transactions_list.html from a service result dict."""
    totals = _compute_month_totals(result['transactions'])
    return render_template(
        'transactions_list.html',
        transactions=result['transactions'],
        current_month=result['current_month'],
        pagination=result,
        month_income=totals['month_income'],
        month_expense=totals['month_expense'],
    )


@transaction_bp.route('/transactions')
def transactions_page():
    """Display transactions page."""
    page = request.args.get('page', 1, type=int)
    return render_template('transactions.html', page=page)


@transaction_bp.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Get paginated list of transactions (one month per page)."""
    page = request.args.get('page', 1, type=int)

    categories_param: Optional[str] = request.args.get('categories', None)
    tags_param: Optional[str] = request.args.get('tags', None)
    time_range: Optional[str] = request.args.get('range', None)
    start_date: Optional[str] = request.args.get('start_date', None)
    end_date: Optional[str] = request.args.get('end_date', None)

    service = TransactionService(g.db)
    result = service.get_all_transactions(
        page=page,
        categories=categories_param,
        tags=tags_param,
        time_range=time_range,
        start_date=start_date,
        end_date=end_date
    )

    return _render_transactions_list(result)


@transaction_bp.route('/api/transactions', methods=['POST'])
def add_transaction():
    """Add a new transaction."""
    description = request.form.get('description', '').strip()
    amount = request.form.get('amount', 0, type=float)
    type_str = request.form.get('type', 'expense')
    date = request.form.get('date', '')
    category = request.form.get('category', '').lower().strip()
    tags_str = request.form.get('tags', '').strip()

    try:
        trans_type = _parse_transaction_type(type_str)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    tags = [t.strip() for t in tags_str.split(',') if t.strip()] if tags_str else []

    service = TransactionService(g.db)
    try:
        service.create_transaction(
            description=description,
            amount_dollars=amount,
            type=trans_type,
            date=date,
            category=category if category else None,
            tags=tags
        )

        result = service.get_all_transactions(page=1)
        return _render_transactions_list(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@transaction_bp.route('/api/transactions/<int:transaction_id>', methods=['PUT'])
def update_transaction(transaction_id):
    """Update a transaction."""
    description = request.form.get('description', '').strip()
    amount = request.form.get('amount', 0, type=float)
    type_str = request.form.get('type', 'expense')
    date = request.form.get('date', '')
    category = request.form.get('category', '').lower().strip()
    tags_str = request.form.get('tags', '').strip()

    try:
        trans_type = _parse_transaction_type(type_str)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    tags = [t.strip() for t in tags_str.split(',') if t.strip()] if tags_str else []

    service = TransactionService(g.db)
    try:
        service.update_transaction(
            transaction_id=transaction_id,
            description=description,
            amount_dollars=amount,
            type=trans_type,
            date=date,
            category=category if category else None,
            tags=tags
        )

        result = service.get_all_transactions(page=1)
        return _render_transactions_list(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@transaction_bp.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    """Delete a transaction."""
    service = TransactionService(g.db)
    service.delete_transaction(transaction_id)

    result = service.get_all_transactions(page=1)
    return _render_transactions_list(result)


# Source - https://stackoverflow.com/a/16939441
# Posted by Janne Karila
# Retrieved 2026-02-20, License - CC BY-SA 3.0
def lower_first(iterator):
    return itertools.chain([next(iterator).lower()], iterator)


@transaction_bp.route('/api/transactions/import', methods=['POST'])
def import_transactions():
    """Import transactions from CSV.

    Accepts flexible column layouts from different sources:

    Column aliases
    --------------
    description : also accepted as ``name``

    Type inference
    --------------
    If a ``type`` column is present and non-empty it is used directly
    (``income`` / ``expense``).  When the column is absent or blank the
    sign of ``amount`` determines the type: negative → expense,
    positive → income.  The amount stored is always the absolute value.
    """
    if 'csv_file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['csv_file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'File must be a CSV'}), 400

    try:
        stream = StringIO(file.stream.read().decode('UTF8'), newline=None)
        csv_reader = csv.DictReader(lower_first(stream))

        service = TransactionService(g.db)
        imported_count = 0
        errors = []

        for row_num, row in enumerate(csv_reader, start=2):
            try:
                # --- description: accept 'name' as an alias ---
                description = (
                    row.get('name') or row.get('description') or ''
                ).strip()

                amount_str = row.get('amount', '').strip()
                type_str = (row.get('type', '').strip() or row.get('transaction', '').strip())
                category = row.get('category', '').strip().lower()
                date_str = (row.get('date', '').strip() or row.get('transaction date', '').strip())
                if 'T' in date_str:
                    date_str = date_str[:date_str.find('T')]
                tags_str = row.get('tags', '').strip()

                if not description:
                    errors.append(f'Row {row_num}: Missing description')
                    continue

                if not amount_str:
                    errors.append(f'Row {row_num}: Missing amount')
                    continue

                try:
                    amount = float(amount_str)
                except ValueError:
                    errors.append(f'Row {row_num}: Invalid amount "{amount_str}"')
                    continue

                if type_str:
                    try:
                        trans_type = _parse_transaction_type(type_str)
                    except ValueError:
                        errors.append(f'Row {row_num}: Invalid type "{type_str}"')
                        continue
                else:
                    trans_type = TransactionType.INCOME if amount >= 0 else TransactionType.EXPENSE

                amount = abs(amount)

                if not date_str:
                    errors.append(f'Row {row_num}: Missing date')
                    continue

                try:
                    datetime.strptime(date_str, '%Y-%m-%d')
                except ValueError:
                    errors.append(
                        f'Row {row_num}: Invalid date format "{date_str}" (expected YYYY-MM-DD)'
                    )
                    continue

                tags = [t.strip() for t in tags_str.split(',') if t.strip()] if tags_str else []

                service.create_transaction(
                    description=description,
                    amount_dollars=amount,
                    type=trans_type,
                    date=date_str,
                    category=category if category else None,
                    tags=tags
                )
                imported_count += 1

            except Exception as e:  # pylint: disable=broad-except
                errors.append(f'Row {row_num}: {str(e)}')

        response_data: Dict[str, Any] = {
            'success': True,
            'imported': imported_count,
            'errors': errors,
            'message': f'Successfully imported {imported_count} transaction(s)'
        }
        if errors:
            response_data['message'] += f' with {len(errors)} error(s)'

        return jsonify(response_data)

    except Exception as e:  # pylint: disable=broad-except
        return jsonify({'error': f'Failed to process CSV: {str(e)}'}), 500

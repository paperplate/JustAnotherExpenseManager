"""
Routes for transaction operations with month-based pagination.
"""

from flask import Blueprint, render_template, request, jsonify, g
import csv
from io import StringIO
from datetime import datetime
from typing import Optional
from JustAnotherExpenseManager.models import TransactionType
from JustAnotherExpenseManager.utils.services import TransactionService

transaction_bp = Blueprint('transactions', __name__)


def _parse_transaction_type(type_str: str) -> TransactionType:
    """Convert string to TransactionType enum."""
    type_str = type_str.lower().strip()
    if type_str == 'income':
        return TransactionType.INCOME
    elif type_str == 'expense':
        return TransactionType.EXPENSE
    else:
        raise ValueError(f"Invalid transaction type: {type_str}")


@transaction_bp.route('/transactions')
def transactions_page():
    """Display transactions page."""
    page = request.args.get('page', 1, type=int)
    return render_template('transactions.html', page=page)


@transaction_bp.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Get paginated list of transactions (one month per page)."""
    page = request.args.get('page', 1, type=int)

    # Get filter parameters
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

    return render_template('transactions_list.html',
                         transactions=result['transactions'],
                         current_month=result['current_month'],
                         pagination=result)


@transaction_bp.route('/api/transactions', methods=['POST'])
def add_transaction():
    """Add a new transaction."""
    description = request.form.get('description', '').strip()
    amount = request.form.get('amount', 0, type=float)
    type_str = request.form.get('type', 'expense')
    date = request.form.get('date', '')
    category = request.form.get('category', '').lower().strip()
    tags_str = request.form.get('tags', '').strip()

    # Convert string type to enum at API boundary
    try:
        trans_type = _parse_transaction_type(type_str)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    tags = [t.strip() for t in tags_str.split(',') if t.strip()] if tags_str else []

    service = TransactionService(g.db)
    try:
        transaction_id = service.create_transaction(
            description=description,
            amount_dollars=amount,
            type=trans_type,
            date=date,
            category=category if category else None,
            tags=tags
        )

        # Return first page of transactions
        result = service.get_all_transactions(page=1)
        return render_template('transactions_list.html',
                             transactions=result['transactions'],
                             current_month=result['current_month'],
                             pagination=result)
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

    # Convert string type to enum at API boundary
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

        # Return updated transactions list
        result = service.get_all_transactions(page=1)
        return render_template('transactions_list.html',
                             transactions=result['transactions'],
                             current_month=result['current_month'],
                             pagination=result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@transaction_bp.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    """Delete a transaction."""
    service = TransactionService(g.db)
    service.delete_transaction(transaction_id)

    # Return first page of transactions
    result = service.get_all_transactions(page=1)
    return render_template('transactions_list.html',
                         transactions=result['transactions'],
                         current_month=result['current_month'],
                         pagination=result)


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
        csv_reader = csv.DictReader(stream)

        service = TransactionService(g.db)
        imported_count = 0
        errors = []

        for row_num, row in enumerate(csv_reader, start=2):
            try:
                # --- description: accept 'name' as an alias ---
                description = (
                    row.get('description') or row.get('name') or ''
                ).strip()

                amount_str = row.get('amount', '').strip()
                type_str = row.get('type', '').strip()
                category = row.get('category', '').strip().lower()
                date_str = row.get('date', '').strip()
                tags_str = row.get('tags', '').strip()

                if not all([description, amount_str, date_str]):
                    errors.append(f"Row {row_num}: Missing required fields (description/name, amount, date)")
                    continue

                try:
                    amount = float(amount_str)
                except ValueError:
                    errors.append(f"Row {row_num}: Invalid amount '{amount_str}'")
                    continue

                # --- type inference ---
                if type_str:
                    # Explicit type column present — use it, amount must be positive
                    if amount <= 0:
                        errors.append(f"Row {row_num}: Amount must be positive when 'type' is specified")
                        continue
                    try:
                        trans_type = _parse_transaction_type(type_str)
                    except ValueError:
                        errors.append(f"Row {row_num}: Type must be 'income' or 'expense', got '{type_str}'")
                        continue
                else:
                    # No type column — infer from sign; zero is rejected
                    if amount == 0:
                        errors.append(f"Row {row_num}: Amount cannot be zero")
                        continue
                    trans_type = TransactionType.INCOME if amount > 0 else TransactionType.EXPENSE
                    amount = abs(amount)

                try:
                    datetime.strptime(date_str, '%Y-%m-%d')
                except ValueError:
                    errors.append(f"Row {row_num}: Invalid date format '{date_str}' (use YYYY-MM-DD)")
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

            except Exception as row_exc:
                errors.append(f"Row {row_num}: {str(row_exc)}")
                g.db.rollback()

        g.db.commit()

        return jsonify({
            'success': True,
            'imported': imported_count,
            'errors': errors
        })

    except Exception as exc:
        g.db.rollback()
        return jsonify({'error': f'Failed to process CSV: {str(exc)}'}), 500

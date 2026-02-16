"""
Routes for transaction operations.

Handles conversion from frontend strings to backend enums at the API boundary.
"""

from flask import Blueprint, render_template, request, jsonify, g
import csv
from io import StringIO
from datetime import datetime
from typing import Optional
from JustAnotherExpenseManager.models import TransactionType

transaction_bp = Blueprint('transactions', __name__)


def _parse_transaction_type(type_str: str) -> TransactionType:
    """
    Convert string to TransactionType enum.

    Args:
        type_str: "income" or "expense" string

    Returns:
        TransactionType enum

    Raises:
        ValueError: If invalid type
    """
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
    """Get paginated list of transactions with filtering support."""
    from JustAnotherExpenseManager.utils.services import TransactionService

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    # Get filter parameters
    categories_param: Optional[str] = request.args.get('categories', None)
    tags_param: Optional[str] = request.args.get('tags', None)
    time_range: Optional[str] = request.args.get('range', None)
    start_date: Optional[str] = request.args.get('start_date', None)
    end_date: Optional[str] = request.args.get('end_date', None)

    service = TransactionService(g.db)
    result = service.get_all_transactions(
        page=page,
        per_page=per_page,
        categories=categories_param,
        tags=tags_param,
        time_range=time_range,
        start_date=start_date,
        end_date=end_date
    )

    return render_template('transactions_list.html',
                         transactions=result['transactions'],
                         pagination=result)


@transaction_bp.route('/api/transactions', methods=['POST'])
def add_transaction():
    """Add a new transaction."""
    from JustAnotherExpenseManager.utils.services import TransactionService

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
            type=trans_type,  # Pass enum
            date=date,
            category=category if category else None,
            tags=tags
        )

        # Return first page of transactions
        result = service.get_all_transactions(page=1, per_page=50)
        return render_template('transactions_list.html',
                             transactions=result['transactions'],
                             pagination=result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@transaction_bp.route('/api/transactions/<int:transaction_id>', methods=['PUT'])
def update_transaction(transaction_id):
    """Update a transaction."""
    from JustAnotherExpenseManager.utils.services import TransactionService

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
            type=trans_type,  # Pass enum
            date=date,
            category=category if category else None,
            tags=tags
        )

        # Return updated transactions list
        result = service.get_all_transactions(page=1, per_page=50)
        return render_template('transactions_list.html',
                             transactions=result['transactions'],
                             pagination=result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@transaction_bp.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    """Delete a transaction."""
    from JustAnotherExpenseManager.utils.services import TransactionService

    service = TransactionService(g.db)
    service.delete_transaction(transaction_id)

    # Return first page of transactions
    result = service.get_all_transactions(page=1, per_page=50)
    return render_template('transactions_list.html',
                         transactions=result['transactions'],
                         pagination=result)


@transaction_bp.route('/api/transactions/import', methods=['POST'])
def import_transactions():
    """Import transactions from CSV."""
    from JustAnotherExpenseManager.utils.services import TransactionService

    if 'csv_file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['csv_file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'File must be a CSV'}), 400

    try:
        stream = StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)

        service = TransactionService(g.db)
        imported_count = 0
        errors = []

        for row_num, row in enumerate(csv_reader, start=2):
            try:
                description = row.get('description', '').strip()
                amount_str = row.get('amount', '').strip()
                type_str = row.get('type', 'expense').strip()
                category = row.get('category', '').strip().lower()
                date_str = row.get('date', '').strip()
                tags_str = row.get('tags', '').strip()

                if not all([description, amount_str, date_str]):
                    errors.append(f"Row {row_num}: Missing required fields")
                    continue

                try:
                    amount = float(amount_str)
                    if amount <= 0:
                        errors.append(f"Row {row_num}: Amount must be positive")
                        continue
                except ValueError:
                    errors.append(f"Row {row_num}: Invalid amount '{amount_str}'")
                    continue

                # Convert string type to enum
                try:
                    trans_type = _parse_transaction_type(type_str)
                except ValueError:
                    errors.append(f"Row {row_num}: Type must be 'income' or 'expense'")
                    continue

                try:
                    datetime.strptime(date_str, '%Y-%m-%d')
                except ValueError:
                    errors.append(f"Row {row_num}: Invalid date format '{date_str}' (use YYYY-MM-DD)")
                    continue

                tags = [t.strip() for t in tags_str.split(',') if t.strip()] if tags_str else []

                service.create_transaction(
                    description=description,
                    amount_dollars=amount,
                    type=trans_type,  # Pass enum
                    date=date_str,
                    category=category if category else None,
                    tags=tags
                )

                imported_count += 1

            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
                g.db.rollback()

        g.db.commit()

        return jsonify({
            'success': True,
            'imported': imported_count,
            'errors': errors
        })

    except Exception as e:
        g.db.rollback()
        return jsonify({'error': f'Failed to process CSV: {str(e)}'}), 500

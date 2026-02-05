"""
Routes for transaction operations.
"""

from flask import Blueprint, render_template, request, jsonify
import csv
from io import StringIO
from datetime import datetime
from utils.database import get_db
from utils.services import TransactionService

transaction_bp = Blueprint('transactions', __name__)


@transaction_bp.route('/transactions')
def transactions_page():
    """Display transactions page."""
    page = request.args.get('page', 1, type=int)
    return render_template('transactions.html', page=page)


@transaction_bp.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Get paginated list of transactions."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    db = get_db()
    try:
        service = TransactionService(db)
        result = service.get_all_transactions(page=page, per_page=per_page)
        
        return render_template('transactions_list.html', 
                             transactions=result['transactions'],
                             pagination=result)
    finally:
        db.close()


@transaction_bp.route('/api/transactions', methods=['POST'])
def add_transaction():
    """Add a new transaction."""
    description = request.form.get('description')
    amount = float(request.form.get('amount'))
    trans_type = request.form.get('type', 'expense')
    date = request.form.get('date')
    category = request.form.get('category')
    tags_input = request.form.get('tags', '')
    
    db = get_db()
    try:
        service = TransactionService(db)
        tags = [t.strip() for t in tags_input.split(',') if t.strip()]
        
        service.create_transaction(
            description=description,
            amount=amount,
            trans_type=trans_type,
            date=date,
            category=category,
            tags=tags
        )
        
        # Return first page of transactions
        result = service.get_all_transactions(page=1, per_page=50)
        return render_template('transactions_list.html',
                             transactions=result['transactions'],
                             pagination=result)
    finally:
        db.close()


@transaction_bp.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    """Delete a transaction."""
    db = get_db()
    try:
        service = TransactionService(db)
        service.delete_transaction(transaction_id)
        
        # Return first page of transactions
        result = service.get_all_transactions(page=1, per_page=50)
        return render_template('transactions_list.html',
                             transactions=result['transactions'],
                             pagination=result)
    finally:
        db.close()


@transaction_bp.route('/api/transactions/import', methods=['POST'])
def import_transactions():
    """Import transactions from CSV."""
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
        
        db = get_db()
        service = TransactionService(db)
        imported_count = 0
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                description = row.get('description', '').strip()
                amount_str = row.get('amount', '').strip()
                trans_type = row.get('type', 'expense').strip().lower()
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
                
                if trans_type not in ['income', 'expense']:
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
                    amount=amount,
                    trans_type=trans_type,
                    date=date_str,
                    category=category if category else None,
                    tags=tags
                )
                
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        db.close()
        
        return jsonify({
            'success': True,
            'imported': imported_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to process CSV: {str(e)}'}), 500

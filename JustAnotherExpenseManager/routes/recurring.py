from flask import Blueprint, request, jsonify, render_template, current_app
from datetime import datetime
from pydantic import ValidationError

from JustAnotherExpenseManager.models.dtos import RecurringFrequency, TransactionType
from JustAnotherExpenseManager.models import RecurringTransaction, Tag
from JustAnotherExpenseManager.utils.database import db
from JustAnotherExpenseManager.utils.services import TransactionService

recurring_bp = Blueprint('recurring', __name__, url_prefix='/recurring')

@recurring_bp.route('', methods=['GET'])
def index():
    return render_template('recurring.html')

@recurring_bp.route('/api', methods=['GET'])
def list_recurring():
    txs = db.session.query(RecurringTransaction).all()
    return jsonify([tx.to_dict() for tx in txs])

@recurring_bp.route('/api', methods=['POST'])
def create_recurring():
    data = request.json
    if not data:
        return jsonify({'error', 'Request body must be valid JSON'}), 400
    try:
        tx = RecurringTransaction(
            description=data['description'],
            amount_cents=int(round(data['amount_dollars'] * 100)),
            type=TransactionType(data['type']),
            frequency=RecurringFrequency(data['frequency']),
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d'),
            next_date=datetime.strptime(data['start_date'], '%Y-%m-%d'),
            is_active=True
        )
        if 'end_date' in data and data['end_date']:
            tx.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')
            if tx.end_date < tx.start_date:
                return jsonify({'error': 'end_date cannot be before start_date'}), 400

        if 'category' in data and data['category']:
            svc = TransactionService(db.session)
            tag = svc._get_or_create_tag(f"category:{data['category']}")
            tx.tags.append(tag)
 
        if 'tags' in data and data['tags']:
            svc = TransactionService(db.session)
            for t in data['tags']:
                tag = svc._get_or_create_tag(t)
                tx.tags.append(tag)

        db.session.add(tx)
        db.session.commit()
        return jsonify(tx.to_dict()), 201
    except ValueError as e:
        current_app.logger.error(f"Invalid enum value: {e}")
        return jsonify({"error": str(e)}), 400
    except KeyError as e:
        return jsonify({"error": f"Missing field: {e}"}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Failed to create recurring transaction: {e}')
        return jsonify({"error": f'Internal server error: {e}'}), 500

@recurring_bp.route('/api/<int:tx_id>', methods=['DELETE'])
def delete_recurring(tx_id):
    tx = db.session.get(RecurringTransaction, tx_id)
    if not tx:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(tx)
    db.session.commit()
    return jsonify({"success": True}), 200

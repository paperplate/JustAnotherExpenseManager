import pytest
from datetime import datetime, timedelta
from JustAnotherExpenseManager.models import RecurringTransaction, Transaction
from JustAnotherExpenseManager.models.dtos import RecurringFrequency, TransactionType
from JustAnotherExpenseManager.utils.services import process_recurring_transactions

class TestRecurringRoutes:
    def test_list_empty(self, client):
        response = client.get('/recurring/api')
        assert response.status_code == 200
        assert response.json == []

    def test_create_recurring(self, client, db):
        data = {
            "description": "Netflix",
            "amount_dollars": 15.99,
            "type": "expense",
            "category": "entertainment",
            "frequency": "monthly",
            "start_date": "2023-01-01",
            "tags": ["streaming", "subscription"]
        }
        response = client.post('/recurring/api', json=data)
        assert response.status_code == 201

        # Verify in DB
        txs = db.query(RecurringTransaction).all()
        assert len(txs) == 1
        assert txs[0].description == "Netflix"
        assert txs[0].amount_cents == 1599
        assert txs[0].type == TransactionType.EXPENSE
        assert txs[0].frequency == RecurringFrequency.MONTHLY
        assert txs[0].category == "entertainment"
        assert len(txs[0].tags) == 3 # category + 2 tags

    def test_create_recurring_invalid_data(self, client):
        data = {
            "description": "Netflix",
            "amount_dollars": 15.99,
            "type": "invalid_type",
            "frequency": "monthly",
            "start_date": "2023-01-01"
        }
        response = client.post('/recurring/api', json=data)
        assert response.status_code == 400

    def test_delete_recurring(self, client, db):
        # Create one first
        data = {
            "description": "Netflix",
            "amount_dollars": 15.99,
            "type": "expense",
            "frequency": "monthly",
            "start_date": "2023-01-01"
        }
        post_resp = client.post('/recurring/api', json=data)
        tx_id = post_resp.json['id']

        # Delete it
        del_resp = client.delete(f'/recurring/api/{tx_id}')
        assert del_resp.status_code == 200

        # Verify it's gone
        txs = db.query(RecurringTransaction).all()
        assert len(txs) == 0

class TestRecurringService:
    def test_process_recurring_transactions(self, app, db):
        with app.app_context():
            # Create a recurring transaction in the past that should trigger today
            today = datetime.now()
            past_date = today - timedelta(days=1)

            tx = RecurringTransaction(
                description="Daily Coffee",
                amount_cents=500,
                type=TransactionType.EXPENSE,
                frequency=RecurringFrequency.DAILY,
                start_date=past_date,
                next_date=past_date,
                is_active=True
            )
            db.add(tx)
            db.commit()

            # Run processor
            process_recurring_transactions()

            # Verify transaction was created
            spawned_txs = db.query(Transaction).filter_by(description="Daily Coffee").all()
            # Since past_date is yesterday, it will spawn for yesterday and today = 2
            assert len(spawned_txs) == 2
            assert spawned_txs[0].amount_cents == 500
            assert spawned_txs[0].date == past_date
            assert spawned_txs[0].recurring_id == tx.id

            # Verify next_date is updated
            db.refresh(tx)
            assert tx.next_date > past_date

            # Since it's daily, next_date should be past_date + 1 day
            # Wait, our logic sets next_date. If it's daily, past_date + 1 day = today
            # But process_recurring_transactions runs a while loop until next_date > today!
            assert tx.next_date > today or tx.next_date.date() > today.date()

    def test_process_does_not_spawn_future(self, app, db):
        with app.app_context():
            future_date = datetime.now() + timedelta(days=5)
            tx = RecurringTransaction(
                description="Future sub",
                amount_cents=1000,
                type=TransactionType.EXPENSE,
                frequency=RecurringFrequency.MONTHLY,
                start_date=future_date,
                next_date=future_date,
                is_active=True
            )
            db.add(tx)
            db.commit()

            process_recurring_transactions()

            spawned_txs = db.query(Transaction).filter_by(description="Future sub").all()
            assert len(spawned_txs) == 0

    def test_process_stops_after_end_date(self, app, db):
        with app.app_context():
            past_date = datetime.now() - timedelta(days=10)
            end_date = datetime.now() - timedelta(days=8)

            tx = RecurringTransaction(
                description="Ended sub",
                amount_cents=1000,
                type=TransactionType.EXPENSE,
                frequency=RecurringFrequency.DAILY,
                start_date=past_date,
                next_date=past_date,
                end_date=end_date,
                is_active=True
            )
            db.add(tx)
            db.commit()

            process_recurring_transactions()

            spawned_txs = db.query(Transaction).filter_by(description="Ended sub").all()

            # It should spawn for past_date, past_date+1, past_date+2 (which is end_date).
            # So exactly 3 transactions.
            assert len(spawned_txs) == 3

            # And it should become inactive
            db.refresh(tx)
            assert not tx.is_active

    def test_process_weekly_transactions(self, app, db):
        with app.app_context():
            today = datetime.now()
            past_date = today - timedelta(days=14)

            tx = RecurringTransaction(
                description="Weekly sub",
                amount_cents=1500,
                type=TransactionType.EXPENSE,
                frequency=RecurringFrequency.WEEKLY,
                start_date=past_date,
                next_date=past_date,
                is_active=True
            )
            db.add(tx)
            db.commit()

            process_recurring_transactions()

            spawned_txs = db.query(Transaction).filter_by(description="Weekly sub").all()
            assert len(spawned_txs) == 3
            
            db.refresh(tx)
            assert tx.next_date > today or tx.next_date.date() > today.date()

    def test_process_monthly_transactions_edge_case(self, app, db):
        with app.app_context():
            start_date = datetime(2023, 1, 31, 10, 0, 0)
            end_date = datetime(2023, 4, 1, 10, 0, 0)
            
            tx = RecurringTransaction(
                description="Monthly Edge",
                amount_cents=2000,
                type=TransactionType.EXPENSE,
                frequency=RecurringFrequency.MONTHLY,
                start_date=start_date,
                next_date=start_date,
                end_date=end_date,
                is_active=True
            )
            db.add(tx)
            db.commit()

            process_recurring_transactions()

            spawned_txs = db.query(Transaction).filter_by(description="Monthly Edge").order_by(Transaction.date).all()
            assert len(spawned_txs) == 3
            assert spawned_txs[0].date == datetime(2023, 1, 31, 10, 0, 0)
            assert spawned_txs[1].date == datetime(2023, 2, 28, 10, 0, 0)
            assert spawned_txs[2].date == datetime(2023, 3, 28, 10, 0, 0)

    def test_process_yearly_leap_year(self, app, db):
        with app.app_context():
            start_date = datetime(2020, 2, 29, 10, 0, 0)
            end_date = datetime(2024, 3, 1, 10, 0, 0)
            
            tx = RecurringTransaction(
                description="Yearly Leap",
                amount_cents=5000,
                type=TransactionType.EXPENSE,
                frequency=RecurringFrequency.YEARLY,
                start_date=start_date,
                next_date=start_date,
                end_date=end_date,
                is_active=True
            )
            db.add(tx)
            db.commit()

            process_recurring_transactions()

            spawned_txs = db.query(Transaction).filter_by(description="Yearly Leap").order_by(Transaction.date).all()
            assert len(spawned_txs) == 5
            assert spawned_txs[0].date == datetime(2020, 2, 29, 10, 0, 0)
            assert spawned_txs[1].date == datetime(2021, 2, 28, 10, 0, 0)
            assert spawned_txs[2].date == datetime(2022, 2, 28, 10, 0, 0)
            assert spawned_txs[3].date == datetime(2023, 2, 28, 10, 0, 0)
            assert spawned_txs[4].date == datetime(2024, 2, 28, 10, 0, 0)

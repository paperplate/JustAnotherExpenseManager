from flask_apscheduler import APScheduler
from JustAnotherExpenseManager.utils.services import process_recurring_transactions

scheduler = APScheduler()

def init_scheduler(app):
    scheduler.init_app(app)

    if not app.config.get('TESTING', False):
        scheduler.start()

    # Run daily at midnight
    @scheduler.task('cron', id='process_recurring', day='*', hour=0, minute=0)
    def run_process_recurring_transactions():
        with scheduler.app.app_context():
            process_recurring_transactions()

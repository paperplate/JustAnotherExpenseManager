"""
Tests for utils/database.py.
Covers build_database_url URL construction for all supported backends,
and the check_health() helper.
"""


class TestBuildDatabaseUrl:
    """Verify URL construction for each supported database type."""

    def test_sqlite_url_contains_sqlite_scheme(self):
        from JustAnotherExpenseManager.utils.database import build_database_url
        url = build_database_url(db_type='sqlite', sqlite_path='/tmp/test.db')
        assert url.startswith('sqlite:///')
        assert 'test.db' in url

    def test_postgres_url_contains_host_and_dbname(self):
        from JustAnotherExpenseManager.utils.database import build_database_url
        url = build_database_url(
            db_type='postgresql',
            db_host='localhost',
            db_port='5432',
            db_name='expenses',
            db_user='user',
            db_password='pass',
        )
        assert 'postgresql' in url
        assert 'localhost' in url
        assert 'expenses' in url

    def test_mysql_url_uses_pymysql_driver(self):
        from JustAnotherExpenseManager.utils.database import build_database_url
        url = build_database_url(
            db_type='mysql',
            db_host='localhost',
            db_port='3306',
            db_name='expenses',
            db_user='user',
            db_password='pass',
        )
        assert 'mysql' in url
        assert 'pymysql' in url
        assert 'localhost' in url

    def test_unknown_type_falls_back_to_sqlite(self):
        from JustAnotherExpenseManager.utils.database import build_database_url
        url = build_database_url(db_type='unknown_db')
        assert url.startswith('sqlite:///')

    def test_check_health_returns_true_in_app_context(self, app):
        from JustAnotherExpenseManager.utils.database import check_health
        with app.app_context():
            assert check_health() is True

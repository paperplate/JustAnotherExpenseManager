"""
Application configuration.

Select a configuration by setting the ``JAEM_CONFIG`` environment variable:

    JAEM_CONFIG=debug       → DebugConfig      (local development, debug toolbar)
    JAEM_CONFIG=testing     → TestingConfig    (automated tests — pytest / Playwright)
    JAEM_CONFIG=production  → ProductionConfig (default; Docker / server deployments)

Any attribute defined on the active config class can be overridden at runtime by
setting the corresponding environment variable.  This is the recommended way to
customise the application inside a Docker container, e.g.::

    docker run -e SECRET_KEY=mysecret -e DATABASE_TYPE=postgresql ...

Unknown ``JAEM_CONFIG`` values fall back to ``ProductionConfig`` so the application
never accidentally runs in a permissive mode.
"""

import os


class Config:
    """Base configuration shared by all environments."""

    # ------------------------------------------------------------------ #
    # Security                                                             #
    # ------------------------------------------------------------------ #
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'dev-insecure-default-change-me')

    # ------------------------------------------------------------------ #
    # Flask internals                                                      #
    # ------------------------------------------------------------------ #
    TESTING: bool = False
    DEBUG: bool = False
    WTF_CSRF_ENABLED: bool = True

    # ------------------------------------------------------------------ #
    # SQLAlchemy                                                           #
    # ------------------------------------------------------------------ #
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False

    # ------------------------------------------------------------------ #
    # Database — backend type and connection details                       #
    # ------------------------------------------------------------------ #
    DATABASE_TYPE: str = os.environ.get('DATABASE_TYPE', 'sqlite')
    SQLITE_PATH: str = os.environ.get('SQLITE_PATH', '/app/data/expenses.db')
    DATABASE_HOST: str | None = os.environ.get('DATABASE_HOST')
    DATABASE_PORT: str | None = os.environ.get('DATABASE_PORT')
    DATABASE_NAME: str | None = os.environ.get('DATABASE_NAME')
    DATABASE_USER: str | None = os.environ.get('DATABASE_USER')
    DATABASE_PASSWORD: str | None = os.environ.get('DATABASE_PASSWORD')

    # ------------------------------------------------------------------ #
    # Server binding                                                       #
    # ------------------------------------------------------------------ #
    FLASK_RUN_HOST: str = os.environ.get('FLASK_RUN_HOST', '0.0.0.0')
    FLASK_RUN_PORT: int = int(os.environ.get('FLASK_RUN_PORT', '5000'))

    # ------------------------------------------------------------------ #
    # Application features                                                 #
    # ------------------------------------------------------------------ #
    # Enables the /api/populate-test-data endpoint and similar dev helpers.
    ENABLE_TEST_ROUTES: bool = False


class DebugConfig(Config):
    """
    Development configuration.

    Enables Flask debug mode, the debug toolbar, and test routes.
    Defaults to binding on localhost only for safety.
    """

    DEBUG: bool = True
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'debug-secret-key-change-me')
    SQLITE_PATH: str = os.environ.get('SQLITE_PATH', './data/debug.db')
    FLASK_RUN_HOST: str = os.environ.get('FLASK_RUN_HOST', '127.0.0.1')
    ENABLE_TEST_ROUTES: bool = True


class TestingConfig(Config):
    """
    Test configuration.

    Used by pytest and Playwright.  CSRF protection is disabled and a
    temporary in-memory / file database is used so tests never touch
    production data.
    """

    TESTING: bool = True
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'test-secret-key')
    WTF_CSRF_ENABLED: bool = False
    DATABASE_TYPE: str = 'sqlite'
    SQLITE_PATH: str = os.environ.get('SQLITE_PATH', './test-expenses.db')
    FLASK_RUN_HOST: str = os.environ.get('FLASK_RUN_HOST', '127.0.0.1')
    FLASK_RUN_PORT: int = int(os.environ.get('FLASK_RUN_PORT', '5005'))
    ENABLE_TEST_ROUTES: bool = True


class ProductionConfig(Config):
    """
    Production configuration.

    Inherits all defaults from ``Config``.  The only required override at
    runtime is ``SECRET_KEY`` — the application will log a warning if the
    insecure default is still in use.

    Recommended environment variables for a Docker deployment::

        SECRET_KEY=<strong-random-value>
        DATABASE_TYPE=postgresql          # or mysql / sqlite
        DATABASE_HOST=db
        DATABASE_NAME=expenses
        DATABASE_USER=expenses_user
        DATABASE_PASSWORD=<password>
        FLASK_RUN_HOST=0.0.0.0            # already the default
        FLASK_RUN_PORT=5000               # already the default
    """


# ------------------------------------------------------------------ #
# Config registry and factory helper                                  #
# ------------------------------------------------------------------ #

_CONFIG_MAP: dict[str, type[Config]] = {
    'debug': DebugConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
}


def get_config_class(name: str | None = None) -> type[Config]:
    """
    Return the config class that corresponds to *name*.

    When *name* is ``None`` the value of the ``JAEM_CONFIG`` environment
    variable is used, defaulting to ``'production'``.  Unknown names also
    fall back to ``ProductionConfig``.

    Args:
        name: One of ``'debug'``, ``'testing'``, or ``'production'``.

    Returns:
        A :class:`Config` subclass (not an instance).
    """
    if name is None:
        name = os.environ.get('JAEM_CONFIG', 'production')
    return _CONFIG_MAP.get(name.lower(), ProductionConfig)

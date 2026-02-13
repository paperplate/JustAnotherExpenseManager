.PHONY: test test-unit test-integration test-cov test-fast test-all clean install help

# Default target
.DEFAULT_GOAL := help

# Variables
PYTHON := python3
PYTEST := pytest
PIP := pip3

help:  ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

install:  ## Install all dependencies including test dependencies
	$(PIP) install -e ".[test,dev]"

install-prod:  ## Install production dependencies only
	$(PIP) install -e .

install-test:  ## Install test dependencies only
	$(PIP) install -e ".[test]"

install-dev:  ## Install development dependencies only
	$(PIP) install -e ".[dev]"

install-all:  ## Install all optional dependencies
	$(PIP) install -e ".[all]"

test:  ## Run all tests with coverage
	$(PYTEST) -v --cov=. --cov-report=term-missing --cov-report=html

test-unit:  ## Run only unit tests (models and services)
	$(PYTEST) tests/test_models.py tests/test_services.py -v

test-routes:  ## Run only route tests
	$(PYTEST) tests/test_routes.py -v

test-integration:  ## Run only integration tests
	$(PYTEST) tests/test_integration.py -v

test-fast:  ## Run tests excluding slow tests
	$(PYTEST) -v -m "not slow"

test-slow:  ## Run only slow tests
	$(PYTEST) -v -m "slow"

test-cov:  ## Run tests with detailed coverage report
	$(PYTEST) --cov=. --cov-report=html --cov-report=term-missing
	@echo "Coverage report generated in htmlcov/index.html"

test-cov-open:  ## Run tests with coverage and open HTML report
	$(PYTEST) --cov=. --cov-report=html
	@echo "Opening coverage report..."
	@open htmlcov/index.html 2>/dev/null || xdg-open htmlcov/index.html 2>/dev/null || echo "Please open htmlcov/index.html manually"

test-verbose:  ## Run tests with extra verbose output
	$(PYTEST) -vv

test-failed:  ## Re-run only failed tests from last run
	$(PYTEST) --lf -v

test-watch:  ## Run tests in watch mode (requires pytest-watch)
	ptw -- -v

test-parallel:  ## Run tests in parallel (requires pytest-xdist)
	$(PYTEST) -n auto -v

test-debug:  ## Run tests with debugger on failure
	$(PYTEST) --pdb -v

test-specific:  ## Run a specific test (usage: make test-specific TEST=test_routes.py::test_name)
	$(PYTEST) tests/$(TEST) -v

lint:  ## Run code linting
	pylint app.py routes/ utils/ models.py || true
	flake8 . --exclude=venv,env,migrations --max-line-length=100 || true

format:  ## Format code with black
	black . --exclude venv

type-check:  ## Run type checking with mypy
	mypy . --exclude venv --ignore-missing-imports || true

clean:  ## Clean up generated files
	find . -type f -name '*.pyc' -delete
	find . -type d -name '__pycache__' -delete
	find . -type d -name '*.egg-info' -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf .coverage
	rm -rf build
	rm -rf dist

clean-db:  ## Remove test database files
	find . -type f -name 'test*.db' -delete
	find . -type f -name '*.db-journal' -delete

test-all: clean test lint  ## Run all tests and linting

ci:  ## Run CI pipeline (install, test, lint)
	$(MAKE) install
	$(MAKE) test
	$(MAKE) lint

coverage-report:  ## Generate and display coverage report
	coverage report -m
	coverage html
	@echo "Detailed coverage report: htmlcov/index.html"

# Development helpers
run:  ## Run the Flask application
	$(PYTHON) app.py

shell:  ## Open Python shell with app context
	$(PYTHON) -i -c "from app import app; app.app_context().push()"

db-init:  ## Initialize the database
	$(PYTHON) -c "from utils.database import init_db; init_db()"

db-reset:  ## Reset the database (WARNING: deletes all data)
	@echo "WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		rm -f expense_tracker.db; \
		$(PYTHON) -c "from utils.database import init_db; init_db()"; \
		echo "Database reset complete"; \
	fi

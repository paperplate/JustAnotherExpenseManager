# AGENTS.md - Agentic Coding Guidelines for Expense Manager

This file provides guidelines for agentic coding agents operating in this repository.

## Project Overview

- **Backend**: Flask application (Python 3.11+, in `JustAnotherExpenseManager/`)
- **Frontend**: Vanilla TypeScript (in `static_src/`)
- **Database**: SQLite via SQLAlchemy
- **E2E Tests**: Playwright (in `tests/`)
- **Unit Tests**: Pytest (in `tests/`)

---

## Build/Lint/Test Commands

### Python Backend

```bash
# Run unit tests
pytest tests/test_*.py -v

# Run a single test
pytest tests/test_routes.py::TestTransactionAPI::test_create_transaction_success -v

# Run with coverage
pytest --cov=JustAnotherExpenseManager --cov-report=html

# Linting (flake8)
flake8 JustAnotherExpenseManager/ tests/

# Linting (pylint)
pylint JustAnotherExpenseManager/ tests/

# Type checking (mypy)
mypy JustAnotherExpenseManager/

# Format check (black + isort)
black --check .
isort --check .

# All lint checks
python -m flake8 . && pylint JustAnotherExpenseManager tests && mypy JustAnotherExpenseManager
```

### TypeScript Frontend

```bash
# Build static assets
npm run build:static

# Type check
npm run build:static  # includes tsc --noEmit

# Run Playwright tests
npm test
npm run test:headed     # visible browser
npm run test:debug   # Playwright debugger
npm run test:ui      # Playwright UI mode

# Single Playwright test
npx playwright test tests/playwright/specific-file.spec.ts

# Single test in specific browser
npm run test:chrome
```

### Development Server

```bash
# Backend (Flask)
FLASK_APP=JustAnotherExpenseManager flask run

# With test database
JAEM_CONFIG=testing FLASK_APP=JustAnotherExpenseManager flask run

# Frontend dev server (vite watch)
npm run watch:static
```

---

## Code Style Guidelines

### Python (Backend)

**Formatting**
- Line length: 100 characters (Black handles this)
- Indentation: 4 spaces
- Use Black for formatting: `black .`
- Use isort for import sorting: `isort .`

**Import Order** (via isort, profile=black)
1. Standard library imports
2. Third-party packages
3. Local application imports

```python
# Good
import os
import tempfile
from datetime import datetime

import pytest
from flask import Blueprint, jsonify

from JustAnotherExpenseManager.models import Transaction
from JustAnotherExpenseManager.utils.services import TransactionService
```

**Naming Conventions**
- Functions/variables: `snake_case` (e.g., `get_transactions`, `total_amount`)
- Classes: `PascalCase` (e.g., `TransactionService`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_PAGE_SIZE`)
- Private: leading underscore (e.g., `_internal_helper`)

**Type Hints**
- Use explicit types for function signatures
- Use `Optional[T]` for nullable types
- Avoid `Any` unless necessary

```python
# Good
def get_transaction(trans_id: int) -> Transaction | None:
    """Get transaction by ID."""
    return db.session.get(Transaction, trans_id)

# Avoid
def get_transaction(trans_id):
    return db.session.get(Transaction, trans_id)
```

**Error Handling**
- Raise specific exceptions with meaningful messages
- Return appropriate HTTP status codes (400 for bad input, 404 for not found)
- Use `jsonify({'error': 'message'})` for API errors

```python
# Good
if not description:
    return jsonify({'error': 'Description is required'}), 400

raise ValueError(f"Invalid transaction type: {type_str}")
```

### TypeScript (Frontend)

**Formatting**
- Line length: 100 characters
- Use Vite for builds
- Follow existing patterns in `static_src/js/`

**Import Conventions**
- Use explicit `.ts` extensions for relative imports
- Group imports: external first, then local

```typescript
import { Chart, registerables } from 'chart.js';
import { Transaction, ApiResult } from './types';
```

**Types**
- Define all API interfaces in `types.ts`
- Use explicit return types

```typescript
function getTransactions(): Promise<ApiResult> {
  // ...
}
```

**Naming**
- Functions/variables: `camelCase`
- Interfaces/Types: `PascalCase`
- Files: `kebab-case.ts`

---

## Testing Guidelines

### Unit Tests (Pytest)

- Test files in `tests/test_*.py`
- Use fixtures from `conftest.py`
- Follow naming: `test_<feature>_<expected_behavior>`
- Use descriptive assert messages

```python
def test_create_transaction_success(client):
    """Creating a transaction returns 200 and adds to database."""
    data = {
        'description': 'Test',
        'amount': '100.00',
        'type': 'expense',
        'date': '2026-02-01',
    }
    response = client.post('/api/transactions', data=data)
    assert response.status_code == 200
```

### E2E Tests (Playwright)

- Test files in `tests/` with Playwright
- Uses `baseURL: http://localhost:5005` (configurable via `BASE_URL`)
- Web server started automatically via `playwright.config.ts`

### Database Handling in Tests

- Use the `db` fixture for database access
- Database resets automatically between tests (via `reset_database` fixture)
- For manual DB operations, use the service layer (`TransactionService`)

---

## Common Patterns

### Adding a New Route

1. Create route in appropriate blueprint (e.g., `routes/transactions.py`)
2. Use `TransactionService` for database operations
3. Return rendered templates or JSON responses
4. Add error handling with proper status codes

### Adding a New Service

1. Create service class in `utils/services.py`
2. Inject `db` session in constructor
3. Use SQLAlchemy queries via the session
4. Return domain objects or dicts

### Adding a New Model

1. Define in `models/`
2. Inherit from `db.Model`
3. Define columns with proper types
4. Add relationships as needed

---

## Lint/Typecheck Before Commit

Before creating a commit, run:

```bash
# Python
flake8 . && pylint JustAnotherExpenseManager tests && mypy JustAnotherExpenseManager

# TypeScript
npm run build:static
```

Fix any errors or warnings before committing.

---

## Notes

- This is a Flask + Vanilla JS application (no React/Vue)
- Uses Jinja2 templates for partial updates
- Playwright tests require Flask server running (handled automatically)
- SQLite database for persistence
- Static assets built with Vite to `build/` directory

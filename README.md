# 💰 Expense Manager

A modern, dockerized expense tracking application built with Flask, SQLAlchemy, and Chart.js.

## Features

- ✨ **Real-time Updates**: Add, edit, and delete transactions without page refreshes
- 📊 **Visual Analytics**: Interactive charts with income/expense tracking and category/tag filtering
- 💰 **Income & Expense Tracking**: Track both income and expenses with net balance calculation
- 🏷️ **Flexible Tagging System**: Add custom tags to transactions for fine-grained organization
- 📂 **Category Management**: Create, rename, merge, and delete categories from the Settings page
- 🔖 **Tag Management**: Rename, merge, and delete tags across all transactions from the Settings page
- 🔍 **Multi-select Filtering**: Filter by multiple categories and/or tags simultaneously
- 📅 **Time-range Filtering**: Filter by current month, custom date range, or all time
- 📄 **Month-based Pagination**: Transactions are grouped and paginated by month
- 🐳 **Dockerized**: Easy deployment with Docker and Docker Compose
- 💾 **Multiple Database Backends**: SQLite, PostgreSQL, or MySQL
- 📤 **CSV Import**: Bulk import transactions from a CSV file
- 🧪 **Test Data Generator**: Populate with sample data (debug mode only)
- 🏗️ **SOLID Architecture**: Clean separation of concerns across models, services, and routes
- 📱 **Mobile Responsive**: Works on all device sizes

## Tech Stack

- **Backend**: Flask (Python 3.11+) with SQLAlchemy ORM
- **Frontend**: Vanilla JS with fetch-based dynamic updates
- **Charts**: Chart.js
- **Database**: SQLite (default), PostgreSQL, or MySQL
- **Build**: flit / pyproject.toml
- **Containerization**: Docker & Docker Compose

## Quick Start

### Using Docker (Recommended)

The application supports three database backends. SQLite requires no extra services and is the default.

**SQLite (default):**
```bash
docker-compose up --build
```

**PostgreSQL:**
```bash
docker-compose -f docker-compose.postgres.yml up --build
```

**MySQL:**
```bash
docker-compose -f docker-compose.mysql.yml up --build
```

Then open http://localhost:5000 in your browser.

### Local Development (Without Docker)

```bash
# Install the package in editable mode (includes all dependencies)
pip install -e .

# Initialise the database
flask --app JustAnotherExpenseManager init-db

# Run the development server
flask --app JustAnotherExpenseManager run
```

Or use the installed entry point directly:
```bash
JustAnotherExpenseManager
```

Then open http://localhost:5000.

## Configuration

All configuration is done through environment variables. Copy `.env.example` to `.flaskenv` for local development and edit as needed.

### Network Binding

```bash
# Bind to localhost only (default for local dev — more secure)
FLASK_RUN_HOST=127.0.0.1

# Bind to all interfaces (required for Docker)
FLASK_RUN_HOST=0.0.0.0

FLASK_RUN_PORT=5000
```

The Docker images set `FLASK_RUN_HOST=0.0.0.0` automatically via `ENV` in the Dockerfile. You can override it in your `docker-compose.yml` if needed.

### Database

```bash
# SQLite (default)
DATABASE_TYPE=sqlite
SQLITE_PATH=./data/expenses.db

# PostgreSQL
DATABASE_TYPE=postgresql
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=expenses
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# MySQL
DATABASE_TYPE=mysql
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=expenses
DATABASE_USER=expenses_user
DATABASE_PASSWORD=expenses_pass
```

See `DATABASE_GUIDE.md` for full configuration details and migration guides.

## Usage

### Navigation

The application has three pages:

- **Summary**: Financial overview, charts, and multi-select category/tag/time filtering
- **Transactions**: Add, edit, delete, and filter individual transactions; CSV import
- **Settings**: Manage categories and tags; test data generator (debug mode only)

### Adding Transactions

1. Navigate to the **Transactions** page
2. Fill in the form:
   - **Description**: What the transaction was for
   - **Amount**: Positive number
   - **Type**: Income or Expense
   - **Date**: When it occurred
   - **Category**: Choose from existing or add new ones in Settings
   - **Tags**: Optional comma-separated tags (e.g. `recurring, business`)
3. Click **Add Transaction** — it appears immediately in the list

### Filtering

Both the Summary and Transactions pages support combined filtering:

- **Category filter**: Multi-select — choose one or more categories (or All)
- **Tag filter**: Multi-select — choose one or more tags (or All Tags)
- **Time range**: Current month, custom date range, or all time

Filters are reflected in the URL as query parameters (`categories=`, `tags=`, `range=`/`start_date=`/`end_date=`), so filtered views can be bookmarked or shared.

### Editing Transactions

Click the **Edit** button on any transaction row to open an inline edit form. Changes are saved immediately without a page reload.

### Category Management

Go to **Settings → Category Management** to:

- Add new categories
- Rename a category (updates all transactions that use it)
- Merge one category into another (all transactions from the source are re-assigned to the target)
- Delete a category (removes it from all transactions)

### Tag Management

Go to **Settings → Tag Management** to:

- Rename a tag across all transactions
- Merge one tag into another
- Delete a tag from all transactions

### CSV Import

1. Prepare a CSV file with these columns:

| Column | Description |
|---|---|
| `description` | What the transaction was for |
| `amount` | Positive dollar amount |
| `type` | `income` or `expense` |
| `category` | Category name (no `category:` prefix) |
| `date` | `YYYY-MM-DD` format |
| `tags` | Optional, comma-separated |

2. Go to the **Transactions** page and use the **Import from CSV** section
3. Invalid rows are reported individually; valid rows are still imported

**Example:**
```csv
description,amount,type,category,date,tags
Monthly Salary,5000.00,income,salary,2024-01-15,recurring
Grocery Store,125.50,expense,food,2024-01-16,
Freelance Project,1500.00,income,freelance,2024-01-20,one-time
```

## Project Structure

```
JustAnotherExpenseManager/         # Main Python package
├── __init__.py                    # App factory (create_app) and CLI commands
├── models/
│   └── __init__.py                # SQLAlchemy models: Transaction, Tag
├── routes/
│   ├── transactions.py            # Transaction CRUD and CSV import endpoints
│   ├── stats.py                   # Summary page and /api/stats, /api/chart-data
│   ├── categories.py              # Category and tag management endpoints
│   └── settings.py                # Settings page and test data endpoints
├── utils/
│   ├── database.py                # DatabaseManager — connections and init
│   └── services.py                # Business logic: TransactionService, StatsService, etc.
├── templates/
│   ├── base.html                  # Base layout with navigation
│   ├── summary.html               # Summary page
│   ├── transactions.html          # Transactions page
│   ├── settings.html              # Settings page
│   ├── stats.html                 # Stats partial (rendered by /api/stats)
│   └── transactions_list.html     # Transactions list partial with pagination
└── static/
    ├── css/styles.css
    └── js/
        ├── filter_component.js    # Multi-select category/tag filter UI
        ├── stats.js               # Chart initialisation and stats refresh
        ├── transactions.js        # Transaction form, edit modal, delete
        └── settings.js            # Category/tag management UI

pyproject.toml                     # Package metadata and dependencies (flit)
.flaskenv                          # Local dev environment variables
.env.example                       # Environment variable reference
Dockerfile                         # Container image definition
docker-compose.yml                 # SQLite deployment
docker-compose.postgres.yml        # PostgreSQL deployment
docker-compose.mysql.yml           # MySQL deployment
DATABASE_GUIDE.md                  # Detailed database configuration guide
```

### Architecture

**Models** (`models/`) — SQLAlchemy table definitions and ORM relationships.

**Services** (`utils/services.py`) — All business logic: transaction CRUD, statistics calculations, category/tag operations, test data generation. Routes call services; services never touch HTTP.

**Routes** (`routes/`) — Flask blueprints that handle HTTP requests, validate input, call services, and return responses. No business logic lives here.

**Database** (`utils/database.py`) — `DatabaseManager` wraps engine creation, session factory, and `init_database` / `reset_database` lifecycle methods.

## Testing

### Unit and Integration Tests (pytest)

```bash
# Install with test dependencies
pip install -e ".[test]"

# Run all tests
pytest

# With coverage report
pytest --cov=JustAnotherExpenseManager --cov-report=term-missing
```

### End-to-End Tests (Playwright)

```bash
# Install Node dependencies and browsers
npm ci
npx playwright install --with-deps chromium

# Run all E2E tests (starts the dev server automatically)
npx playwright test

# Run a specific browser only
npx playwright test --project=chromium

# Open the interactive UI runner
npx playwright test --ui

# View the last HTML report
npx playwright show-report
```

E2E tests require the application to be runnable via `JustAnotherExpenseManager` (the installed entry point). Playwright's `webServer` config in `playwright.config.js` handles starting and stopping it automatically.

### Database CLI Commands

```bash
# Initialise tables (run once after install)
flask --app JustAnotherExpenseManager init-db

# Drop and recreate all tables
flask --app JustAnotherExpenseManager init-db --drop

# Load sample data after init
flask --app JustAnotherExpenseManager init-db --sample-data

# Check database connectivity
flask --app JustAnotherExpenseManager db-health

# Show database info
flask --app JustAnotherExpenseManager db-info
```

## License

MIT — see `LICENSE` for details.

# 💰 Project Summary: Expense Manager

## Overview
This repository contains `JustAnotherExpenseManager`, a modern, robust, and fully dockerized application designed for personal expense tracking. It provides users with comprehensive tools for managing income, tracking expenses, and visualizing financial data through interactive charts.

## Key Features
*   **Expense & Income Tracking**: Core functionality for logging and managing financial transactions.
*   **Data Visualization**: Interactive dashboards powered by Chart.js for tracking category and income/expense trends.
*   **Flexible Organization**: Supports custom categorization and flexible, multi-select tagging for highly granular data filtering.
*   **Data Flow**: Features robust import/export via CSV, allowing for bulk data migration.
*   **User Experience**: Built with a mobile-responsive interface, offering real-time updates and inline editing.
*   **Deployment**: Fully containerized using Docker and Docker Compose, supporting three database backends (SQLite, PostgreSQL, MySQL).

## Technical Stack
*   **Backend**: Python 3.11+ using **Flask** and **SQLAlchemy** ORM.
*   **Frontend**: Vanilla JavaScript (with templating) and **Chart.js** for charting.
*   **Database**: Configurable (SQLite default, or PostgreSQL/MySQL via Docker).
*   **Packaging/Build**: Managed via `pyproject.toml` (flit).
*   **Testing**:
    *   Unit/Integration Tests: `pytest`
    *   End-to-End Tests: `Playwright`

## Architecture & Structure
The project adheres to a clean separation of concerns:
1.  **Models**: (in `JustAnotherExpenseManager/models/`) SQLAlchemy definitions for database structure.
2.  **Services**: (in `JustAnotherExpenseManager/utils/services.py`) Contains all business logic (e.g., transaction calculation, stats generating). Services are independent of HTTP requests.
3.  **Routes**: (in `JustAnotherExpenseManager/routes/`) Flask Blueprints that handle HTTP communication, input validation, and call the services.
4.  **Database**: Handled by `JustAnotherExpenseManager/utils/database.py`.

## Development & Deployment
### 🚀 Quick Start (Docker - Recommended)
The easiest way to run the application is via Docker Compose.
*   **SQLite (Default)**: `docker-compose up --build`
*   **PostgreSQL**: `docker-compose -f docker-compose.postgres.yml up --build`
*   **MySQL**: `docker-compose -f docker-compose.mysql.yml up --build`

### 💻 Local Development
```bash
pip install -e .
flask --app JustAnotherExpenseManager init-db
flask --app JustAnotherExpenseManager run
```

### 🧪 Testing Workflow
1.  **API/Logic Testing**: `pytest`
2.  **End-to-End UI Testing**:
    ```bash
    npm ci
    npx playwright install --with-deps chromium
    npx playwright test
    ```

## Configuration
All runtime configurations, such as database credentials and binding addresses, are managed via environment variables, utilizing the `.env.example` file. Database switches are configured using `DATABASE_TYPE`.
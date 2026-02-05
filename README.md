# 💰 Expense Manager

A modern, dockerized expense tracking application built with Flask, HTMX, and Chart.js.

## Features

- ✨ **Real-time Updates**: Add and delete transactions without page refreshes using HTMX
- 📊 **Visual Analytics**: Interactive charts with income/expense tracking and category filtering
- 💰 **Income & Expense Tracking**: Track both income and expenses with net balance calculation
- 🏷️ **Flexible Tagging System**: Add custom categories and tags to transactions
- 📄 **Pagination**: Navigate through large transaction lists and monthly data efficiently
- ⚙️ **Settings Page**: Manage application settings and development tools
- 🎨 **Modern UI**: Clean, responsive design with Summary, Transactions, and Settings pages
- 🐳 **Dockerized**: Easy deployment with Docker and Docker Compose
- 💾 **Multiple Database Backends**: Choose between SQLite, PostgreSQL, or MySQL
- 📤 **CSV Import/Export**: Bulk import transactions from CSV files
- 🧪 **Test Data Generator**: Populate with sample data (debug mode only)
- 🏗️ **SOLID Architecture**: Clean code with separation of concerns
- 📱 **Mobile Responsive**: Works seamlessly on all device sizes

## Tech Stack

- **Backend**: Flask (Python) with SQLAlchemy ORM
- **Frontend**: HTMX for dynamic interactions
- **Charts**: Chart.js for data visualization
- **Database**: SQLite (default), PostgreSQL, or MySQL
- **Containerization**: Docker & Docker Compose

## Quick Start

The application supports three database backends:
- **SQLite** (default) - No additional setup required
- **PostgreSQL** - Production-ready relational database
- **MySQL** - Popular open-source database

### Using SQLite (Default - Recommended for Development)

1. Make sure you have Docker and Docker Compose installed

2. Navigate to the project directory:
```bash
cd expense-manager
```

3. Build and run the container:
```bash
docker-compose up --build
```

4. Open your browser and visit:
```
http://localhost:5000
```

### Using PostgreSQL

1. Navigate to the project directory:
```bash
cd expense-manager
```

2. Build and run with PostgreSQL:
```bash
docker-compose -f docker-compose.postgres.yml up --build
```

3. The app will be available at `http://localhost:5000`
4. PostgreSQL will be available at `localhost:5432`

### Using MySQL

1. Navigate to the project directory:
```bash
cd expense-manager
```

2. Build and run with MySQL:
```bash
docker-compose -f docker-compose.mysql.yml up --build
```

3. The app will be available at `http://localhost:5000`
4. MySQL will be available at `localhost:3306`

### Using Docker

```bash
# Build the image
docker build -t expense-manager .

# Run the container
docker run -p 5000:5000 -v $(pwd)/expenses.db:/app/expenses.db expense-manager
```

### Local Development (Without Docker)

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

Then visit http://localhost:5000

## Usage

### Navigation

The application has two main pages:
- **Summary**: View financial overview, charts, and filter by category
- **Transactions**: Add, view, and manage individual transactions

### Adding Transactions

1. Navigate to the **Transactions** page
2. Fill in the transaction details:
   - **Description**: What the transaction was for
   - **Amount**: How much (always positive)
   - **Type**: Income or Expense
   - **Date**: When it occurred
   - **Category**: Choose from predefined or custom categories
   - **Tags**: Optional comma-separated tags (e.g., "recurring, urgent")

3. Click "Add Transaction" - it will appear immediately in the list below

### Custom Categories

Categories are a special type of tag with the `category:` prefix. You can:
1. Use default categories (food, transport, entertainment, etc.)
2. Add custom categories using the "Add Custom Category" section
3. Categories appear in the dropdown and can be filtered in the Summary page

### Tags

Tags provide flexible organization beyond categories:
- Add any tags you want (comma-separated)
- Examples: `recurring`, `business`, `urgent`, `subscription`
- Tags appear as badges on each transaction

### Viewing Statistics

Navigate to the **Summary** page to see:
- **Total Income**: Sum of all income transactions
- **Total Expenses**: Sum of all expense transactions  
- **Net Balance**: Income minus expenses
- **Category Breakdown**: Table showing income/expenses by category
- **Category Filter**: Dropdown to filter charts by specific category
- **Charts**: Doughnut chart for category distribution, line chart for monthly trends

### Test Data

Navigate to the **Settings** page to access development tools:
1. Click on "Settings" in the navigation bar
2. The "Test Data Generator" section is only visible when running in debug mode
3. Click "Generate Test Data" to add ~80 sample transactions
4. This is useful for new users to explore features with realistic data

**Note**: Test data generation is only available when `FLASK_ENV=development` or `debug=True`.

### Pagination

The application uses pagination for better performance:
- **Transactions List**: Shows 50 transactions per page with Previous/Next navigation
- **Monthly Charts**: Displays data in manageable chunks
- Navigate through pages using the pagination controls

### Settings Page

Access application settings and information:
- **Development Tools**: Test data generation (debug mode only)
- **Database Information**: View current database backend
- **Application Settings**: Pagination and category information
- **About**: Application information and features

### Importing from CSV

You can bulk import transactions from a CSV file:

1. Prepare a CSV file with columns:
   - `description` - What the transaction was for
   - `amount` - Amount in dollars (positive number)
   - `type` - "income" or "expense"
   - `category` - Category name (without category: prefix)
   - `date` - Date in YYYY-MM-DD format
   - `tags` - Optional comma-separated tags

2. Navigate to Transactions page
3. Click "Choose File" in the Import from CSV section
4. Select your CSV file
5. Click "Import CSV"

The system will validate each row and report any errors while still importing valid transactions.

**Example CSV format:**
```csv
description,amount,type,category,date,tags
Monthly Salary,5000.00,income,salary,2024-01-15,recurring
Grocery Store,125.50,expense,food,2024-01-16,
Freelance Project,1500.00,income,freelance,2024-01-20,one-time,business
```

## Project Structure

The application follows SOLID principles with clear separation of concerns:

```
expense-manager/
├── app.py                          # Main Flask application entry point
├── models/
│   └── __init__.py                 # Database models (Transaction, Tag)
├── routes/
│   ├── __init__.py
│   ├── transactions.py             # Transaction endpoints
│   ├── stats.py                    # Statistics and summary endpoints
│   ├── categories.py               # Category management endpoints
│   └── settings.py                 # Settings page and test data
├── utils/
│   ├── __init__.py
│   ├── database.py                 # Database configuration and initialization
│   └── services.py                 # Business logic layer
├── templates/
│   ├── base.html                   # Base template with navigation
│   ├── summary.html                # Summary page with charts
│   ├── transactions.html           # Transactions page
│   ├── settings.html               # Settings page
│   ├── stats.html                  # Statistics partial
│   └── transactions_list.html      # Transactions list partial with pagination
├── generate_test_data.py           # Transaction data generator
├── sample_transactions.csv         # Sample data file
├── requirements.txt                # Python dependencies
├── Dockerfile                      # Docker configuration
├── docker-compose.yml              # Default (SQLite) configuration
├── docker-compose.postgres.yml     # PostgreSQL configuration
├── docker-compose.mysql.yml        # MySQL configuration
├── docker-compose.sqlite.yml       # SQLite configuration (explicit)
├── .env.example                    # Environment variables template
├── .dockerignore                   # Docker ignore file
└── DATABASE_GUIDE.md               # Database configuration guide
```

### Architecture

**Models Layer** (`models/`)
- Database table definitions
- ORM relationships
- Data validation

**Service Layer** (`utils/services.py`)
- Business logic
- Transaction operations
- Statistics calculations
- Test data generation

**Routes Layer** (`routes/`)
- HTTP request handling
- Input validation
- Response formatting
- Blueprint organization

**Database Layer** (`utils/database.py`)
- Connection management
- Session handling
- Database initialization

## Testing

### Running Unit Tests

The tests use SQLite by default for simplicity and speed.

```bash
# Install dependencies first (in container or locally)
pip install -r requirements.txt

# Run all tests
python test_app.py

# Or with more verbose output
python -m unittest test_app -v
```

**In Docker:**
```bash
# Run tests inside running container
docker exec <container-name> python test_app.py
```

The test suite includes:
- Endpoint tests (index, add, delete, stats)
- CSV import validation tests
- Database operations tests
- Error handling tests
- All tests use SQLite for speed and isolation

### Generating Test Data

Generate sample expenses for development and testing:

```bash
# Generate 50 expenses over the last 60 days
python generate_test_data.py 50 60

# Generate 100 expenses over the last 90 days (default)
python generate_test_data.py

# This creates sample_expenses.csv which you can import via the UI
```

## Categories

The application supports the following expense categories:
- 🍔 Food
- 🚗 Transport
- 🎮 Entertainment
- 💡 Utilities
- 🛍️ Shopping
- 🏥 Healthcare
- 📦 Other

## Data Persistence

The application automatically creates a new database on first run if one doesn't exist. All expense data is stored in the configured database.

### Database Backends

**SQLite (Default)**
- File-based database stored in Docker volume
- No additional setup required
- Perfect for development and single-user deployments

**PostgreSQL**
- Production-ready relational database
- Runs in separate container
- Data persists in `postgres-data` volume
- Access: `localhost:5432`

**MySQL**
- Popular open-source database
- Runs in separate container  
- Data persists in `mysql-data` volume
- Access: `localhost:3306`

On startup, you'll see messages indicating the database status:
- "📝 Creating new database at: [url]" (first run)
- "✓ Using database: [type]" (subsequent runs)

### Environment Variables

You can customize database settings using environment variables. See [DATABASE_GUIDE.md](DATABASE_GUIDE.md) for detailed configuration options and migration guides.

```bash
DATABASE_TYPE=postgresql  # sqlite, postgresql, or mysql
DATABASE_HOST=postgres    # database host
DATABASE_PORT=5432        # database port
DATABASE_NAME=expenses    # database name
DATABASE_USER=postgres    # database user
DATABASE_PASSWORD=postgres # database password
```

For SQLite:
```bash
DATABASE_TYPE=sqlite
SQLITE_PATH=/app/data/expenses.db
```

For complete database setup instructions, troubleshooting, and migration guides, see **[DATABASE_GUIDE.md](DATABASE_GUIDE.md)**.

## Stopping the Application

Press Ctrl+C in the terminal, or run:
```bash
docker-compose down
```

## License

MIT License - feel free to use this project for personal or commercial purposes.

---

Built with Flask, HTMX, and Chart.js

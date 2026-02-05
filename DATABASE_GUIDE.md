# Database Configuration Guide

This guide explains how to set up and use different database backends with the Expense Manager.

## Overview

The Expense Manager supports three database backends:

1. **SQLite** (Default) - File-based, zero configuration
2. **PostgreSQL** - Production-ready relational database
3. **MySQL** - Popular open-source database

## Quick Reference

### SQLite (Default)
```bash
docker-compose up --build
```

### PostgreSQL
```bash
docker-compose -f docker-compose.postgres.yml up --build
```

### MySQL
```bash
docker-compose -f docker-compose.mysql.yml up --build
```

## Detailed Setup

### 1. SQLite Configuration

**Advantages:**
- No additional setup required
- Perfect for development
- Fast for small datasets
- Data stored in Docker volume

**Configuration:**
```bash
DATABASE_TYPE=sqlite
SQLITE_PATH=/app/data/expenses.db
```

**Docker Compose:**
```bash
docker-compose up --build
# or explicitly
docker-compose -f docker-compose.sqlite.yml up --build
```

**Data Location:** Docker volume `expense-data`

---

### 2. PostgreSQL Configuration

**Advantages:**
- Production-ready
- ACID compliant
- Advanced features
- Better concurrent access

**Configuration:**
```bash
DATABASE_TYPE=postgresql
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=expenses
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
```

**Docker Compose:**
```bash
docker-compose -f docker-compose.postgres.yml up --build
```

**Components:**
- PostgreSQL container (postgres:15-alpine)
- Application container
- Shared network for communication
- Data persists in `postgres-data` volume

**Access Database Directly:**
```bash
docker exec -it <postgres-container-id> psql -U postgres -d expenses
```

**Connection String:**
```
postgresql://postgres:postgres@localhost:5432/expenses
```

---

### 3. MySQL Configuration

**Advantages:**
- Popular and well-documented
- Good performance
- Wide ecosystem support

**Configuration:**
```bash
DATABASE_TYPE=mysql
DATABASE_HOST=mysql
DATABASE_PORT=3306
DATABASE_NAME=expenses
DATABASE_USER=expenses_user
DATABASE_PASSWORD=expenses_pass
```

**Docker Compose:**
```bash
docker-compose -f docker-compose.mysql.yml up --build
```

**Components:**
- MySQL container (mysql:8.0)
- Application container
- Shared network for communication
- Data persists in `mysql-data` volume

**Access Database Directly:**
```bash
docker exec -it <mysql-container-id> mysql -u expenses_user -pexpenses_pass expenses
```

**Connection String:**
```
mysql+pymysql://expenses_user:expenses_pass@localhost:3306/expenses
```

---

## Environment Variables

You can override database settings using a `.env` file:

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit `.env` with your settings

3. Docker Compose will automatically load these variables

## Switching Databases

### From SQLite to PostgreSQL

1. Export your data (optional):
```bash
# Connect to running SQLite container
docker exec -it <container> python3
>>> from app import get_db, Expense
>>> db = get_db()
>>> expenses = db.query(Expense).all()
>>> # Export to CSV or backup
```

2. Stop SQLite setup:
```bash
docker-compose down
```

3. Start PostgreSQL:
```bash
docker-compose -f docker-compose.postgres.yml up --build
```

4. Import data if needed

### Database Migration Script

For migrating between databases, you can use the included CSV export/import:

1. Export from current database to CSV
2. Switch database backend
3. Import CSV into new database

## Troubleshooting

### PostgreSQL Connection Issues

**Problem:** Application can't connect to PostgreSQL

**Solution:**
- Ensure PostgreSQL container is healthy: `docker ps`
- Check logs: `docker logs <postgres-container>`
- Verify credentials match in both containers

### MySQL Authentication Issues

**Problem:** Access denied errors

**Solution:**
- Check MySQL logs: `docker logs <mysql-container>`
- Verify user and password in environment variables
- Ensure database is created: `MYSQL_DATABASE=expenses`

### SQLite Locked Database

**Problem:** "database is locked" error

**Solution:**
- Only one process should write at a time
- Restart container: `docker-compose restart`
- Check for stuck processes

### Data Persistence

**Problem:** Data lost after container restart

**Solution:**
- Ensure volumes are configured correctly
- Check volume mounts: `docker volume ls`
- Don't use `docker-compose down -v` (removes volumes)

## Performance Considerations

### SQLite
- **Best for:** < 1000 expenses, single user, development
- **Limits:** No concurrent writes, file-based

### PostgreSQL
- **Best for:** Production, multiple users, > 10,000 expenses
- **Features:** Full ACID, concurrent access, advanced queries

### MySQL
- **Best for:** Production, familiar ecosystem, good performance
- **Features:** Widely supported, good documentation

## Security Notes

### Production Deployment

**Important:** Change default passwords in production!

1. Generate strong passwords
2. Update docker-compose file or use .env
3. Limit database network exposure
4. Regular backups

**Example Production Config:**
```yaml
environment:
  - DATABASE_PASSWORD=${DB_PASSWORD}  # From .env or secrets
```

### Database Backups

**PostgreSQL:**
```bash
docker exec <postgres-container> pg_dump -U postgres expenses > backup.sql
```

**MySQL:**
```bash
docker exec <mysql-container> mysqldump -u expenses_user -p expenses > backup.sql
```

**SQLite:**
```bash
docker cp <container>:/app/data/expenses.db ./backup.db
```

## Testing Different Databases

Run the test suite with different databases:

```bash
# SQLite (default)
docker exec <container> python test_app.py

# PostgreSQL
DATABASE_TYPE=postgresql python test_app.py

# MySQL
DATABASE_TYPE=mysql python test_app.py
```

## Additional Resources

- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [MySQL Docker Hub](https://hub.docker.com/_/mysql)
- [Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/)

FROM python:3.11-slim

WORKDIR /app

# Copy package metadata first
COPY pyproject.toml .
COPY README.md .

# Install pip
RUN pip install --upgrade pip

# Copy the entire package directory
COPY JustAnotherExpenseManager/ JustAnotherExpenseManager/

# Install the package in editable mode
RUN pip install -e .

EXPOSE 5000

CMD ["flask", "--app", "JustAnotherExpenseManager", "run", "--debug"]

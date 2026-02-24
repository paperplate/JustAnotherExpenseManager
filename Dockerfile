FROM python:3.11-slim

WORKDIR /app

# Copy package metadata first
COPY pyproject.toml .
COPY README.md .
COPY .flaskenv .

# Install pip
RUN pip install --upgrade pip

# Copy the entire package directory
COPY JustAnotherExpenseManager/ JustAnotherExpenseManager/

# Install the package in editable mode
RUN pip install -e .

EXPOSE 5000

# FLASK_RUN_HOST is read automatically by `flask run` from the environment.
# Set it to 0.0.0.0 here so the container listens on all interfaces,
# while the .flaskenv default of 127.0.0.1 keeps local dev restricted.
ENV FLASK_RUN_HOST=0.0.0.0

CMD ["flask", "--app", "JustAnotherExpenseManager", "init-db"]
CMD ["flask", "--app", "JustAnotherExpenseManager", "run", "--debug"]

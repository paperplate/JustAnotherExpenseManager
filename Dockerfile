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

# Select production configuration and bind to all interfaces so the
# container is reachable from the host.  Individual settings (SECRET_KEY,
# DATABASE_* etc.) should be passed via docker-compose environment: or -e flags.
ENV JAEM_CONFIG=production
ENV FLASK_RUN_HOST=0.0.0.0

CMD ["JustAnotherExpenseManager"]

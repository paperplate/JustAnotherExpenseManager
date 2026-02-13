FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -e .

COPY JustAnotherExpenseManager JustAnotherExpenseManager/

EXPOSE 5000

CMD ["python", "-m", "JustAnotherExpenseManager"]

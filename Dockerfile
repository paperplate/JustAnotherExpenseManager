FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --upgrade pip
RUN pip install -e .

COPY JustAnotherExpenseManager .

EXPOSE 5000

CMD ["python", "app.py"]

FROM python:3.11-slim AS base
WORKDIR /app
COPY pyproject.toml .
COPY README.md .
ENV FLASK_APP=JustAnotherExpenseManager
RUN pip install --upgrade pip
COPY JustAnotherExpenseManager/ JustAnotherExpenseManager/

FROM base AS debug
RUN pip install -e ".[test,dev]"
EXPOSE 5000
ENV JAEM_CONFIG=debug
ENV FLASK_RUN_HOST=0.0.0.0
CMD ["flask", "run", "--debug"]

FROM base AS prod
RUN pip install -e .
EXPOSE 5000
ENV JAEM_CONFIG=production
ENV FLASK_RUN_HOST=0.0.0.0
CMD ["flask", "run"]

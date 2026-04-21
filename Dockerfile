# ---- Build stage: install dependencies ----
FROM python:3.12-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- Runtime stage ----
FROM python:3.12-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY init_demo_users.py .
COPY entrypoint.sh .

RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

ENV DATABASE_URL="postgresql://tcoffline:tcoffline@db:5432/tcoffline"

EXPOSE 8000

HEALTHCHECK --interval=300s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

ENTRYPOINT ["./entrypoint.sh"]

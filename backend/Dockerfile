FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# No compiler or libpq headers: every dependency installs from a wheel
# (psycopg2-binary bundles libpq). If a new dependency ever needs to
# compile, the image build fails here and in CI's scan job; add a build
# stage for it then, not a compiler in the runtime image.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/
COPY data/ /data/

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]

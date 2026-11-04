#!/bin/sh
# Runs automatically the first time the Postgres container starts (empty volume).
# Creates the roles, sets their passwords from the environment and prepares the database.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /bootstrap/01-roles.sql

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_password="$AZ_OWNER_PASSWORD" -v app_password="$AZ_APP_PASSWORD" <<'SQL'
ALTER ROLE az_owner PASSWORD :'owner_password';
ALTER ROLE az_app PASSWORD :'app_password';
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /bootstrap/02-database.sql

-- Run once per Postgres server, as a superuser. Idempotent.
-- Passwords are NOT set here: the caller runs ALTER ROLE ... PASSWORD from secrets.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'az_owner') THEN
    -- Owns the schema and the tables; used only to run migrations.
    CREATE ROLE az_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'az_app') THEN
    -- Used by the API at runtime. Not an owner and cannot bypass Row Level Security.
    CREATE ROLE az_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

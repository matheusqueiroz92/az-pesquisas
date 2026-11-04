-- Run once per database, as a superuser, connected to that database. Idempotent.

-- PostGIS is not a trusted extension: only a superuser can create it.
CREATE EXTENSION IF NOT EXISTS postgis;

-- az_owner owns the schema, so migrations can create and alter tables.
ALTER SCHEMA public OWNER TO az_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO az_app;

-- The migration journal lives in its own schema. az_app gets no USAGE on it,
-- so the API can never read or tamper with which migrations were applied.
CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION az_owner;
REVOKE ALL ON SCHEMA drizzle FROM PUBLIC;

-- The drizzle migrator always runs CREATE SCHEMA IF NOT EXISTS, which Postgres
-- checks against the database-level CREATE privilege even when the schema exists.
DO $$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO az_owner', current_database());
END
$$;

-- Every table az_owner creates from now on is readable and writable by az_app,
-- but never alterable or droppable by it. RLS policies decide which rows.
ALTER DEFAULT PRIVILEGES FOR ROLE az_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO az_app;
ALTER DEFAULT PRIVILEGES FOR ROLE az_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO az_app;
ALTER DEFAULT PRIVILEGES FOR ROLE az_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO az_app;

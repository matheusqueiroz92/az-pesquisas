-- Identity tables: tenant isolation, value checks, append-only audit and the
-- three narrow cross-tenant lookups needed before the organization is known.

-- Values the domain guarantees, guaranteed again by the database.
ALTER TABLE "users" ADD CONSTRAINT "users_role_check"
  CHECK ("role" IN ('admin', 'coordinator', 'analyst', 'client', 'interviewer'));
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_check" CHECK ("status" IN ('active', 'disabled'));
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower(trim("email")));
--> statement-breakpoint

-- Tenant isolation (same policy as every business table, ADR-0005).
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "users"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sessions"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
ALTER TABLE "password_resets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "password_resets"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "audit_logs"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

-- Audit log is append-only for the API (spec 005 rule 18).
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_logs" FROM az_app;
--> statement-breakpoint

-- Cross-tenant lookups. SECURITY DEFINER runs as az_owner (table owner, so RLS
-- does not apply) and returns ONLY identifiers: the caller then enters the
-- organization and loads everything else with RLS on. search_path is pinned so
-- a malicious object in another schema cannot hijack the function.
CREATE FUNCTION auth_find_user_by_email(p_email text)
  RETURNS TABLE (user_id uuid, organization_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT u.id, u.organization_id FROM users u WHERE u.email = lower(trim(p_email)) $$;
--> statement-breakpoint
CREATE FUNCTION auth_find_session_by_token_hash(p_token_hash text)
  RETURNS TABLE (session_id uuid, organization_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT s.id, s.organization_id FROM sessions s WHERE s.token_hash = p_token_hash $$;
--> statement-breakpoint
CREATE FUNCTION auth_find_password_reset_by_token_hash(p_token_hash text)
  RETURNS TABLE (reset_id uuid, organization_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT r.id, r.organization_id FROM password_resets r WHERE r.token_hash = p_token_hash $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_find_user_by_email(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_find_session_by_token_hash(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_find_password_reset_by_token_hash(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_find_user_by_email(text) TO az_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_find_session_by_token_hash(text) TO az_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_find_password_reset_by_token_hash(text) TO az_app;

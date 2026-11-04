-- Tenant isolation, barrier 2 (ADR-0005): Row Level Security.
-- The API connects as az_app (not the owner), so every policy below applies to it.

-- The organization of the current transaction, set by the API with
-- set_config('app.organization_id', $1, true). Unset -> NULL -> no row matches.
CREATE FUNCTION app_current_organization_id() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.organization_id', true), '')::uuid $$;
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "organizations"
  USING ("id" = app_current_organization_id())
  WITH CHECK ("id" = app_current_organization_id());
--> statement-breakpoint
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "outbox_events"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

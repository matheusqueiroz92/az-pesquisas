-- Devices and survey teams (spec 016): tenant isolation, checks and the
-- cross-tenant lookups the app needs before it has a tenant.

ALTER TABLE "devices" ADD CONSTRAINT "devices_platform_check" CHECK ("platform" IN ('android', 'ios'));
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_nickname_check"
  CHECK (char_length("nickname") BETWEEN 2 AND 60 AND "nickname" = btrim("nickname"));
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_revoked_check"
  CHECK (("revoked_at" IS NULL) = ("revoked_by" IS NULL));
--> statement-breakpoint
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_consumed_check"
  CHECK (("consumed_at" IS NULL) = ("device_id" IS NULL) AND "expires_at" > "created_at");
--> statement-breakpoint

ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "devices"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
ALTER TABLE "device_pairings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "device_pairings"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
ALTER TABLE "survey_devices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "survey_devices"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
ALTER TABLE "survey_interviewers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "survey_interviewers"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint

-- Same pattern as the auth lookups (0003): SECURITY DEFINER, ids only, pinned search_path.
CREATE FUNCTION devices_find_pending_pairing(p_code_hash text)
  RETURNS TABLE (pairing_id uuid, organization_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT p.id, p.organization_id FROM device_pairings p
        WHERE p.code_hash = p_code_hash AND p.consumed_at IS NULL AND p.expires_at > now() $$;
--> statement-breakpoint
CREATE FUNCTION devices_find_by_token_hash(p_token_hash text)
  RETURNS TABLE (device_id uuid, organization_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT d.id, d.organization_id FROM devices d WHERE d.token_hash = p_token_hash $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION devices_find_pending_pairing(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION devices_find_by_token_hash(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION devices_find_pending_pairing(text) TO az_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION devices_find_by_token_hash(text) TO az_app;

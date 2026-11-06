-- Clients and surveys (spec 013): tenant isolation and the domain rules,
-- guaranteed again by the database.

ALTER TABLE "clients" ADD CONSTRAINT "clients_name_check"
  CHECK (char_length("name") BETWEEN 2 AND 120 AND "name" = btrim("name"));
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_document_check"
  CHECK ("document" IS NULL OR "document" ~ '^([0-9]{11}|[0-9]{14})$');
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_title_check"
  CHECK (char_length("title") BETWEEN 3 AND 160 AND "title" = btrim("title"));
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_type_check"
  CHECK ("type" IN ('satisfaction', 'market', 'public_opinion', 'municipal_evaluation', 'electoral'));
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_status_check"
  CHECK ("status" IN ('draft', 'in_field', 'closed', 'archived'));
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_gps_mode_check"
  CHECK ("gps_mode" IN ('off', 'optional', 'required'));
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_audio_check" CHECK ("audio" IN ('off', 'on'));
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_min_duration_check"
  CHECK ("min_duration_sec" BETWEEN 0 AND 7200);
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_target_check"
  CHECK ("target_interviews" IS NULL OR "target_interviews" BETWEEN 1 AND 1000000);
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_field_period_check"
  CHECK ("field_start" IS NULL OR "field_end" IS NULL OR "field_end" >= "field_start");
--> statement-breakpoint
-- IBGE codes of Bahia (state 29); the exact list is checked by the API.
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_municipalities_check"
  CHECK (2900000 <= ALL ("municipality_codes") AND 2999999 >= ALL ("municipality_codes")
         AND cardinality("municipality_codes") <= 417);
--> statement-breakpoint
-- TSE data only on an electoral survey registered at the TSE (spec 013 rule 6).
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_tse_check"
  CHECK (
    ("tse_registered" = false OR "type" = 'electoral')
    AND ("tse_registered" OR (
      "tse_registration_number" IS NULL AND "tse_statistician_name" IS NULL
      AND "tse_statistician_conre" IS NULL AND "tse_contractor_name" IS NULL
      AND "tse_contract_value_cents" IS NULL))
    AND ("tse_registration_number" IS NULL
         OR "tse_registration_number" ~ '^[A-Z]{2}-[0-9]{5}/[0-9]{4}$')
    AND ("tse_contract_value_cents" IS NULL OR "tse_contract_value_cents" >= 0)
  );
--> statement-breakpoint

-- Tenant isolation (same policy as every business table, ADR-0005).
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "clients"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());
--> statement-breakpoint
ALTER TABLE "surveys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "surveys"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

-- Published questionnaire versions (spec 015): tenant isolation, immutability
-- and the survey status cycle.

ALTER TABLE "questionnaire_versions" ADD CONSTRAINT "questionnaire_versions_number_check"
  CHECK ("number" >= 1);
--> statement-breakpoint
ALTER TABLE "questionnaire_versions" ADD CONSTRAINT "questionnaire_versions_snapshot_check"
  CHECK (jsonb_typeof("snapshot") = 'object' AND ("snapshot" ->> 'versionId') = "id"::text
         AND ("snapshot" ->> 'versionNumber')::int = "number"
         AND ("snapshot" ->> 'surveyId') = "survey_id"::text);
--> statement-breakpoint
ALTER TABLE "questionnaire_versions" ADD CONSTRAINT "questionnaire_versions_changes_check"
  CHECK (jsonb_typeof("changes") = 'array');
--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_published_version_check"
  CHECK ("published_version" >= 0 AND ("published_version" = 0 OR "status" <> 'draft')
         AND ("published_version" > 0 OR "status" IN ('draft', 'archived')));
--> statement-breakpoint

-- A published version never changes nor goes away (AGENTS.md rule 7).
REVOKE UPDATE, DELETE, TRUNCATE ON "questionnaire_versions" FROM az_app;
--> statement-breakpoint

ALTER TABLE "questionnaire_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "questionnaire_versions"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

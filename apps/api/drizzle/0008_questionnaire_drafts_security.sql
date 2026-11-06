-- Questionnaire drafts (spec 014): tenant isolation and basic guarantees.

ALTER TABLE "questionnaire_drafts" ADD CONSTRAINT "questionnaire_drafts_revision_check"
  CHECK ("revision" >= 1);
--> statement-breakpoint
ALTER TABLE "questionnaire_drafts" ADD CONSTRAINT "questionnaire_drafts_content_check"
  CHECK (jsonb_typeof("content") = 'object' AND jsonb_typeof("content" -> 'questions') = 'array');
--> statement-breakpoint
ALTER TABLE "questionnaire_drafts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "questionnaire_drafts"
  USING ("organization_id" = app_current_organization_id())
  WITH CHECK ("organization_id" = app_current_organization_id());

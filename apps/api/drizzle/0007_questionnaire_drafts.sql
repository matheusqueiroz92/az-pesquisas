CREATE TABLE "questionnaire_drafts" (
	"survey_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"revision" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "questionnaire_drafts" ADD CONSTRAINT "questionnaire_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- The unique key must exist before the composite FK that targets it.
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_organization_id_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "questionnaire_drafts" ADD CONSTRAINT "questionnaire_drafts_survey_fk" FOREIGN KEY ("organization_id","survey_id") REFERENCES "public"."surveys"("organization_id","id") ON DELETE cascade ON UPDATE no action;

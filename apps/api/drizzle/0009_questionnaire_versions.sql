CREATE TABLE "questionnaire_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changes" jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_by" uuid NOT NULL,
	CONSTRAINT "questionnaire_versions_survey_number_unique" UNIQUE("survey_id","number")
);
--> statement-breakpoint
ALTER TABLE "surveys" ADD COLUMN "published_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "questionnaire_versions" ADD CONSTRAINT "questionnaire_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questionnaire_versions" ADD CONSTRAINT "questionnaire_versions_survey_fk" FOREIGN KEY ("organization_id","survey_id") REFERENCES "public"."surveys"("organization_id","id") ON DELETE no action ON UPDATE no action;
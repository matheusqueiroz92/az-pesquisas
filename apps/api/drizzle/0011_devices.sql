CREATE TABLE "device_pairings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"device_id" uuid,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"platform" text NOT NULL,
	"model" text NOT NULL,
	"os_version" text NOT NULL,
	"app_version" text NOT NULL,
	"token_hash" text NOT NULL,
	"paired_at" timestamp with time zone NOT NULL,
	"paired_by" uuid NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid
);
--> statement-breakpoint
CREATE TABLE "survey_devices" (
	"organization_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	"assigned_by" uuid NOT NULL,
	CONSTRAINT "survey_devices_pk" PRIMARY KEY("survey_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "survey_interviewers" (
	"organization_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	"assigned_by" uuid NOT NULL,
	CONSTRAINT "survey_interviewers_pk" PRIMARY KEY("survey_id","user_id")
);
--> statement-breakpoint
-- Unique keys first: the composite FKs below point at them.
CREATE UNIQUE INDEX "device_pairings_pending_code_unique" ON "device_pairings" USING btree ("code_hash") WHERE "device_pairings"."consumed_at" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX "devices_token_hash_unique" ON "devices" USING btree ("token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "devices_organization_id_id_unique" ON "devices" USING btree ("organization_id","id");
--> statement-breakpoint
CREATE INDEX "devices_organization_id_idx" ON "devices" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "survey_devices_device_id_idx" ON "survey_devices" USING btree ("device_id");
--> statement-breakpoint
CREATE INDEX "survey_interviewers_user_id_idx" ON "survey_interviewers" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "users_organization_id_id_unique" ON "users" USING btree ("organization_id","id");
--> statement-breakpoint
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_device_fk" FOREIGN KEY ("organization_id","device_id") REFERENCES "public"."devices"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "survey_devices" ADD CONSTRAINT "survey_devices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "survey_devices" ADD CONSTRAINT "survey_devices_survey_fk" FOREIGN KEY ("organization_id","survey_id") REFERENCES "public"."surveys"("organization_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "survey_devices" ADD CONSTRAINT "survey_devices_device_fk" FOREIGN KEY ("organization_id","device_id") REFERENCES "public"."devices"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "survey_interviewers" ADD CONSTRAINT "survey_interviewers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "survey_interviewers" ADD CONSTRAINT "survey_interviewers_survey_fk" FOREIGN KEY ("organization_id","survey_id") REFERENCES "public"."surveys"("organization_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "survey_interviewers" ADD CONSTRAINT "survey_interviewers_user_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."users"("organization_id","id") ON DELETE no action ON UPDATE no action;

CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_organization_id_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"municipality_codes" integer[] NOT NULL,
	"field_start" date,
	"field_end" date,
	"target_interviews" integer,
	"gps_mode" text NOT NULL,
	"audio" text NOT NULL,
	"min_duration_sec" integer NOT NULL,
	"consent_text" text,
	"tse_registered" boolean DEFAULT false NOT NULL,
	"tse_registration_number" text,
	"tse_statistician_name" text,
	"tse_statistician_conre" text,
	"tse_contractor_name" text,
	"tse_contract_value_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_organization_id_idx" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "surveys_organization_id_idx" ON "surveys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "surveys_client_id_idx" ON "surveys" USING btree ("client_id");
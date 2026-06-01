CREATE TABLE "audit_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_name" varchar(255),
	"rule_id" varchar(50) NOT NULL,
	"parameter_key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_policies_file_type_idx" ON "audit_policies" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "audit_policies_file_name_idx" ON "audit_policies" USING btree ("file_name");
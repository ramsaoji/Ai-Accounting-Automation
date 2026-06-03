CREATE TABLE "audit_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" uuid NOT NULL,
	"rule_id" varchar(50) NOT NULL,
	"rule_name" varchar(100) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"run_timestamp" timestamp NOT NULL,
	"total_rows" integer NOT NULL,
	"ai_summary" text,
	"ai_intelligence" jsonb,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"is_latest" boolean DEFAULT true NOT NULL,
	"status" varchar(30) DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"content_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "godown_stock_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"sheet_name" varchar(100) NOT NULL,
	"item_code" varchar(100),
	"item_name" varchar(255) NOT NULL,
	"category" varchar(100),
	"bottle_size_ml" integer NOT NULL,
	"opening_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"stock_in" numeric(12, 3) DEFAULT '0' NOT NULL,
	"stock_out" numeric(12, 3) DEFAULT '0' NOT NULL,
	"closing_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_value" numeric(12, 2) NOT NULL,
	"cost_price" numeric(12, 2),
	"selling_price" numeric(12, 2),
	"total_cost_value" numeric(14, 2),
	"total_sell_value" numeric(14, 2),
	"location" varchar(100) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_retention_settings" (
	"file_type" varchar(50) PRIMARY KEY NOT NULL,
	"retention_days" integer DEFAULT 90 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parsing_errors" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"invoice_number" varchar(100),
	"error_message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" uuid NOT NULL,
	"party_name" varchar(255) NOT NULL,
	"party_type" varchar(30) NOT NULL,
	"debit" numeric(12, 2) NOT NULL,
	"credit" numeric(12, 2) NOT NULL,
	"pending" numeric(12, 2) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_config" (
	"key" varchar(50) PRIMARY KEY NOT NULL,
	"app_password_hash" varchar(255) NOT NULL,
	"upload_password_hash" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_metadata" (
	"file_name" varchar(255) PRIMARY KEY NOT NULL,
	"modified_time" varchar(100) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(50) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" uuid NOT NULL,
	"sheet_name" varchar(100) NOT NULL,
	"date" date NOT NULL,
	"invoice_number" varchar(100),
	"category" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" varchar(10) NOT NULL,
	"vendor" varchar(255) NOT NULL,
	"particulars" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_alerts" ADD CONSTRAINT "audit_alerts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "godown_stock_items" ADD CONSTRAINT "godown_stock_items_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsing_errors" ADD CONSTRAINT "parsing_errors_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_balances" ADD CONSTRAINT "party_balances_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_alerts_file_id_idx" ON "audit_alerts" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "audit_policies_file_type_idx" ON "audit_policies" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "audit_policies_file_name_idx" ON "audit_policies" USING btree ("file_name");--> statement-breakpoint
CREATE INDEX "files_type_latest_idx" ON "files" USING btree ("file_type","is_latest");--> statement-breakpoint
CREATE INDEX "files_run_timestamp_idx" ON "files" USING btree ("run_timestamp");--> statement-breakpoint
CREATE INDEX "godown_stock_items_file_id_idx" ON "godown_stock_items" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "godown_stock_items_snapshot_date_idx" ON "godown_stock_items" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "godown_stock_items_item_name_idx" ON "godown_stock_items" USING btree ("item_name");--> statement-breakpoint
CREATE INDEX "godown_stock_items_category_idx" ON "godown_stock_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "parsing_errors_file_id_idx" ON "parsing_errors" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "party_balances_file_id_idx" ON "party_balances" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "transactions_file_id_idx" ON "transactions" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category");
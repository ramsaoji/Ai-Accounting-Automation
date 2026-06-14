CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"industry_profile" varchar(50) DEFAULT 'general' NOT NULL,
	"base_currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"base_timezone" varchar(100) DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"account_code" varchar(50) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"parent_id" uuid,
	"color_hex" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan_tier" varchar(50) DEFAULT 'free' NOT NULL,
	"billing_status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parser_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"template_name" varchar(255) NOT NULL,
	"file_category" varchar(50) NOT NULL,
	"mapping_schema" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_alerts" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "counter_stock_items" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "godown_stock_items" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "parsing_errors" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "party_balances" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "coa_id" uuid;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_entity_id_business_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."business_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_entities" ADD CONSTRAINT "business_entities_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_entity_id_business_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."business_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parser_templates" ADD CONSTRAINT "parser_templates_entity_id_business_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."business_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_alerts" ADD CONSTRAINT "audit_alerts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_stock_items" ADD CONSTRAINT "counter_stock_items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_template_id_parser_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."parser_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "godown_stock_items" ADD CONSTRAINT "godown_stock_items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsing_errors" ADD CONSTRAINT "parsing_errors_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_balances" ADD CONSTRAINT "party_balances_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_coa_id_chart_of_accounts_id_fk" FOREIGN KEY ("coa_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "counter_stock_items" (
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
ALTER TABLE "counter_stock_items" ADD CONSTRAINT "counter_stock_items_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "counter_stock_items_file_id_idx" ON "counter_stock_items" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "counter_stock_items_snapshot_date_idx" ON "counter_stock_items" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "counter_stock_items_item_name_idx" ON "counter_stock_items" USING btree ("item_name");--> statement-breakpoint
CREATE INDEX "counter_stock_items_category_idx" ON "counter_stock_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "counter_stock_items_file_id_snapshot_date_idx" ON "counter_stock_items" USING btree ("file_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "counter_stock_items_file_id_item_name_idx" ON "counter_stock_items" USING btree ("file_id","item_name");
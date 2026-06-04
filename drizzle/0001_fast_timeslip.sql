CREATE INDEX "godown_stock_items_file_id_snapshot_date_idx" ON "godown_stock_items" USING btree ("file_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "godown_stock_items_file_id_item_name_idx" ON "godown_stock_items" USING btree ("file_id","item_name");--> statement-breakpoint
CREATE INDEX "party_balances_file_id_party_name_idx" ON "party_balances" USING btree ("file_id","party_name");--> statement-breakpoint
CREATE INDEX "transactions_file_id_category_idx" ON "transactions" USING btree ("file_id","category");--> statement-breakpoint
CREATE INDEX "transactions_file_id_date_idx" ON "transactions" USING btree ("file_id","date");
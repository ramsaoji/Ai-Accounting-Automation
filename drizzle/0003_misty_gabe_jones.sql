CREATE INDEX "audit_alerts_file_id_idx" ON "audit_alerts" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "parsing_errors_file_id_idx" ON "parsing_errors" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "party_balances_file_id_idx" ON "party_balances" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "stock_items_file_id_idx" ON "stock_items" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "transactions_file_id_idx" ON "transactions" USING btree ("file_id");
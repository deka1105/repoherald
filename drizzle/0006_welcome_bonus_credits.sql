CREATE UNIQUE INDEX "credit_entries_welcome_uq" ON "credit_entries" USING btree ("user_id") WHERE type = 'welcome_bonus';

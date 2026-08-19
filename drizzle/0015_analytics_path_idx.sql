-- List view counts filter analytics_events by path, which had no index (the
-- existing ones cover type/created_at and repo_id/type). Cheap now — the table
-- is small — and it keeps the lookup from turning into a scan as it grows.
CREATE INDEX IF NOT EXISTS "analytics_events_path_idx" ON "analytics_events" ("path");

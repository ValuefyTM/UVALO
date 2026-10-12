-- Who is online: every open page of the app sends a small signal each minute while it is visible (public/presence.js →
-- /api/ping), which updates the session's last_seen_at and the page it is on. Admin → Panou → "Online acum".
ALTER TABLE sessions ADD COLUMN last_page TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_seen ON sessions(last_seen_at);

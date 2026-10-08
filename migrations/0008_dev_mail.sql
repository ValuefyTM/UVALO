-- Emails of the local and test environments (APP_ENV local / staging): kept here and shown at /dev/mail instead of
-- reaching real people. Never written in production.
CREATE TABLE IF NOT EXISTS dev_mail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,   -- staging: also sent for real (address in MAIL_ALLOW)
  created_at TEXT NOT NULL
);

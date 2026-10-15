-- Account creation: the terms of use + privacy policy are accepted (required), the newsletter about new tools is optional (opt-in).
ALTER TABLE account_requests ADD COLUMN terms_at TEXT;
ALTER TABLE account_requests ADD COLUMN newsletter INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN newsletter INTEGER NOT NULL DEFAULT 0;   -- agreed to receive emails when new tools launch
ALTER TABLE users ADD COLUMN newsletter_at TEXT;                      -- when the choice was last made

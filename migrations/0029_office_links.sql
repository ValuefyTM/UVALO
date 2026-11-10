-- Birou de evaluare → asocieri: evaluators with their own UVALO account linked to an office without taking a seat.
-- kind: angajat (employee: inspections assigned by the office go to Acasă on the phone) | colaborator (external: they go to
-- the phone's Colaborări tab). The office invites (status invited) or the valuer asks (requested); the other side accepts
-- (active). Either can end it (ended); the history stays. Only valuers (ANEVAR card) can be linked.
CREATE TABLE IF NOT EXISTS office_links (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES orgs(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  kind            TEXT NOT NULL DEFAULT 'colaborator',   -- angajat | colaborator
  status          TEXT NOT NULL,                          -- invited | requested | active | declined | cancelled | ended
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_by      TEXT REFERENCES users(id),
  decided_at      TEXT,
  ended_by        TEXT REFERENCES users(id),
  ended_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_office_links_org ON office_links(org_id, status);
CREATE INDEX IF NOT EXISTS idx_office_links_user ON office_links(user_id, status);
-- at most one open (invited / requested / active) link per office and person
CREATE UNIQUE INDEX IF NOT EXISTS idx_office_links_open ON office_links(org_id, user_id) WHERE status IN ('invited', 'requested', 'active');

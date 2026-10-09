/** Points, daily rewards, parent payouts and private recitation recordings. Additive and idempotent. */
export const schemaV2 = `
CREATE TABLE IF NOT EXISTS points_ledger (
  id TEXT PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  item_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  award_key TEXT NOT NULL,
  day TEXT NOT NULL,
  points INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','retry','rejected')),
  verification TEXT NOT NULL CHECK (verification IN ('app','parent','adjustment')),
  recording_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE(child_id, award_key)
);
CREATE INDEX IF NOT EXISTS points_ledger_child_day ON points_ledger(child_id, day);
CREATE TABLE IF NOT EXISTS reward_payouts (
  id TEXT PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_at TEXT NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS daily_rewards (
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents = 100),
  status TEXT NOT NULL CHECK (status IN ('unpaid','paid')),
  earned_at TEXT NOT NULL,
  payout_id TEXT REFERENCES reward_payouts(id),
  PRIMARY KEY(child_id, day)
);
CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  item_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS imported_sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('hadith','dua')),
  category TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  added_at TEXT NOT NULL
);
INSERT OR IGNORE INTO migrations (version) VALUES (2);
`;

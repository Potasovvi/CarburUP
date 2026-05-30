-- CarburUP — Schema PostgreSQL
-- Esegui questo SQL sul tuo database PostgreSQL (Neon, Railway, etc.)

CREATE TABLE IF NOT EXISTS impianti (
  id TEXT PRIMARY KEY,
  gestore TEXT NOT NULL,
  bandiera TEXT,
  comune TEXT,
  provincia TEXT,
  indirizzo TEXT
);

CREATE TABLE IF NOT EXISTS prezzi (
  id TEXT PRIMARY KEY,
  id_impianto TEXT NOT NULL REFERENCES impianti(id),
  desc_carburante TEXT NOT NULL,
  prezzo NUMERIC NOT NULL,
  is_self BOOLEAN NOT NULL,
  dt_comu TEXT
);

CREATE INDEX IF NOT EXISTS idx_prezzi_id_impianto ON prezzi(id_impianto);
CREATE INDEX IF NOT EXISTS idx_prezzi_desc_carburante ON prezzi(desc_carburante);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  id_impianto TEXT,
  gestore TEXT,
  bandiera TEXT,
  comune TEXT,
  indirizzo TEXT,
  messaggio TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

// Database schema — applied idempotently on cold start.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Roles with their permission set (see permissions.mjs); users.role → roles.key
CREATE TABLE IF NOT EXISTS roles (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  system BOOLEAN NOT NULL DEFAULT false,
  sort INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'technik',
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  nip TEXT,
  address TEXT,
  city TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  building_type TEXT,
  panel_manufacturer TEXT,
  panel_model TEXT,
  system_type TEXT,
  loops INT,
  monitoring BOOLEAN NOT NULL DEFAULT false,
  monitoring_operator TEXT,
  contract_number TEXT,
  contract_end DATE,
  inspection_interval_months INT NOT NULL DEFAULT 6,
  last_inspection DATE,
  on_site_contact TEXT,
  on_site_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sites_client_idx ON sites(client_id);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial TEXT,
  loop_no INT,
  address_no INT,
  location TEXT,
  quantity INT NOT NULL DEFAULT 1,
  installed_at DATE,
  replace_by DATE,
  status TEXT NOT NULL DEFAULT 'sprawne',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devices_site_idx ON devices(site_id);

CREATE TABLE IF NOT EXISTS inspections (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'przegląd okresowy',
  scheduled_date DATE NOT NULL,
  performed_date DATE,
  technician_id INT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'zaplanowany',
  result TEXT,
  protocol_number TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings TEXT,
  recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inspections_site_idx ON inspections(site_id);
CREATE INDEX IF NOT EXISTS inspections_sched_idx ON inspections(scheduled_date);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'awaria',
  priority TEXT NOT NULL DEFAULT 'normalny',
  status TEXT NOT NULL DEFAULT 'nowe',
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  reported_by TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_site_idx ON tickets(site_id);

-- Control panel record ("karta centrali"). A panel belongs to a client and may serve several
-- of its sites (panel_sites); a site may also have several networked panels.
CREATE TABLE IF NOT EXISTS panels (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Centrala główna',
  manufacturer TEXT,
  model TEXT,
  serial TEXT,
  firmware TEXT,
  software_tool TEXT,
  installed_at DATE,
  installer TEXT,
  location TEXT,
  network_address TEXT,
  loops INT,
  zones INT,
  power_supply TEXT,
  batteries TEXT,
  transmission TEXT,
  service_access TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS panel_sites (
  panel_id INT NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  PRIMARY KEY (panel_id, site_id)
);
CREATE INDEX IF NOT EXISTS panel_sites_site_idx ON panel_sites(site_id);

-- Configuration file versions; the bytes live in private object storage.
CREATE TABLE IF NOT EXISTS panel_files (
  id SERIAL PRIMARY KEY,
  panel_id INT NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime TEXT,
  size INT NOT NULL,
  sha256 TEXT,
  s3_key TEXT NOT NULL,
  version TEXT,
  description TEXT,
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS panel_files_panel_idx ON panel_files(panel_id);

-- Change log for devices, tickets and panels. entity_id has no FK so entries survive deletion.
-- site_id is NULL for panel entries: they belong to the panel, which may serve several sites.
CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY,
  site_id INT REFERENCES sites(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  entity_id INT NOT NULL,
  entity_label TEXT,
  kind TEXT NOT NULL,
  summary TEXT,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  comment TEXT,
  event_date DATE NOT NULL DEFAULT current_date,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS history_entity_idx ON history(entity, entity_id);
CREATE INDEX IF NOT EXISTS history_site_idx ON history(site_id);

-- Migration: panels used to belong to a single site (panels.site_id).
ALTER TABLE panels ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE CASCADE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='panels' AND column_name='site_id') THEN
    UPDATE panels p SET client_id = s.client_id FROM sites s WHERE s.id = p.site_id AND p.client_id IS NULL;
    INSERT INTO panel_sites (panel_id, site_id) SELECT id, site_id FROM panels WHERE site_id IS NOT NULL ON CONFLICT DO NOTHING;
    ALTER TABLE panels DROP COLUMN site_id;
  END IF;
END $$;
ALTER TABLE panels ALTER COLUMN client_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS panels_client_idx ON panels(client_id);
ALTER TABLE history ALTER COLUMN site_id DROP NOT NULL;
-- panel entries belong to the panel; only "panel deleted" notes stay attached to the sites it served
UPDATE history SET site_id = NULL WHERE entity = 'panel' AND kind <> 'usunięcie' AND site_id IS NOT NULL;

-- Change log of roles, permissions and team accounts (shown to administrators).
-- user_name / target_label are copies so entries stay readable after a deletion.
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  target_key TEXT,
  target_label TEXT,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);

-- Person responsible for the site; signs inspection and service protocols.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS responsible_position TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS responsible_phone TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS responsible_email TEXT;

-- Service protocol: one per ticket. Draft until issued — then it gets its number (see doc_counters).
CREATE TABLE IF NOT EXISTS service_protocols (
  id SERIAL PRIMARY KEY,
  ticket_id INT NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  protocol_number TEXT,
  issued_at TIMESTAMPTZ,
  performed_date DATE,
  technician_id INT REFERENCES users(id) ON DELETE SET NULL,
  work_done TEXT,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  system_state TEXT,
  recommendations TEXT,
  signer_name TEXT,
  signer_position TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Running numbers of documents per kind and period ('2026', '2026-03' or '-').
CREATE TABLE IF NOT EXISTS doc_counters (
  kind TEXT NOT NULL,
  period TEXT NOT NULL,
  last INT NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, period)
);

-- Photos attached to a history entry (resized in the browser; full image + thumbnail in private storage).
CREATE TABLE IF NOT EXISTS history_photos (
  id SERIAL PRIMARY KEY,
  history_id INT NOT NULL REFERENCES history(id) ON DELETE CASCADE,
  s3_key TEXT NOT NULL,
  thumb_key TEXT NOT NULL,
  filename TEXT,
  size INT NOT NULL,
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS history_photos_history_idx ON history_photos(history_id);
`;

// Default checklist for a periodic SSP inspection.
export const DEFAULT_CHECKLIST = [
  'Centrala — sygnalizacja stanów, wskaźniki, panel obsługi, rejestr zdarzeń',
  'Zasilanie podstawowe 230 V i zabezpieczenia',
  'Zasilanie rezerwowe — pomiar napięcia i stanu akumulatorów',
  'Test czujek pożarowych (wyzwolenie testowe)',
  'Test ręcznych ostrzegaczy pożarowych (ROP)',
  'Sygnalizatory akustyczne i optyczne',
  'Linie dozorowe — ciągłość pętli, izolacja, zwarcia',
  'Transmisja alarmów i uszkodzeń do PSP / stacji monitoringu',
  'Sterowania pożarowe (oddymianie, wentylacja, windy, drzwi, DSO)',
  'Czystość i oznakowanie elementów, dostęp do ROP',
  'Dokumentacja, książka eksploatacji, instrukcja obsługi',
].map((label) => ({ label, state: '', note: '' }));

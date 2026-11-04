// Database schema — applied idempotently on cold start.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
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

-- Control panel record ("karta centrali"); a site may have several networked panels.
CREATE TABLE IF NOT EXISTS panels (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS panels_site_idx ON panels(site_id);

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
CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
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

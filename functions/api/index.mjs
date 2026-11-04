/**
 * CRM SSP — API (action-based dispatch)
 *
 * POST { action, ...params } with `Authorization: Bearer <token>`.
 * Only `auth.login` works without a token.
 */
import pg from 'pg';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SCHEMA, DEFAULT_CHECKLIST } from './schema.mjs';
import { seedDemo } from './demo.mjs';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, DEFAULT_ROLES } from './permissions.mjs';

// DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting)
pg.types.setTypeParser(1082, (v) => v);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, statusCode = 200) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(data) };
}

// ---------- database ----------

let pool;
let schemaReady;
function db() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 8_000,
    });
    pool.on('error', (err) => console.error('[pg] idle connection dropped:', err.message));
  }
  if (!schemaReady) schemaReady = pool.query(SCHEMA).then(() => seedRoles(pool)).catch((e) => { schemaReady = null; throw e; });
  return pool;
}

// Default roles are seeded once (an empty table); the admin role is always present and always complete.
async function seedRoles(p) {
  const { rows } = await p.query('SELECT count(*)::int AS n FROM roles');
  for (const r of rows[0].n ? DEFAULT_ROLES.filter((x) => x.key === 'admin') : DEFAULT_ROLES) {
    await p.query(`INSERT INTO roles (key, name, description, permissions, system, sort) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (key) DO NOTHING`,
      [r.key, r.name, r.description, r.permissions, !!r.system, r.sort]);
  }
  await p.query(`UPDATE roles SET permissions=$1, system=true WHERE key='admin'`, [ALL_PERMISSIONS.filter((k) => k !== 'scope.own')]);
  await p.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_role_fkey') THEN
      ALTER TABLE users ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES roles(key) ON UPDATE CASCADE;
    END IF;
  END $$;`);
}
async function q(sql, params = []) {
  const p = db();
  await schemaReady;
  return (await p.query(sql, params)).rows;
}
const one = async (sql, params) => (await q(sql, params))[0] || null;

// Insert or update a row using only whitelisted columns.
async function save(table, columns, data) {
  const cols = columns.filter((c) => data[c] !== undefined);
  const vals = cols.map((c) => (data[c] === '' ? null : data[c]));
  if (data.id) {
    if (!cols.length) return one(`SELECT * FROM ${table} WHERE id=$1`, [data.id]);
    const set = cols.map((c, i) => `${c}=$${i + 1}`).join(', ');
    const row = await one(`UPDATE ${table} SET ${set} WHERE id=$${cols.length + 1} RETURNING *`, [...vals, data.id]);
    if (!row) throw new HttpError(404, 'Nie znaleziono rekordu');
    return row;
  }
  const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
  return one(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph}) RETURNING *`, vals);
}

// ---------- history (change log) ----------

const FIELD_LABELS = {
  type: 'Typ', manufacturer: 'Producent', model: 'Model', serial: 'Nr seryjny', loop_no: 'Pętla', address_no: 'Adres',
  location: 'Lokalizacja', quantity: 'Ilość', installed_at: 'Data montażu', replace_by: 'Wymiana do', status: 'Status',
  notes: 'Uwagi', title: 'Tytuł', description: 'Opis', category: 'Kategoria', priority: 'Priorytet', assigned_to: 'Technik',
  reported_by: 'Zgłaszający', due_date: 'Termin realizacji', resolution: 'Wykonane prace', name: 'Nazwa', firmware: 'Firmware',
  software_tool: 'Oprogramowanie serwisowe', installer: 'Instalator', network_address: 'Adres sieciowy', loops: 'Pętle',
  zones: 'Strefy', power_supply: 'Zasilacz', batteries: 'Akumulatory', transmission: 'Transmisja / UTA', service_access: 'Dostęp serwisowy',
};
const ENTITY_LABEL = {
  device: (r) => `${r.type}${r.loop_no != null ? ` L${r.loop_no}${r.address_no != null ? '/' + r.address_no : ''}` : ''}${r.location ? ' — ' + r.location : ''}`,
  ticket: (r) => `#${r.id} ${r.title}`,
  panel: (r) => [r.name, r.model].filter(Boolean).join(' — '),
};
const CREATED = { device: 'Dodano element do ewidencji', ticket: 'Zarejestrowano zgłoszenie', panel: 'Utworzono kartę centrali' };
const HISTORY_SELECT = 'SELECT h.*, u.name AS user_name FROM history h LEFT JOIN users u ON u.id=h.user_id';

const norm = (v) => (v === '' || v === undefined ? null : v instanceof Date ? v.toISOString() : v);
function diff(before, after, cols) {
  return cols.filter((c) => String(norm(before?.[c]) ?? '') !== String(norm(after?.[c]) ?? ''))
    .map((c) => ({ field: c, label: FIELD_LABELS[c] || c, from: norm(before?.[c]), to: norm(after?.[c]) }));
}
// Show technician names instead of ids
async function withNames(changes) {
  const ids = changes.filter((c) => c.field === 'assigned_to').flatMap((c) => [c.from, c.to]).filter(Boolean);
  if (!ids.length) return changes;
  const names = Object.fromEntries((await q('SELECT id, name FROM users WHERE id = ANY($1)', [ids])).map((u) => [u.id, u.name]));
  return changes.map((c) => (c.field === 'assigned_to' ? { ...c, from: names[c.from] ?? null, to: names[c.to] ?? null } : c));
}
function logEvent({ site_id, entity, entity_id, entity_label, kind, summary, changes = [], comment, event_date, user }) {
  return one(`INSERT INTO history (site_id, entity, entity_id, entity_label, kind, summary, changes, comment, event_date, user_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::date, current_date),$10) RETURNING *`,
  [site_id, entity, entity_id, entity_label, kind, summary || null, JSON.stringify(changes), comment || null, event_date || null, user?.id || null]);
}
// Record a create/update of a row; no entry when nothing changed. `extra` = changes computed elsewhere.
async function logChange(entity, before, row, cols, user, extra = []) {
  const changes = [...(before ? await withNames(diff(before, row, cols)) : []), ...extra];
  if (before && !changes.length) return;
  const status = changes.find((c) => c.field === 'status');
  await logEvent({
    site_id: row.site_id, entity, entity_id: row.id, entity_label: ENTITY_LABEL[entity](row), user, changes,
    kind: !before ? 'utworzenie' : status ? 'status' : 'zmiana',
    summary: !before ? CREATED[entity] : status ? `Status: ${status.from ?? '—'} → ${status.to ?? '—'}` : null,
  });
}

// Manual entries per entity; `effect` patches the device row.
const DEVICE_EVENTS = {
  test: { summary: 'Test / pomiar' },
  konserwacja: { summary: 'Konserwacja' },
  usterka: { summary: 'Stwierdzono usterkę', effect: { status: 'uszkodzone' } },
  naprawa: { summary: 'Naprawa', effect: { status: 'sprawne' } },
  wymiana: { summary: 'Wymiana elementu', effect: { status: 'sprawne' } },
  notatka: { summary: null },
};
const MANUAL_KINDS = {
  ticket: ['komentarz'],
  panel: ['notatka', 'serwis', 'aktualizacja oprogramowania', 'zmiana konfiguracji', 'usterka', 'naprawa'],
};
const AUTO_KINDS = ['utworzenie', 'zmiana', 'status', 'usunięcie', 'plik'];
const ENTITY_TABLE = { device: 'devices', ticket: 'tickets', panel: 'panels' };

// ---------- file storage (private prefix, presigned downloads) ----------

const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-central-1' });
const BUCKET = process.env.STORAGE_BUCKET;
const MAX_FILE = 4 * 1024 * 1024; // function URL payload limit is 6 MB incl. base64 overhead

async function purgeFiles(where, params) {
  const rows = await q(`SELECT f.s3_key FROM panel_files f JOIN panels p ON p.id=f.panel_id WHERE ${where}`, params);
  await Promise.all(rows.map((r) => s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: r.s3_key }))
    .catch((e) => console.error('[s3] delete failed', r.s3_key, e.message))));
}

// ---------- photos on history entries ----------

const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 4.4 * 1024 * 1024; // all photos of one entry together
const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

// photos: [{ data, thumb, filename, width, height }] — base64 JPEGs prepared by the browser
async function savePhotos(entry, photos) {
  if (!photos?.length) return [];
  if (photos.length > MAX_PHOTOS) throw new HttpError(400, `Maksymalnie ${MAX_PHOTOS} zdjęć w jednym wpisie`);
  const bufs = photos.map((p) => ({ ...p, full: Buffer.from(p.data || '', 'base64'), small: Buffer.from(p.thumb || '', 'base64') }));
  if (bufs.some((p) => !isJpeg(p.full) || !isJpeg(p.small))) throw new HttpError(400, 'Nieprawidłowy plik zdjęcia');
  if (bufs.reduce((a, p) => a + p.full.length + p.small.length, 0) > MAX_PHOTO_BYTES) throw new HttpError(400, 'Zdjęcia są za duże — dodaj mniej zdjęć naraz');
  const saved = [];
  for (const p of bufs) {
    const owner = entry.site_id ? `site-${entry.site_id}` : `${entry.entity}-${entry.entity_id}`;
    const base = `photos/${owner}/h-${entry.id}/${crypto.randomBytes(8).toString('hex')}`;
    await Promise.all([
      s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: `${base}.jpg`, Body: p.full, ContentType: 'image/jpeg' })),
      s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: `${base}-thumb.jpg`, Body: p.small, ContentType: 'image/jpeg' })),
    ]);
    saved.push(await one(`INSERT INTO history_photos (history_id, s3_key, thumb_key, filename, size, width, height)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [entry.id, `${base}.jpg`, `${base}-thumb.jpg`, String(p.filename || '').slice(0, 200) || null, p.full.length, p.width || null, p.height || null]));
  }
  return saved;
}

const presign = (key) => getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });

// Add `photos: [{ id, url, thumb, width, height }]` to history rows (signed for 1 h).
async function attachPhotos(rows) {
  const ids = rows.map((r) => r.id);
  const photos = ids.length ? await q('SELECT * FROM history_photos WHERE history_id = ANY($1) ORDER BY id', [ids]) : [];
  const signed = await Promise.all(photos.map(async (p) => ({
    history_id: p.history_id, id: p.id, width: p.width, height: p.height, filename: p.filename,
    url: await presign(p.s3_key), thumb: await presign(p.thumb_key),
  })));
  for (const r of rows) r.photos = signed.filter((p) => p.history_id === r.id);
  return rows;
}

async function purgePhotos(where, params) {
  const rows = await q(`SELECT p.s3_key, p.thumb_key FROM history_photos p JOIN history h ON h.id=p.history_id
    LEFT JOIN sites s ON s.id=h.site_id WHERE ${where}`, params);
  await Promise.all(rows.flatMap((r) => [r.s3_key, r.thumb_key]).map((Key) => s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }))
    .catch((e) => console.error('[s3] delete failed', Key, e.message))));
}

// ---------- panels ↔ sites ----------

// A panel belongs to a client and serves any number of that client's sites.
const panelSites = (panelId) => q(`SELECT s.id, s.name FROM panel_sites ps JOIN sites s ON s.id=ps.site_id
  WHERE ps.panel_id=$1 ORDER BY s.name`, [panelId]);

async function checkPanelSites(clientId, ids) {
  const wanted = [...new Set((ids || []).map(Number).filter(Boolean))];
  const own = await q('SELECT id FROM sites WHERE id = ANY($1) AND client_id=$2', [wanted, clientId]);
  if (own.length !== wanted.length) throw new HttpError(400, 'Centrala może obsługiwać tylko obiekty tego samego klienta');
  return wanted;
}
async function setPanelSites(panel, ids) {
  const wanted = await checkPanelSites(panel.client_id, ids);
  await q('DELETE FROM panel_sites WHERE panel_id=$1 AND NOT (site_id = ANY($2))', [panel.id, wanted]);
  await q('INSERT INTO panel_sites (panel_id, site_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING', [panel.id, wanted]);
  return panelSites(panel.id);
}

const siteNames = (list) => list.map((s) => s.name).join(', ') || null;
const sitesChange = (before, after) => (siteNames(before) === siteNames(after) ? []
  : [{ field: 'site_ids', label: 'Obsługiwane obiekty', from: siteNames(before), to: siteNames(after) }]);

// Panels with their files and history belong to the client; `clientIds` is a SQL subquery or '$1'.
async function purgeClientPanels(clientIds, params) {
  const panelIds = `(SELECT id FROM panels WHERE client_id IN (${clientIds}))`;
  await purgeFiles(`p.id IN ${panelIds}`, params);
  await purgePhotos(`h.entity='panel' AND h.entity_id IN ${panelIds}`, params);
  await q(`DELETE FROM history WHERE entity='panel' AND entity_id IN ${panelIds}`, params);
}

// ---------- auth ----------

// Signing key lives in the database so tokens survive redeploys (the env API key rotates).
let secret;
async function getSecret() {
  if (!secret) {
    await q(`INSERT INTO app_settings (key, value) VALUES ('token_secret', $1) ON CONFLICT (key) DO NOTHING`,
      [crypto.randomBytes(32).toString('hex')]);
    secret = Buffer.from((await one(`SELECT value FROM app_settings WHERE key='token_secret'`)).value, 'hex');
  }
  return secret;
}
const TOKEN_TTL = 30 * 24 * 3600 * 1000;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}
async function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', await getSecret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}
async function verify(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', await getSecret()).update(body).digest('base64url');
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  return payload.exp > Date.now() ? payload : null;
}
const publicUser = ({ password_hash, ...u }) => u;

// User row + role name + effective permission list
const USER_SELECT = 'SELECT u.*, r.name AS role_name, r.permissions FROM users u LEFT JOIN roles r ON r.key=u.role';
async function loadUser(where, params) {
  const user = await one(`${USER_SELECT} WHERE ${where}`, params);
  if (user) user.permissions = user.role === 'admin' ? ALL_PERMISSIONS.filter((k) => k !== 'scope.own') : user.permissions || [];
  return user;
}

async function currentUser(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || '';
  const payload = await verify(h.replace(/^Bearer\s+/i, ''));
  if (!payload) throw new HttpError(401, 'Sesja wygasła — zaloguj się ponownie');
  const user = await loadUser('u.id=$1 AND u.active', [payload.uid]);
  if (!user) throw new HttpError(401, 'Konto nieaktywne');
  return user;
}

// ---------- permissions ----------

const PERMISSION_LABEL = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])));
const can = (user, perm) => user.permissions.includes(perm);
function need(user, ...perms) { // any of perms
  if (!perms.some((p) => can(user, p))) throw new HttpError(403, `Brak uprawnień: ${PERMISSION_LABEL[perms[0]] || perms[0]}`);
}
function requireAdmin(user) {
  if (user.role !== 'admin') throw new HttpError(403, 'Wymagane uprawnienia administratora');
}
// "only own work": the user's id when the role is limited to assigned tickets/inspections, else null
const ownOnly = (user) => (can(user, 'scope.own') ? user.id : null);
function needOwn(user, assigneeId, what) {
  if (ownOnly(user) && assigneeId !== user.id) throw new HttpError(403, `Brak dostępu — ${what} nie jest przypisane do Ciebie`);
}
// History of a record is visible to whoever may see the record itself.
const ENTITY_VIEW = { device: 'sites.view', ticket: 'tickets.view', panel: 'panels.view' };
async function needEntity(user, entity, id) {
  need(user, ENTITY_VIEW[entity]);
  const row = await one(`SELECT * FROM ${ENTITY_TABLE[entity]} WHERE id=$1`, [id]);
  if (!row) throw new HttpError(404, 'Nie znaleziono rekordu');
  if (entity === 'ticket') needOwn(user, row.assigned_to, 'to zgłoszenie');
  return row;
}
// The "service access" note is visible only with panels.access
const maskPanel = (user, p) => (p && !can(user, 'panels.access') ? { ...p, service_access: undefined } : p);

// ---------- shared SQL ----------

// next_due: earliest planned inspection, otherwise last inspection + interval
const SITE_SELECT = `
  SELECT s.*, c.name AS client_name,
    COALESCE(
      (SELECT min(i.scheduled_date) FROM inspections i WHERE i.site_id=s.id AND i.status='zaplanowany'),
      (s.last_inspection + make_interval(months => s.inspection_interval_months))::date
    ) AS next_due,
    (SELECT count(*)::int FROM devices d WHERE d.site_id=s.id) AS device_count,
    (SELECT count(*)::int FROM tickets t WHERE t.site_id=s.id AND t.status <> 'zakończone') AS open_tickets
  FROM sites s JOIN clients c ON c.id=s.client_id`;

const INSPECTION_SELECT = `
  SELECT i.*, s.name AS site_name, s.address AS site_address, s.city AS site_city,
    c.name AS client_name, c.id AS client_id, u.name AS technician_name
  FROM inspections i
  JOIN sites s ON s.id=i.site_id
  JOIN clients c ON c.id=s.client_id
  LEFT JOIN users u ON u.id=i.technician_id`;

const TICKET_SELECT = `
  SELECT t.*, s.name AS site_name, s.city AS site_city, c.name AS client_name, c.id AS client_id,
    u.name AS assignee_name
  FROM tickets t
  JOIN sites s ON s.id=t.site_id
  JOIN clients c ON c.id=s.client_id
  LEFT JOIN users u ON u.id=t.assigned_to`;

const CLIENT_COLS = ['name', 'nip', 'address', 'city', 'contact_person', 'phone', 'email', 'notes'];
const SITE_COLS = ['client_id', 'name', 'address', 'city', 'building_type', 'panel_manufacturer', 'panel_model',
  'system_type', 'loops', 'monitoring', 'monitoring_operator', 'contract_number', 'contract_end',
  'inspection_interval_months', 'last_inspection', 'on_site_contact', 'on_site_phone', 'notes'];
const DEVICE_COLS = ['site_id', 'type', 'manufacturer', 'model', 'serial', 'loop_no', 'address_no', 'location',
  'quantity', 'installed_at', 'replace_by', 'status', 'notes'];
const INSPECTION_COLS = ['site_id', 'type', 'scheduled_date', 'performed_date', 'technician_id', 'status', 'result',
  'protocol_number', 'checklist', 'findings', 'recommendations'];
const TICKET_COLS = ['site_id', 'title', 'description', 'category', 'priority', 'status', 'assigned_to',
  'reported_by', 'due_date', 'resolution'];
const PANEL_COLS = ['client_id', 'name', 'manufacturer', 'model', 'serial', 'firmware', 'software_tool', 'installed_at', 'installer',
  'location', 'network_address', 'loops', 'zones', 'power_supply', 'batteries', 'transmission', 'service_access', 'notes'];
const PANEL_SELECT = `SELECT p.*, (SELECT count(*)::int FROM panel_files f WHERE f.panel_id=p.id) AS file_count,
    (SELECT max(f.created_at) FROM panel_files f WHERE f.panel_id=p.id) AS last_file_at,
    COALESCE((SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
      FROM panel_sites ps JOIN sites s ON s.id=ps.site_id WHERE ps.panel_id=p.id), '[]') AS sites
  FROM panels p`;
const without = (cols, ...skip) => cols.filter((c) => !skip.includes(c));

// ---------- actions ----------

const actions = {
  // --- auth ---
  async 'auth.login'({ email, password }) {
    const user = await loadUser('lower(u.email)=lower($1) AND u.active', [email || '']);
    if (!user || !checkPassword(password || '', user.password_hash)) throw new HttpError(401, 'Nieprawidłowy e-mail lub hasło');
    return { token: await sign({ uid: user.id, exp: Date.now() + TOKEN_TTL }), user: publicUser(user) };
  },
  async 'auth.me'(_, user) { return { user: publicUser(user) }; },
  async 'auth.changePassword'({ current, next }, user) {
    if (!checkPassword(current || '', user.password_hash)) throw new HttpError(400, 'Obecne hasło jest nieprawidłowe');
    if (!next || next.length < 8) throw new HttpError(400, 'Nowe hasło musi mieć co najmniej 8 znaków');
    await q('UPDATE users SET password_hash=$1 WHERE id=$2', [hashPassword(next), user.id]);
    return { ok: true };
  },

  // --- users ---
  async 'users.list'() {
    return (await q(`SELECT u.id, u.email, u.name, u.phone, u.role, u.active, u.created_at, r.name AS role_name
      FROM users u LEFT JOIN roles r ON r.key=u.role ORDER BY u.active DESC, u.name`));
  },
  async 'users.save'(p, user) {
    need(user, 'users.manage');
    const target = p.id ? await one('SELECT * FROM users WHERE id=$1', [p.id]) : null;
    if (p.id && !target) throw new HttpError(404, 'Nie znaleziono użytkownika');
    // only an administrator may create, edit or appoint administrators
    if (user.role !== 'admin' && (p.role === 'admin' || target?.role === 'admin')) throw new HttpError(403, 'Konta administratorów zarządza tylko administrator');
    if (!(await one('SELECT 1 FROM roles WHERE key=$1', [p.role]))) throw new HttpError(400, 'Wybierz rolę');
    const data = { id: p.id, email: p.email?.trim().toLowerCase(), name: p.name, phone: p.phone, role: p.role, active: p.active };
    if (p.password) {
      if (p.password.length < 8) throw new HttpError(400, 'Hasło musi mieć co najmniej 8 znaków');
      data.password_hash = hashPassword(p.password);
    } else if (!p.id) throw new HttpError(400, 'Podaj hasło dla nowego użytkownika');
    if (p.id === user.id && p.active === false) throw new HttpError(400, 'Nie możesz wyłączyć własnego konta');
    if (p.id === user.id && user.role === 'admin' && p.role !== 'admin') throw new HttpError(400, 'Nie możesz odebrać sobie uprawnień administratora');
    try {
      const row = await save('users', ['email', 'name', 'phone', 'role', 'active', 'password_hash'], data);
      return publicUser(await loadUser('u.id=$1', [row.id]));
    } catch (e) {
      if (e.code === '23505') throw new HttpError(400, 'Użytkownik z tym adresem e-mail już istnieje');
      throw e;
    }
  },

  // --- roles & permission matrix ---
  async 'roles.list'() {
    const roles = await q(`SELECT r.*, (SELECT count(*)::int FROM users u WHERE u.role=r.key AND u.active) AS user_count
      FROM roles r ORDER BY r.sort, r.name`);
    return { roles, catalog: PERMISSION_GROUPS };
  },
  async 'roles.save'({ key, name, description, permissions }, user) {
    requireAdmin(user);
    if (!name?.trim()) throw new HttpError(400, 'Podaj nazwę roli');
    if (key === 'admin') throw new HttpError(400, 'Roli Administrator nie można zmieniać');
    const perms = [...new Set((permissions || []).filter((x) => ALL_PERMISSIONS.includes(x)))];
    if (key) {
      const row = await one('UPDATE roles SET name=$2, description=$3, permissions=$4 WHERE key=$1 RETURNING *', [key, name.trim(), description || null, perms]);
      if (!row) throw new HttpError(404, 'Nie znaleziono roli');
      return row;
    }
    const newKey = `rola-${crypto.randomBytes(4).toString('hex')}`;
    return one(`INSERT INTO roles (key, name, description, permissions, sort) VALUES ($1,$2,$3,$4,
      (SELECT COALESCE(max(sort), 0) + 1 FROM roles)) RETURNING *`, [newKey, name.trim(), description || null, perms]);
  },
  async 'roles.delete'({ key }, user) {
    requireAdmin(user);
    if (key === 'admin') throw new HttpError(400, 'Roli Administrator nie można usunąć');
    const used = await one('SELECT count(*)::int AS n FROM users WHERE role=$1', [key]);
    if (used.n) throw new HttpError(400, `Rola jest przypisana do ${used.n} ${used.n === 1 ? 'konta' : 'kont'} — najpierw zmień im rolę`);
    await q('DELETE FROM roles WHERE key=$1', [key]);
    return { ok: true };
  },

  // --- dashboard ---
  // sections the user may not see come back as null
  async dashboard(_, user) {
    const own = ownOnly(user);
    const [counts] = await q(`SELECT
      (SELECT count(*)::int FROM clients) AS clients,
      (SELECT count(*)::int FROM sites) AS sites,
      (SELECT count(*)::int FROM devices) AS devices,
      (SELECT count(*)::int FROM tickets WHERE status <> 'zakończone') AS open_tickets,
      (SELECT count(*)::int FROM tickets WHERE status <> 'zakończone' AND priority='krytyczny') AS critical_tickets,
      (SELECT count(*)::int FROM inspections WHERE status='wykonany' AND performed_date >= date_trunc('month', now())) AS done_this_month`);
    const sites = await q(`SELECT * FROM (${SITE_SELECT}) x WHERE next_due IS NOT NULL AND next_due <= current_date + 30 ORDER BY next_due LIMIT 50`);
    const noSchedule = await q(`SELECT * FROM (${SITE_SELECT}) x WHERE next_due IS NULL ORDER BY name LIMIT 20`);
    const tickets = await q(`${TICKET_SELECT} WHERE t.status <> 'zakończone' AND ($1::int IS NULL OR t.assigned_to=$1)
      ORDER BY CASE t.priority WHEN 'krytyczny' THEN 0 WHEN 'wysoki' THEN 1 WHEN 'normalny' THEN 2 ELSE 3 END, t.reported_at LIMIT 12`, [own]);
    const replacements = await q(`SELECT d.*, s.name AS site_name, c.name AS client_name FROM devices d
      JOIN sites s ON s.id=d.site_id JOIN clients c ON c.id=s.client_id
      WHERE d.replace_by IS NOT NULL AND d.replace_by <= current_date + 90 AND d.status <> 'wycofane'
      ORDER BY d.replace_by LIMIT 15`);
    const contracts = await q(`SELECT s.id, s.name, s.contract_number, s.contract_end, c.name AS client_name FROM sites s
      JOIN clients c ON c.id=s.client_id WHERE s.contract_end IS NOT NULL AND s.contract_end <= current_date + 60
      ORDER BY s.contract_end LIMIT 15`);
    const perMonth = await q(`SELECT to_char(m, 'YYYY-MM') AS month,
        (SELECT count(*)::int FROM inspections i WHERE i.status='wykonany' AND date_trunc('month', i.performed_date)=m) AS done,
        (SELECT count(*)::int FROM tickets t WHERE date_trunc('month', t.reported_at)=m) AS tickets
      FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
      ORDER BY m`);
    const demo = !!(await one('SELECT 1 FROM clients WHERE demo LIMIT 1'));
    const sitesOk = can(user, 'sites.view');
    return {
      counts, perMonth, demo,
      sites: sitesOk ? sites : null, noSchedule: sitesOk ? noSchedule : null, replacements: sitesOk ? replacements : null,
      contracts: sitesOk || can(user, 'clients.view') ? contracts : null,
      tickets: can(user, 'tickets.view') ? tickets : null,
    };
  },

  // --- clients ---
  async 'clients.list'({ search }) {
    return q(`SELECT c.*, (SELECT count(*)::int FROM sites s WHERE s.client_id=c.id) AS site_count,
        (SELECT count(*)::int FROM tickets t JOIN sites s ON s.id=t.site_id WHERE s.client_id=c.id AND t.status <> 'zakończone') AS open_tickets
      FROM clients c
      WHERE $1::text IS NULL OR c.name ILIKE '%'||$1||'%' OR c.city ILIKE '%'||$1||'%' OR c.nip ILIKE '%'||$1||'%' OR c.contact_person ILIKE '%'||$1||'%'
      ORDER BY c.name`, [search || null]);
  },
  async 'clients.get'({ id }, user) {
    const client = await one('SELECT * FROM clients WHERE id=$1', [id]);
    if (!client) throw new HttpError(404, 'Nie znaleziono klienta');
    const sites = await q(`${SITE_SELECT} WHERE s.client_id=$1 ORDER BY s.name`, [id]);
    const tickets = can(user, 'tickets.view') ? await q(`${TICKET_SELECT} WHERE c.id=$1 AND ($2::int IS NULL OR t.assigned_to=$2)
      ORDER BY t.reported_at DESC LIMIT 20`, [id, ownOnly(user)]) : null;
    const panels = can(user, 'panels.view') ? (await q(`${PANEL_SELECT} WHERE p.client_id=$1 ORDER BY p.name, p.id`, [id])).map((x) => maskPanel(user, x)) : null;
    return { client, sites, tickets, panels };
  },
  async 'clients.save'(p) {
    if (!p.name?.trim()) throw new HttpError(400, 'Nazwa klienta jest wymagana');
    return save('clients', CLIENT_COLS, p);
  },
  async 'clients.delete'({ id }, user) {
    await purgeClientPanels('$1', [id]);
    await purgePhotos('s.client_id=$1', [id]);
    await q('DELETE FROM clients WHERE id=$1', [id]);
    return { ok: true };
  },

  // --- sites ---
  async 'sites.list'({ search, client_id }) {
    return q(`SELECT * FROM (${SITE_SELECT}) x
      WHERE ($1::text IS NULL OR name ILIKE '%'||$1||'%' OR city ILIKE '%'||$1||'%' OR address ILIKE '%'||$1||'%' OR client_name ILIKE '%'||$1||'%' OR panel_manufacturer ILIKE '%'||$1||'%')
        AND ($2::int IS NULL OR client_id=$2)
      ORDER BY next_due NULLS LAST, name`, [search || null, client_id || null]);
  },
  // parts the user may not see come back as null
  async 'sites.get'({ id }, user) {
    const site = await one(`${SITE_SELECT} WHERE s.id=$1`, [id]);
    if (!site) throw new HttpError(404, 'Nie znaleziono obiektu');
    const own = ownOnly(user);
    const panelsOk = can(user, 'panels.view');
    const devices = await q('SELECT * FROM devices WHERE site_id=$1 ORDER BY loop_no NULLS FIRST, address_no NULLS FIRST, type, id', [id]);
    const inspections = can(user, 'inspections.view') ? await q(`${INSPECTION_SELECT} WHERE i.site_id=$1 AND ($2::int IS NULL OR i.technician_id=$2)
      ORDER BY COALESCE(i.performed_date, i.scheduled_date) DESC`, [id, own]) : null;
    const tickets = can(user, 'tickets.view') ? await q(`${TICKET_SELECT} WHERE t.site_id=$1 AND ($2::int IS NULL OR t.assigned_to=$2)
      ORDER BY t.reported_at DESC`, [id, own]) : null;
    const linked = '(SELECT panel_id FROM panel_sites WHERE site_id=$1)';
    const panels = panelsOk ? (await q(`${PANEL_SELECT} WHERE p.id IN ${linked} ORDER BY p.id`, [id])).map((x) => maskPanel(user, x)) : null;
    // other panels of the same client that can be assigned to this site
    const clientPanels = panelsOk ? (await q(`${PANEL_SELECT} WHERE p.client_id=$2 AND p.id NOT IN ${linked} ORDER BY p.name, p.id`, [id, site.client_id])).map((x) => maskPanel(user, x)) : null;
    // element entries of this site + entries of panels serving it (+ "panel deleted" notes left on the site)
    const history = await attachPhotos(await q(`${HISTORY_SELECT}
      WHERE (h.site_id=$1 AND h.entity='device')
        OR ($2 AND ((h.site_id=$1 AND h.entity='panel') OR (h.entity='panel' AND h.entity_id IN ${linked})))
      ORDER BY h.event_date DESC, h.id DESC LIMIT 300`, [id, panelsOk]));
    const clientSites = await q('SELECT id, name, city FROM sites WHERE client_id=$1 ORDER BY name', [site.client_id]);
    return { site, devices, inspections, tickets, panels, clientPanels, clientSites, history };
  },
  async 'sites.save'(p) {
    if (!p.name?.trim() || !p.client_id) throw new HttpError(400, 'Nazwa obiektu i klient są wymagane');
    const row = await save('sites', SITE_COLS, p);
    // a site moved to another client can no longer be served by the old client's panels
    await q('DELETE FROM panel_sites ps USING panels p WHERE p.id=ps.panel_id AND ps.site_id=$1 AND p.client_id<>$2', [row.id, row.client_id]);
    return row;
  },
  async 'sites.delete'({ id }, user) {
    // panels stay with the client; only the link to this site goes (ON DELETE CASCADE)
    await purgePhotos('s.id=$1', [id]);
    await q('DELETE FROM sites WHERE id=$1', [id]);
    return { ok: true };
  },

  // --- devices ---
  async 'devices.save'(p, user) {
    if (!p.type || !p.site_id) throw new HttpError(400, 'Typ urządzenia jest wymagany');
    const before = p.id ? await one('SELECT * FROM devices WHERE id=$1', [p.id]) : null;
    const row = await save('devices', DEVICE_COLS, p);
    await logChange('device', before, row, without(DEVICE_COLS, 'site_id'), user);
    return row;
  },
  async 'devices.delete'({ id }, user) {
    const row = await one('DELETE FROM devices WHERE id=$1 RETURNING *', [id]);
    if (row) await logEvent({ site_id: row.site_id, entity: 'device', entity_id: row.id, entity_label: ENTITY_LABEL.device(row), kind: 'usunięcie', summary: 'Usunięto element z ewidencji', user });
    return { ok: true };
  },
  // Service entry for a device (test, repair, replacement…); may update the device itself.
  async 'devices.event'({ device_id, kind, event_date, comment, replace_by, serial, photos }, user) {
    const def = DEVICE_EVENTS[kind];
    if (!def) throw new HttpError(400, 'Nieznany rodzaj wpisu');
    if (kind === 'notatka' && !comment?.trim() && !photos?.length) throw new HttpError(400, 'Wpisz treść notatki lub dodaj zdjęcie');
    const before = await one('SELECT * FROM devices WHERE id=$1', [device_id]);
    if (!before) throw new HttpError(404, 'Nie znaleziono elementu');
    const patch = { ...def.effect };
    if (kind === 'wymiana') {
      patch.installed_at = event_date || new Date().toISOString().slice(0, 10);
      if (replace_by !== undefined) patch.replace_by = replace_by;
      if (serial) patch.serial = serial;
    }
    const row = Object.keys(patch).length ? await save('devices', DEVICE_COLS, { id: before.id, ...patch }) : before;
    const entry = await logEvent({ site_id: row.site_id, entity: 'device', entity_id: row.id, entity_label: ENTITY_LABEL.device(row),
      kind, summary: def.summary, changes: diff(before, row, Object.keys(patch)), comment, event_date, user });
    await savePhotos(entry, photos);
    return { device: row, entry };
  },

  // --- history ---
  async 'history.list'({ entity, entity_id }, user) {
    if (!ENTITY_TABLE[entity]) throw new HttpError(400, 'Nieznany typ rekordu');
    await needEntity(user, entity, entity_id);
    return attachPhotos(await q(`${HISTORY_SELECT} WHERE h.entity=$1 AND h.entity_id=$2 ORDER BY h.event_date DESC, h.id DESC`, [entity, entity_id]));
  },
  async 'history.add'({ entity, entity_id, kind, comment, event_date, photos }, user) {
    if (!MANUAL_KINDS[entity]?.includes(kind)) throw new HttpError(400, 'Nieznany rodzaj wpisu');
    if (!comment?.trim() && !photos?.length) throw new HttpError(400, 'Wpisz treść lub dodaj zdjęcie');
    const row = await needEntity(user, entity, entity_id);
    const entry = await logEvent({ site_id: row.site_id, entity, entity_id: row.id, entity_label: ENTITY_LABEL[entity](row), kind, comment: comment?.trim(), event_date, user });
    await savePhotos(entry, photos);
    return entry;
  },
  async 'history.delete'({ id }, user) {
    const h = await one('SELECT * FROM history WHERE id=$1', [id]);
    if (!h) return { ok: true };
    // only hand-written entries; own ones with history.add, others' with history.delete. Automatic entries are the audit trail.
    if (AUTO_KINDS.includes(h.kind)) throw new HttpError(400, 'Wpisów automatycznych nie można usuwać');
    need(user, h.user_id === user.id ? 'history.add' : 'history.delete');
    await purgePhotos('h.id=$1', [id]);
    await q('DELETE FROM history WHERE id=$1', [id]);
    return { ok: true };
  },

  // --- panels (control panel cards) ---
  async 'panels.get'({ id }, user) {
    const panel = maskPanel(user, await one(`${PANEL_SELECT} WHERE p.id=$1`, [id]));
    if (!panel) throw new HttpError(404, 'Nie znaleziono centrali');
    const client = await one('SELECT id, name FROM clients WHERE id=$1', [panel.client_id]);
    const sites = await q(`${SITE_SELECT} WHERE s.id IN (SELECT site_id FROM panel_sites WHERE panel_id=$1) ORDER BY s.name`, [id]);
    const clientSites = await q('SELECT id, name, city FROM sites WHERE client_id=$1 ORDER BY name', [panel.client_id]);
    const files = await q(`SELECT f.id, f.filename, f.mime, f.size, f.sha256, f.version, f.description, f.created_at, f.uploaded_by, u.name AS uploader_name
      FROM panel_files f LEFT JOIN users u ON u.id=f.uploaded_by WHERE f.panel_id=$1 ORDER BY f.created_at DESC`, [id]);
    const history = await attachPhotos(await q(`${HISTORY_SELECT} WHERE h.entity='panel' AND h.entity_id=$1 ORDER BY h.event_date DESC, h.id DESC`, [id]));
    return { panel, client, sites, clientSites, files, history };
  },
  // site_ids (optional): the full set of sites the panel serves
  async 'panels.save'(p, user) {
    if (!p.client_id || !p.name?.trim()) throw new HttpError(400, 'Klient i nazwa centrali są wymagane');
    if (!can(user, 'panels.access')) p = { ...p, service_access: undefined }; // field not visible to this user — keep the stored value
    const before = p.id ? await one('SELECT * FROM panels WHERE id=$1', [p.id]) : null;
    if (before && before.client_id !== Number(p.client_id)) throw new HttpError(400, 'Centrali nie można przenieść do innego klienta');
    if (p.site_ids) await checkPanelSites(Number(p.client_id), p.site_ids); // before writing anything
    const sitesBefore = before ? await panelSites(before.id) : [];
    const row = await save('panels', PANEL_COLS, p);
    const sitesAfter = p.site_ids ? await setPanelSites(row, p.site_ids) : sitesBefore;
    await logChange('panel', before, row, without(PANEL_COLS, 'client_id'), user, sitesChange(sitesBefore, sitesAfter));
    return row;
  },
  async 'panels.linkSite'({ panel_id, site_id }, user) {
    const panel = await one('SELECT * FROM panels WHERE id=$1', [panel_id]);
    if (!panel) throw new HttpError(404, 'Nie znaleziono centrali');
    const before = await panelSites(panel.id);
    const after = await setPanelSites(panel, [...before.map((s) => s.id), site_id]);
    await logChange('panel', panel, panel, [], user, sitesChange(before, after));
    return { ok: true };
  },
  async 'panels.unlinkSite'({ panel_id, site_id }, user) {
    const panel = await one('SELECT * FROM panels WHERE id=$1', [panel_id]);
    if (!panel) throw new HttpError(404, 'Nie znaleziono centrali');
    const before = await panelSites(panel.id);
    const after = await setPanelSites(panel, before.map((s) => s.id).filter((x) => x !== Number(site_id)));
    await logChange('panel', panel, panel, [], user, sitesChange(before, after));
    return { ok: true };
  },
  async 'panels.delete'({ id }, user) {
    const sites = await panelSites(id);
    await purgeFiles('p.id=$1', [id]);
    await purgePhotos(`h.entity='panel' AND h.entity_id=$1`, [id]);
    await q(`DELETE FROM history WHERE entity='panel' AND entity_id=$1`, [id]);
    const row = await one('DELETE FROM panels WHERE id=$1 RETURNING *', [id]);
    // leave a note in the operating log of every site the panel served
    for (const s of row ? sites : []) {
      await logEvent({ site_id: s.id, entity: 'panel', entity_id: row.id, entity_label: ENTITY_LABEL.panel(row), kind: 'usunięcie', summary: 'Usunięto kartę centrali', user });
    }
    return { ok: true };
  },
  async 'panels.upload'({ panel_id, filename, mime, data, version, description }, user) {
    const panel = await one('SELECT * FROM panels WHERE id=$1', [panel_id]);
    if (!panel) throw new HttpError(404, 'Nie znaleziono centrali');
    if (!filename || !data) throw new HttpError(400, 'Brak pliku');
    const buf = Buffer.from(data, 'base64');
    if (!buf.length) throw new HttpError(400, 'Plik jest pusty');
    if (buf.length > MAX_FILE) throw new HttpError(400, 'Plik jest za duży (maks. 4 MB)');
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const same = await one('SELECT id, version, filename, created_at FROM panel_files WHERE panel_id=$1 AND sha256=$2 ORDER BY created_at DESC LIMIT 1', [panel.id, sha256]);
    const safe = String(filename).normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-120);
    const key = `configs/client-${panel.client_id}/panel-${panel.id}/${Date.now()}-${safe}`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: mime || 'application/octet-stream' }));
    const file = await one(`INSERT INTO panel_files (panel_id, filename, mime, size, sha256, s3_key, version, description, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, filename, size, version, created_at`,
    [panel.id, filename, mime || null, buf.length, sha256, key, version || null, description || null, user.id]);
    await logEvent({ site_id: null, entity: 'panel', entity_id: panel.id, entity_label: ENTITY_LABEL.panel(panel), kind: 'plik',
      summary: `Wgrano plik konfiguracji: ${filename}${version ? ` (wersja ${version})` : ''}`, comment: description, user });
    return { file, same };
  },
  async 'panels.fileUrl'({ id }) {
    const f = await one('SELECT * FROM panel_files WHERE id=$1', [id]);
    if (!f) throw new HttpError(404, 'Nie znaleziono pliku');
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: BUCKET, Key: f.s3_key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
    }), { expiresIn: 300 });
    return { url };
  },
  async 'panels.deleteFile'({ id }, user) {
    const f = await one('SELECT f.*, p.name, p.model FROM panel_files f JOIN panels p ON p.id=f.panel_id WHERE f.id=$1', [id]);
    if (!f) return { ok: true };
    need(user, f.uploaded_by === user.id ? 'configs.upload' : 'configs.delete');
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: f.s3_key }));
    await q('DELETE FROM panel_files WHERE id=$1', [id]);
    await logEvent({ site_id: null, entity: 'panel', entity_id: f.panel_id, entity_label: ENTITY_LABEL.panel(f), kind: 'plik',
      summary: `Usunięto plik konfiguracji: ${f.filename}${f.version ? ` (wersja ${f.version})` : ''}`, user });
    return { ok: true };
  },

  // --- inspections ---
  async 'inspections.list'({ from, to, status, technician_id }, user) {
    return q(`${INSPECTION_SELECT}
      WHERE ($1::date IS NULL OR COALESCE(i.performed_date, i.scheduled_date) >= $1)
        AND ($2::date IS NULL OR COALESCE(i.performed_date, i.scheduled_date) <= $2)
        AND ($3::text IS NULL OR i.status=$3)
        AND ($4::int IS NULL OR i.technician_id=$4)
        AND ($5::int IS NULL OR i.technician_id=$5)
      ORDER BY COALESCE(i.performed_date, i.scheduled_date)`, [from || null, to || null, status || null, technician_id || null, ownOnly(user)]);
  },
  async 'inspections.get'({ id }, user) {
    const inspection = await one(`${INSPECTION_SELECT} WHERE i.id=$1`, [id]);
    if (!inspection) throw new HttpError(404, 'Nie znaleziono przeglądu');
    needOwn(user, inspection.technician_id, 'ten przegląd');
    const site = await one(`${SITE_SELECT} WHERE s.id=$1`, [inspection.site_id]);
    const client = await one('SELECT * FROM clients WHERE id=$1', [site.client_id]);
    const devices = await q('SELECT * FROM devices WHERE site_id=$1 ORDER BY loop_no NULLS FIRST, address_no NULLS FIRST, type', [site.id]);
    return { inspection, site, client, devices };
  },
  async 'inspections.save'(p, user) {
    if (!p.site_id || !p.scheduled_date) throw new HttpError(400, 'Obiekt i data przeglądu są wymagane');
    const data = { ...p };
    if (ownOnly(user)) {
      // limited roles work only on their own inspections and cannot hand them to someone else
      if (p.id) needOwn(user, (await one('SELECT technician_id FROM inspections WHERE id=$1', [p.id]))?.technician_id, 'ten przegląd');
      data.technician_id = user.id;
    }
    if (!p.id && !p.checklist) data.checklist = DEFAULT_CHECKLIST;
    if (data.checklist) data.checklist = JSON.stringify(data.checklist);
    return save('inspections', INSPECTION_COLS, data);
  },
  // Mark as performed: update the site's last inspection and plan the next one.
  async 'inspections.complete'(p, user) {
    if (!p.performed_date || !p.result) throw new HttpError(400, 'Podaj datę wykonania i wynik przeglądu');
    const row = await actions['inspections.save']({ ...p, status: 'wykonany' }, user);
    const site = await one('SELECT * FROM sites WHERE id=$1', [row.site_id]);
    await q('UPDATE sites SET last_inspection=GREATEST(COALESCE(last_inspection, $1::date), $1::date) WHERE id=$2', [row.performed_date, site.id]);
    let next = await one(`SELECT * FROM inspections WHERE site_id=$1 AND status='zaplanowany' AND id<>$2 ORDER BY scheduled_date LIMIT 1`, [site.id, row.id]);
    if (!next && p.planNext !== false) {
      next = await one(`INSERT INTO inspections (site_id, type, scheduled_date, technician_id, checklist)
        VALUES ($1, 'przegląd okresowy', ($2::date + make_interval(months => $3))::date, $4, $5) RETURNING *`,
        [site.id, row.performed_date, site.inspection_interval_months, row.technician_id, JSON.stringify(DEFAULT_CHECKLIST)]);
    }
    return { inspection: row, next };
  },
  async 'inspections.delete'({ id }, user) {
    if (ownOnly(user)) needOwn(user, (await one('SELECT technician_id FROM inspections WHERE id=$1', [id]))?.technician_id, 'ten przegląd');
    await q('DELETE FROM inspections WHERE id=$1', [id]);
    return { ok: true };
  },

  // --- tickets ---
  async 'tickets.list'({ status, priority, search, assigned_to }, user) {
    return q(`${TICKET_SELECT}
      WHERE ($1::text IS NULL OR ($1='otwarte' AND t.status <> 'zakończone') OR t.status=$1)
        AND ($2::text IS NULL OR t.priority=$2)
        AND ($3::text IS NULL OR t.title ILIKE '%'||$3||'%' OR s.name ILIKE '%'||$3||'%' OR c.name ILIKE '%'||$3||'%')
        AND ($4::int IS NULL OR t.assigned_to=$4)
        AND ($5::int IS NULL OR t.assigned_to=$5)
      ORDER BY (t.status='zakończone'),
        CASE t.priority WHEN 'krytyczny' THEN 0 WHEN 'wysoki' THEN 1 WHEN 'normalny' THEN 2 ELSE 3 END,
        t.reported_at DESC
      LIMIT 500`, [status || null, priority || null, search || null, assigned_to || null, ownOnly(user)]);
  },
  async 'tickets.save'(p, user) {
    if (!p.site_id || !p.title?.trim()) throw new HttpError(400, 'Obiekt i tytuł zgłoszenia są wymagane');
    const before = p.id ? await one('SELECT * FROM tickets WHERE id=$1', [p.id]) : null;
    if (p.id && !before) throw new HttpError(404, 'Nie znaleziono zgłoszenia');
    need(user, before ? 'tickets.edit' : 'tickets.create');
    if (before) needOwn(user, before.assigned_to, 'to zgłoszenie');
    // a role limited to its own work would lose sight of an unassigned ticket it just created
    if (!before && ownOnly(user) && !p.assigned_to) p = { ...p, assigned_to: user.id };
    const saved = await save('tickets', TICKET_COLS, p);
    // keep resolved_at in sync with the status
    const row = await one(`UPDATE tickets SET resolved_at = CASE WHEN status='zakończone' THEN COALESCE(resolved_at, now()) ELSE NULL END
      WHERE id=$1 RETURNING *`, [saved.id]);
    await logChange('ticket', before, row, without(TICKET_COLS, 'site_id'), user);
    return row;
  },
  async 'tickets.delete'({ id }, user) {
    if (ownOnly(user)) needOwn(user, (await one('SELECT assigned_to FROM tickets WHERE id=$1', [id]))?.assigned_to, 'to zgłoszenie');
    const row = await one('DELETE FROM tickets WHERE id=$1 RETURNING *', [id]);
    if (row) await logEvent({ site_id: row.site_id, entity: 'ticket', entity_id: row.id, entity_label: ENTITY_LABEL.ticket(row), kind: 'usunięcie', summary: 'Usunięto zgłoszenie', user });
    return { ok: true };
  },

  // --- demo data ---
  async 'demo.seed'(_, user) {
    if (await one('SELECT 1 FROM clients WHERE demo LIMIT 1')) throw new HttpError(400, 'Dane demonstracyjne są już wczytane');
    await seedDemo({ q, one, user, checklist: DEFAULT_CHECKLIST });
    return { ok: true };
  },
  async 'demo.clear'(_, user) {
    await purgeClientPanels('SELECT id FROM clients WHERE demo', []);
    await purgePhotos('s.client_id IN (SELECT id FROM clients WHERE demo)', []);
    await q('DELETE FROM clients WHERE demo');
    return { ok: true };
  },
};

// Bootstrap the first administrator — works only while the users table is empty.
actions['setup.admin'] = async ({ email, name, password }) => {
  if (await one('SELECT 1 FROM users LIMIT 1')) throw new HttpError(400, 'Administrator już istnieje');
  return publicUser(await save('users', ['email', 'name', 'role', 'password_hash'],
    { email: email.toLowerCase(), name, role: 'admin', password_hash: hashPassword(password) }));
};

const PUBLIC = new Set(['auth.login', 'setup.admin']);

// Permission required by each action (any of the listed). Finer checks (own work, own files…) live in the actions.
const REQUIRES = {
  // clients.list also feeds the client picker in the site form
  'clients.list': ['clients.view', 'sites.edit'], 'clients.get': ['clients.view'], 'clients.save': ['clients.edit'], 'clients.delete': ['clients.delete'],
  // the site list also feeds the site pickers in ticket / inspection forms
  'sites.list': ['sites.view', 'tickets.view', 'inspections.view'],
  'sites.get': ['sites.view'], 'sites.save': ['sites.edit'], 'sites.delete': ['sites.delete'],
  'devices.save': ['devices.edit'], 'devices.delete': ['devices.delete'], 'devices.event': ['history.add'],
  'history.add': ['history.add'],
  'panels.get': ['panels.view'], 'panels.save': ['panels.edit'], 'panels.linkSite': ['panels.edit'], 'panels.unlinkSite': ['panels.edit'],
  'panels.delete': ['panels.delete'], 'panels.upload': ['configs.upload'], 'panels.fileUrl': ['configs.download'],
  'inspections.list': ['inspections.view'], 'inspections.get': ['inspections.view'], 'inspections.save': ['inspections.edit'],
  'inspections.complete': ['inspections.complete'], 'inspections.delete': ['inspections.delete'],
  'tickets.list': ['tickets.view'], 'tickets.save': ['tickets.create', 'tickets.edit'], 'tickets.delete': ['tickets.delete'],
  'demo.seed': ['demo.manage'], 'demo.clear': ['demo.manage'],
};

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body;
    const body = raw ? JSON.parse(raw) : {};
    const fn = actions[body.action];
    if (!fn) return json({ error: 'Nieznana akcja' }, 400);
    const user = PUBLIC.has(body.action) ? null : await currentUser(event);
    if (REQUIRES[body.action]) need(user, ...REQUIRES[body.action]);
    return json(await fn(body, user));
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    if (err.code === '23503') return json({ error: 'Powiązany rekord nie istnieje' }, 400);
    return json({ error: 'Błąd serwera: ' + err.message }, 500);
  }
}

/**
 * CRM SSP — API (action-based dispatch)
 *
 * POST { action, ...params } with `Authorization: Bearer <token>`.
 * Only `auth.login` works without a token.
 */
import pg from 'pg';
import crypto from 'node:crypto';
import { SCHEMA, DEFAULT_CHECKLIST } from './schema.mjs';
import { seedDemo } from './demo.mjs';

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
  if (!schemaReady) schemaReady = pool.query(SCHEMA).catch((e) => { schemaReady = null; throw e; });
  return pool;
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

async function currentUser(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || '';
  const payload = await verify(h.replace(/^Bearer\s+/i, ''));
  if (!payload) throw new HttpError(401, 'Sesja wygasła — zaloguj się ponownie');
  const user = await one('SELECT * FROM users WHERE id=$1 AND active', [payload.uid]);
  if (!user) throw new HttpError(401, 'Konto nieaktywne');
  return user;
}
function requireAdmin(user) {
  if (user.role !== 'admin') throw new HttpError(403, 'Wymagane uprawnienia administratora');
}

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

// ---------- actions ----------

const actions = {
  // --- auth ---
  async 'auth.login'({ email, password }) {
    const user = await one('SELECT * FROM users WHERE lower(email)=lower($1) AND active', [email || '']);
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
    return (await q('SELECT * FROM users ORDER BY active DESC, name')).map(publicUser);
  },
  async 'users.save'(p, user) {
    requireAdmin(user);
    const data = { id: p.id, email: p.email?.trim().toLowerCase(), name: p.name, phone: p.phone, role: p.role, active: p.active };
    if (p.password) {
      if (p.password.length < 8) throw new HttpError(400, 'Hasło musi mieć co najmniej 8 znaków');
      data.password_hash = hashPassword(p.password);
    } else if (!p.id) throw new HttpError(400, 'Podaj hasło dla nowego użytkownika');
    if (p.id === user.id && (p.role !== 'admin' || p.active === false)) throw new HttpError(400, 'Nie możesz odebrać sobie uprawnień administratora');
    try {
      return publicUser(await save('users', ['email', 'name', 'phone', 'role', 'active', 'password_hash'], data));
    } catch (e) {
      if (e.code === '23505') throw new HttpError(400, 'Użytkownik z tym adresem e-mail już istnieje');
      throw e;
    }
  },

  // --- dashboard ---
  async dashboard() {
    const [counts] = await q(`SELECT
      (SELECT count(*)::int FROM clients) AS clients,
      (SELECT count(*)::int FROM sites) AS sites,
      (SELECT count(*)::int FROM devices) AS devices,
      (SELECT count(*)::int FROM tickets WHERE status <> 'zakończone') AS open_tickets,
      (SELECT count(*)::int FROM tickets WHERE status <> 'zakończone' AND priority='krytyczny') AS critical_tickets,
      (SELECT count(*)::int FROM inspections WHERE status='wykonany' AND performed_date >= date_trunc('month', now())) AS done_this_month`);
    const sites = await q(`SELECT * FROM (${SITE_SELECT}) x WHERE next_due IS NOT NULL AND next_due <= current_date + 30 ORDER BY next_due LIMIT 50`);
    const noSchedule = await q(`SELECT * FROM (${SITE_SELECT}) x WHERE next_due IS NULL ORDER BY name LIMIT 20`);
    const tickets = await q(`${TICKET_SELECT} WHERE t.status <> 'zakończone'
      ORDER BY CASE t.priority WHEN 'krytyczny' THEN 0 WHEN 'wysoki' THEN 1 WHEN 'normalny' THEN 2 ELSE 3 END, t.reported_at LIMIT 12`);
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
    return { counts, sites, noSchedule, tickets, replacements, contracts, perMonth, demo };
  },

  // --- clients ---
  async 'clients.list'({ search }) {
    return q(`SELECT c.*, (SELECT count(*)::int FROM sites s WHERE s.client_id=c.id) AS site_count,
        (SELECT count(*)::int FROM tickets t JOIN sites s ON s.id=t.site_id WHERE s.client_id=c.id AND t.status <> 'zakończone') AS open_tickets
      FROM clients c
      WHERE $1::text IS NULL OR c.name ILIKE '%'||$1||'%' OR c.city ILIKE '%'||$1||'%' OR c.nip ILIKE '%'||$1||'%' OR c.contact_person ILIKE '%'||$1||'%'
      ORDER BY c.name`, [search || null]);
  },
  async 'clients.get'({ id }) {
    const client = await one('SELECT * FROM clients WHERE id=$1', [id]);
    if (!client) throw new HttpError(404, 'Nie znaleziono klienta');
    const sites = await q(`${SITE_SELECT} WHERE s.client_id=$1 ORDER BY s.name`, [id]);
    const tickets = await q(`${TICKET_SELECT} WHERE c.id=$1 ORDER BY t.reported_at DESC LIMIT 20`, [id]);
    return { client, sites, tickets };
  },
  async 'clients.save'(p) {
    if (!p.name?.trim()) throw new HttpError(400, 'Nazwa klienta jest wymagana');
    return save('clients', CLIENT_COLS, p);
  },
  async 'clients.delete'({ id }, user) {
    requireAdmin(user);
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
  async 'sites.get'({ id }) {
    const site = await one(`${SITE_SELECT} WHERE s.id=$1`, [id]);
    if (!site) throw new HttpError(404, 'Nie znaleziono obiektu');
    const devices = await q('SELECT * FROM devices WHERE site_id=$1 ORDER BY loop_no NULLS FIRST, address_no NULLS FIRST, type, id', [id]);
    const inspections = await q(`${INSPECTION_SELECT} WHERE i.site_id=$1 ORDER BY COALESCE(i.performed_date, i.scheduled_date) DESC`, [id]);
    const tickets = await q(`${TICKET_SELECT} WHERE t.site_id=$1 ORDER BY t.reported_at DESC`, [id]);
    return { site, devices, inspections, tickets };
  },
  async 'sites.save'(p) {
    if (!p.name?.trim() || !p.client_id) throw new HttpError(400, 'Nazwa obiektu i klient są wymagane');
    return save('sites', SITE_COLS, p);
  },
  async 'sites.delete'({ id }, user) {
    requireAdmin(user);
    await q('DELETE FROM sites WHERE id=$1', [id]);
    return { ok: true };
  },

  // --- devices ---
  async 'devices.save'(p) {
    if (!p.type || !p.site_id) throw new HttpError(400, 'Typ urządzenia jest wymagany');
    return save('devices', DEVICE_COLS, p);
  },
  async 'devices.delete'({ id }) {
    await q('DELETE FROM devices WHERE id=$1', [id]);
    return { ok: true };
  },

  // --- inspections ---
  async 'inspections.list'({ from, to, status, technician_id }) {
    return q(`${INSPECTION_SELECT}
      WHERE ($1::date IS NULL OR COALESCE(i.performed_date, i.scheduled_date) >= $1)
        AND ($2::date IS NULL OR COALESCE(i.performed_date, i.scheduled_date) <= $2)
        AND ($3::text IS NULL OR i.status=$3)
        AND ($4::int IS NULL OR i.technician_id=$4)
      ORDER BY COALESCE(i.performed_date, i.scheduled_date)`, [from || null, to || null, status || null, technician_id || null]);
  },
  async 'inspections.get'({ id }) {
    const inspection = await one(`${INSPECTION_SELECT} WHERE i.id=$1`, [id]);
    if (!inspection) throw new HttpError(404, 'Nie znaleziono przeglądu');
    const site = await one(`${SITE_SELECT} WHERE s.id=$1`, [inspection.site_id]);
    const client = await one('SELECT * FROM clients WHERE id=$1', [site.client_id]);
    const devices = await q('SELECT * FROM devices WHERE site_id=$1 ORDER BY loop_no NULLS FIRST, address_no NULLS FIRST, type', [site.id]);
    return { inspection, site, client, devices };
  },
  async 'inspections.save'(p) {
    if (!p.site_id || !p.scheduled_date) throw new HttpError(400, 'Obiekt i data przeglądu są wymagane');
    const data = { ...p };
    if (!p.id && !p.checklist) data.checklist = DEFAULT_CHECKLIST;
    if (data.checklist) data.checklist = JSON.stringify(data.checklist);
    return save('inspections', INSPECTION_COLS, data);
  },
  // Mark as performed: update the site's last inspection and plan the next one.
  async 'inspections.complete'(p) {
    if (!p.performed_date || !p.result) throw new HttpError(400, 'Podaj datę wykonania i wynik przeglądu');
    const row = await actions['inspections.save']({ ...p, status: 'wykonany' });
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
  async 'inspections.delete'({ id }) {
    await q('DELETE FROM inspections WHERE id=$1', [id]);
    return { ok: true };
  },

  // --- tickets ---
  async 'tickets.list'({ status, priority, search, assigned_to }) {
    return q(`${TICKET_SELECT}
      WHERE ($1::text IS NULL OR ($1='otwarte' AND t.status <> 'zakończone') OR t.status=$1)
        AND ($2::text IS NULL OR t.priority=$2)
        AND ($3::text IS NULL OR t.title ILIKE '%'||$3||'%' OR s.name ILIKE '%'||$3||'%' OR c.name ILIKE '%'||$3||'%')
        AND ($4::int IS NULL OR t.assigned_to=$4)
      ORDER BY (t.status='zakończone'),
        CASE t.priority WHEN 'krytyczny' THEN 0 WHEN 'wysoki' THEN 1 WHEN 'normalny' THEN 2 ELSE 3 END,
        t.reported_at DESC
      LIMIT 500`, [status || null, priority || null, search || null, assigned_to || null]);
  },
  async 'tickets.save'(p) {
    if (!p.site_id || !p.title?.trim()) throw new HttpError(400, 'Obiekt i tytuł zgłoszenia są wymagane');
    const row = await save('tickets', TICKET_COLS, p);
    // keep resolved_at in sync with the status
    return one(`UPDATE tickets SET resolved_at = CASE WHEN status='zakończone' THEN COALESCE(resolved_at, now()) ELSE NULL END
      WHERE id=$1 RETURNING *`, [row.id]);
  },
  async 'tickets.delete'({ id }) {
    await q('DELETE FROM tickets WHERE id=$1', [id]);
    return { ok: true };
  },

  // --- demo data ---
  async 'demo.seed'(_, user) {
    requireAdmin(user);
    if (await one('SELECT 1 FROM clients WHERE demo LIMIT 1')) throw new HttpError(400, 'Dane demonstracyjne są już wczytane');
    await seedDemo({ q, one, user, checklist: DEFAULT_CHECKLIST });
    return { ok: true };
  },
  async 'demo.clear'(_, user) {
    requireAdmin(user);
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

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'POST';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body;
    const body = raw ? JSON.parse(raw) : {};
    const fn = actions[body.action];
    if (!fn) return json({ error: 'Nieznana akcja' }, 400);
    const user = PUBLIC.has(body.action) ? null : await currentUser(event);
    return json(await fn(body, user));
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    if (err.code === '23503') return json({ error: 'Powiązany rekord nie istnieje' }, 400);
    return json({ error: 'Błąd serwera: ' + err.message }, 500);
  }
}

// Import of system elements from a control panel configuration file.
// Supported: POLON 4900 configuration (.ctr, binary) and CSV / TXT element lists exported by panel software.
// Every parser returns { format, rows: [{ loop_no, address_no, code, type, serial, zone, location, notes }], codes }.

// ---------- POLON 4900 (.ctr) ----------
// Layout reverse-engineered from POLON4900 v4.0 files:
//   header "POLON4900vX.Y", then 12-byte element records: 0x0B, loop, address, 8 data bytes, zone
//   data[0] = element kind, data[3..5] = serial (BCD); all zero = address not used
//   then 1024 zone records of 70 bytes: 0x45, 0x00, zone, kind, element count, 0x00, description 2×32 chars (CP852)
const CP852 = { 0xA4: 'Ą', 0xA5: 'ą', 0x8F: 'Ć', 0x86: 'ć', 0xA8: 'Ę', 0xA9: 'ę', 0x9D: 'Ł', 0x88: 'ł', 0xE3: 'Ń', 0xE4: 'ń',
  0xE0: 'Ó', 0xA2: 'ó', 0x97: 'Ś', 0x98: 'ś', 0x8D: 'Ź', 0xAB: 'ź', 0xBD: 'Ż', 0xBE: 'ż' };
const cp852 = (buf) => [...buf].map((c) => (c >= 32 && c < 127 ? String.fromCharCode(c) : CP852[c] || ' ')).join('').replace(/\s+/g, ' ').trim();
const bcd = (bytes) => bytes.map((x) => x.toString(16).padStart(2, '0')).join('');

// Element kinds seen in POLON 4900 files; the user confirms or corrects the mapping before importing.
const POLON_KINDS = {
  0x30: { type: 'ROP', label: 'ROP — ręczny ostrzegacz pożarowy' },
  0x02: { type: 'Czujka dymu optyczna', label: 'czujka (prawdopodobnie optyczna dymu)' },
  0x03: { type: 'Czujka ciepła', label: 'czujka (prawdopodobnie ciepła)' },
  0x50: { type: 'Moduł wejść/wyjść', label: 'moduł wejść/wyjść EKS', module: true },
  0x40: { type: 'Moduł wejść/wyjść', label: 'moduł (rodzaj nieznany)', module: true },
};
const hex = (n) => `0x${n.toString(16).padStart(2, '0').toUpperCase()}`;

function parsePolon4900(buf) {
  const head = buf.subarray(0, 13).toString('latin1');
  let o = 13;
  const els = [];
  while (o + 12 <= buf.length && buf[o] === 0x0b && buf[o + 1] >= 1 && buf[o + 1] <= 32) {
    const data = [...buf.subarray(o + 3, o + 11)];
    if (data.some((x) => x)) els.push({ loop: buf[o + 1], addr: buf[o + 2], data, z: buf[o + 11] });
    o += 12;
  }
  const zones = {};
  for (let i = 0; o + 70 <= buf.length && buf[o] === 0x45 && i < 4096; i++, o += 70) {
    zones[buf[o + 2] | (buf[o + 1] << 8)] = cp852(buf.subarray(o + 6, o + 70));
  }
  const codes = {};
  const rows = els.map((e) => {
    const kind = POLON_KINDS[e.data[0]];
    const code = hex(e.data[0]);
    codes[code] ||= { code, label: kind?.label || 'nieznany rodzaj elementu', type: kind?.type || 'Inne', count: 0 };
    codes[code].count++;
    // for modules the last byte is the module number, for detectors and call points the zone
    const zoneName = !kind?.module && zones[e.z];
    return {
      loop_no: e.loop, address_no: e.addr, code, serial: bcd(e.data.slice(3, 6)).replace(/^0+(?=\d)/, ''),
      zone: kind?.module ? null : e.z,
      location: zoneName || (kind?.module ? `${e.data[0] === 0x50 ? 'EKS' : 'Moduł'} nr ${e.z}` : ''),
      notes: kind?.module ? `Moduł nr ${e.z} (import z konfiguracji)` : `Strefa ${e.z} (import z konfiguracji)`,
    };
  });
  return { format: head.replace('v', ' v'), manufacturer: 'Polon-Alfa', rows, codes: Object.values(codes) };
}

// ---------- CSV / TXT element lists ----------
const COLUMNS = {
  loop_no: ['pętla', 'petla', 'linia', 'loop', 'line', 'pętla/linia'],
  address_no: ['adres', 'adr', 'address', 'addr', 'nr elementu', 'element nr'],
  type: ['typ', 'rodzaj', 'type', 'typ elementu', 'device type'],
  model: ['model', 'symbol', 'oznaczenie'],
  location: ['lokalizacja', 'opis', 'nazwa', 'location', 'description', 'text', 'tekst', 'komunikat'],
  serial: ['nr seryjny', 'numer seryjny', 'serial', 'sn', 's/n', 'nr fabryczny'],
  zone: ['strefa', 'zone', 'grupa', 'group'],
};
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż/ ]/g, '').trim();

function decodeText(buf) {
  const utf = buf.toString('utf8');
  if (!utf.includes('�')) return utf.replace(/^﻿/, '');
  try { return new TextDecoder('windows-1250').decode(buf); } catch { return buf.toString('latin1'); }
}

function splitLine(line, sep) {
  const out = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(buf) {
  const lines = decodeText(buf).split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const sep = [';', '\t', ','].map((s) => [s, lines[0].split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const header = splitLine(lines[0], sep).map(norm);
  const map = {};
  for (const [field, names] of Object.entries(COLUMNS)) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) map[field] = i;
  }
  if (map.address_no === undefined || (map.type === undefined && map.location === undefined)) return null;
  const codes = {};
  const rows = lines.slice(1).map((l) => splitLine(l, sep)).map((c) => {
    const get = (f) => (map[f] === undefined ? '' : c[map[f]] || '');
    const code = get('type') || '—';
    codes[code] ||= { code, label: code, type: guessType(code), count: 0 };
    codes[code].count++;
    const zone = get('zone');
    return {
      loop_no: Number.parseInt(get('loop_no'), 10) || null, address_no: Number.parseInt(get('address_no'), 10) || null,
      code, model: get('model') || null, serial: get('serial') || null, zone: zone || null, location: get('location'),
      notes: zone ? `Strefa ${zone} (import z pliku)` : null,
    };
  }).filter((r) => r.address_no);
  return { format: `Lista elementów (${sep === '\t' ? 'TXT' : 'CSV'})`, rows, codes: Object.values(codes), columns: Object.keys(map) };
}

// Map a type name from an export onto the app's element types.
function guessType(s) {
  const t = norm(s);
  if (/rop|ręczn|reczn|call|mcp|przycisk/.test(t)) return 'ROP';
  if (/wielo|multi|dur|combined/.test(t)) return 'Czujka wielosensorowa';
  if (/ciep|temp|heat|dtj|dcd|termi/.test(t)) return 'Czujka ciepła';
  if (/płom|plom|flame|dpl/.test(t)) return 'Czujka płomienia';
  if (/linio|beam|dlo/.test(t)) return 'Czujka liniowa';
  if (/zasys|asd|aspir/.test(t)) return 'Czujka zasysająca (ASD)';
  if (/dym|opty|smoke|dor|czujk|detector/.test(t)) return 'Czujka dymu optyczna';
  if (/optyczno|flash|lamp|beacon|sao|sygn.*opt/.test(t)) return 'Sygnalizator akustyczno-optyczny';
  if (/sygn|sounder|sir|syren|sal/.test(t)) return 'Sygnalizator akustyczny';
  if (/izol|isol/.test(t)) return 'Izolator zwarć';
  if (/modu|eks|we\/wy|wej|wyj|input|output|i\/o|ewm|ews/.test(t)) return 'Moduł wejść/wyjść';
  return 'Inne';
}

export function parseConfigFile(buf, filename = '') {
  if (buf.subarray(0, 9).toString('latin1') === 'POLON4900') return parsePolon4900(buf);
  const csv = /\.(csv|txt|tsv)$/i.test(filename) || !buf.subarray(0, 512).includes(0) ? parseCsv(buf) : null;
  if (csv) return csv;
  throw new Error('Nie rozpoznano formatu pliku. Obsługiwane: konfiguracja POLON 4900 (.ctr) oraz lista elementów CSV/TXT '
    + 'z kolumnami co najmniej „adres” i „typ” lub „opis” (opcjonalnie: pętla, model, nr seryjny, strefa).');
}

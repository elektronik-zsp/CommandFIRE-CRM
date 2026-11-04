// Company data and document numbering — defaults and pattern formatting (stored in app_settings).

export const COMPANY_FIELDS = {
  name: 'Nazwa firmy', address: 'Adres', city: 'Kod i miejscowość', nip: 'NIP', regon: 'REGON',
  phone: 'Telefon', email: 'E-mail', website: 'Strona www', certificates: 'Uprawnienia / certyfikaty', footer: 'Stopka protokołów',
};

// Numbered document kinds. {NR} is required; the counter restarts per year / month or never.
export const DOC_KINDS = {
  inspection: { label: 'Protokół przeglądu', pattern: 'PR/{RRRR}/{NR}' },
  service: { label: 'Protokół serwisowy (zgłoszenia)', pattern: 'PS/{RRRR}/{NR}' },
};
export const RESETS = { year: 'co rok', month: 'co miesiąc', never: 'ciągła' };

export const defaultNumbering = () => Object.fromEntries(Object.entries(DOC_KINDS)
  .map(([k, d]) => [k, { pattern: d.pattern, digits: 4, reset: 'year' }]));

export function counterPeriod(reset, date) {
  if (reset === 'month') return date.slice(0, 7);
  if (reset === 'never') return '-';
  return date.slice(0, 4);
}

export function formatNumber({ pattern, digits }, n, date) {
  return pattern
    .replaceAll('{RRRR}', date.slice(0, 4)).replaceAll('{RR}', date.slice(2, 4))
    .replaceAll('{MM}', date.slice(5, 7)).replaceAll('{DD}', date.slice(8, 10))
    .replaceAll('{NR}', String(n).padStart(digits || 1, '0'));
}

export function checkNumbering(cfg) {
  if (!cfg?.pattern?.includes('{NR}')) throw new Error('Wzorzec numeru musi zawierać {NR} — kolejny numer dokumentu');
  if (cfg.pattern.length > 60) throw new Error('Wzorzec numeru jest za długi');
  if (!RESETS[cfg.reset]) throw new Error('Nieprawidłowy sposób numeracji');
  const d = Number(cfg.digits);
  if (!(d >= 1 && d <= 8)) throw new Error('Liczba cyfr numeru: od 1 do 8');
}

// Element dictionary: Polon-Alfa element code = first two characters of the serial number.
// Seeded once (when the table is empty); edited in Ustawienia → Słownik elementów.
const D = (code, model, type) => ({ manufacturer: 'Polon-Alfa', code, model, type });
export const DEFAULT_DEVICE_CODES = [
  D('01', 'DIO-4046', 'Czujka dymu jonizacyjna'),
  D('02', 'DOR-4046', 'Czujka dymu optyczna'),
  D('03', 'TUN-4046', 'Czujka ciepła'),
  D('13', 'TUN-6046', 'Czujka ciepła'),
  D('06', 'DUR-4046', 'Czujka wielosensorowa'),
  D('16', 'DUR-4047', 'Czujka wielosensorowa'),
  D('07', 'DPR-4046', 'Czujka płomienia'),
  D('04', 'DOT-4046', 'Czujka wielosensorowa'),
  D('0C', 'DOT-6046', 'Czujka wielosensorowa'),
  D('05', 'ADC-4001', 'Moduł wejść/wyjść'),
  D('10', 'ACR-4001', 'Moduł wejść/wyjść'),
  D('30', 'ROP-4001', 'ROP'),
  D('36', 'ROP-4007', 'ROP'),
  D('40', 'EKS-4001', 'Moduł wejść/wyjść'),
  D('41', 'EWS-4001', 'Moduł wejść/wyjść'),
  D('42', 'EWK-4001', 'Moduł wejść/wyjść'),
  D('50', 'SAL-4001', 'Sygnalizator akustyczny'),
  D('51', 'SAW-6001', 'Sygnalizator akustyczny'),
  D('52', 'SAW-6006', 'Sygnalizator akustyczny'),
  D('53', 'SAB-6001', 'Sygnalizator akustyczno-optyczny'),
  D('54', 'SAB-6006', 'Sygnalizator akustyczno-optyczny'),
  D('60', 'UCS-4000', 'Moduł wejść/wyjść'),
  D('61', 'UCS-6000', 'Moduł wejść/wyjść'),
  D('08', 'DUT-6046', 'Czujka wielosensorowa'),
  D('18', 'DUT-6046AD', 'Czujka wielosensorowa'),
  D('09', 'DOP-6001', 'Czujka płomienia'),
  D('14', 'DTC-6046', 'Czujka ciepła'),
  D('11', 'DUO-6044', 'Czujka wielosensorowa'),
  D('12', 'DUO-6046AD', 'Czujka wielosensorowa'),
  D('67', 'PZB-6000', 'Inne'),
];

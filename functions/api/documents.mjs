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

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  const t = new Date(todayISO() + 'T00:00:00');
  return Math.round((d - t) / 86400000);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relDays(n) {
  if (n == null) return '';
  if (n === 0) return 'dziś';
  if (n === 1) return 'jutro';
  if (n === -1) return 'wczoraj';
  return n > 0 ? `za ${n} dni` : `${-n} dni po terminie`;
}

// Due-date tone: overdue / within 14 days / later
export function dueTone(n) {
  if (n == null) return 'muted';
  if (n < 0) return 'danger';
  if (n <= 14) return 'warn';
  return 'ok';
}

export const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

// ---- dictionaries ----
export const DEVICE_TYPES = ['Centrala', 'Czujka dymu optyczna', 'Czujka ciepła', 'Czujka wielosensorowa', 'Czujka liniowa', 'Czujka płomienia',
  'Czujka zasysająca (ASD)', 'ROP', 'Sygnalizator akustyczny', 'Sygnalizator akustyczno-optyczny', 'Moduł wejść/wyjść', 'Izolator zwarć',
  'Zasilacz', 'Akumulator', 'Urządzenie transmisji alarmu (UTA)', 'Panel wyniesiony', 'DSO — centrala', 'Głośnik DSO', 'Inne'];
export const DEVICE_STATUSES = ['sprawne', 'do obserwacji', 'uszkodzone', 'wycofane'];
export const SYSTEM_TYPES = ['adresowy', 'konwencjonalny', 'adresowo-konwencjonalny', 'bezprzewodowy'];
export const PANEL_MANUFACTURERS = ['Polon-Alfa', 'Schrack Seconet', 'Bosch', 'Esser (Honeywell)', 'Siemens', 'Ajax', 'Hochiki', 'Notifier', 'Aritech', 'Inny'];
export const INSPECTION_TYPES = ['przegląd okresowy', 'konserwacja', 'odbiór techniczny', 'przegląd po awarii'];
export const INSPECTION_STATUSES = ['zaplanowany', 'wykonany', 'odwołany'];
export const INSPECTION_RESULTS = ['pozytywny', 'pozytywny z uwagami', 'negatywny'];
export const TICKET_CATEGORIES = ['awaria', 'alarm fałszywy', 'uszkodzenie', 'konserwacja', 'modernizacja', 'inne'];
export const TICKET_PRIORITIES = ['krytyczny', 'wysoki', 'normalny', 'niski'];
export const TICKET_STATUSES = ['nowe', 'w realizacji', 'oczekuje', 'zakończone'];

export const TONES = {
  krytyczny: 'danger', wysoki: 'warn', normalny: 'info', niski: 'muted',
  nowe: 'danger', 'w realizacji': 'warn', oczekuje: 'muted', 'zakończone': 'ok',
  zaplanowany: 'info', wykonany: 'ok', odwołany: 'muted',
  pozytywny: 'ok', 'pozytywny z uwagami': 'warn', negatywny: 'danger',
  sprawne: 'ok', 'do obserwacji': 'warn', uszkodzone: 'danger', wycofane: 'muted',
  admin: 'danger', technik: 'info',
};

// ---- history ----
export const DEVICE_EVENT_KINDS = [
  { value: 'test', label: 'Test / pomiar' },
  { value: 'konserwacja', label: 'Konserwacja' },
  { value: 'usterka', label: 'Usterka (oznacz jako uszkodzone)' },
  { value: 'naprawa', label: 'Naprawa (oznacz jako sprawne)' },
  { value: 'wymiana', label: 'Wymiana elementu' },
  { value: 'notatka', label: 'Notatka' },
];
export const PANEL_EVENT_KINDS = ['serwis', 'zmiana konfiguracji', 'aktualizacja oprogramowania', 'usterka', 'naprawa', 'notatka'];
export const AUTO_KINDS = ['utworzenie', 'zmiana', 'status', 'usunięcie', 'plik', 'protokół', 'import'];
export const SYSTEM_STATES = ['sprawny', 'sprawny z uwagami', 'niesprawny — wymaga dalszych prac'];

export function fmtSize(b) {
  if (b == null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(b / 1024 / 1024).toFixed(2).replace('.', ',')} MB`;
}

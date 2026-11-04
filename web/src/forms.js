import {
  DEVICE_TYPES, DEVICE_STATUSES, SYSTEM_TYPES, PANEL_MANUFACTURERS, INSPECTION_TYPES,
  TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES,
} from './format';

const opts = (rows, label = (r) => r.name) => (rows || []).map((r) => ({ value: String(r.id), label: label(r) }));
const techOpts = (users) => opts((users || []).filter((u) => u.active));

export const clientFields = [
  { name: 'name', label: 'Nazwa klienta', required: true, span: 2 },
  { name: 'nip', label: 'NIP' },
  { name: 'city', label: 'Miejscowość' },
  { name: 'address', label: 'Adres', span: 2 },
  { section: 'Osoba kontaktowa' },
  { name: 'contact_person', label: 'Imię i nazwisko', span: 2 },
  { name: 'phone', label: 'Telefon', type: 'tel' },
  { name: 'email', label: 'E-mail', type: 'email' },
  { name: 'notes', label: 'Notatki', type: 'textarea', span: 2 },
];

export const siteFields = (clients) => [
  { name: 'client_id', label: 'Klient', type: 'select', options: opts(clients), required: true, span: 2 },
  { name: 'name', label: 'Nazwa obiektu', required: true, span: 2, placeholder: 'np. Budynek A — biurowiec' },
  { name: 'address', label: 'Adres' },
  { name: 'city', label: 'Miejscowość' },
  { name: 'building_type', label: 'Rodzaj / kategoria obiektu', list: ['Biurowy (ZL III)', 'Handlowo-usługowy', 'Szpital (ZL II)', 'Hotel (ZL V)', 'Szkoła', 'Magazyn (PM)', 'Produkcyjny (PM)', 'Garaż podziemny', 'Mieszkalny wielorodzinny'] },
  { name: 'on_site_contact', label: 'Kontakt na obiekcie', placeholder: 'np. ochrona / konserwator' },
  { name: 'on_site_phone', label: 'Telefon na obiekcie', type: 'tel' },
  { section: 'System sygnalizacji pożaru' },
  { name: 'panel_manufacturer', label: 'Producent centrali', list: PANEL_MANUFACTURERS },
  { name: 'panel_model', label: 'Model centrali', placeholder: 'np. POLON 6000' },
  { name: 'system_type', label: 'Typ systemu', type: 'select', options: SYSTEM_TYPES },
  { name: 'loops', label: 'Liczba pętli / linii', type: 'number' },
  { name: 'monitoring', label: 'Monitoring do PSP', type: 'checkbox', checkLabel: 'Obiekt monitorowany' },
  { name: 'monitoring_operator', label: 'Operator monitoringu' },
  { section: 'Umowa i przeglądy' },
  { name: 'contract_number', label: 'Nr umowy serwisowej' },
  { name: 'contract_end', label: 'Umowa ważna do', type: 'date' },
  { name: 'inspection_interval_months', label: 'Częstotliwość przeglądów', type: 'select', required: true,
    options: [{ value: '1', label: 'co miesiąc' }, { value: '3', label: 'co kwartał' }, { value: '6', label: 'co pół roku' }, { value: '12', label: 'raz w roku' }],
    hint: 'Przepisy wymagają przeglądu SSP co najmniej raz w roku.' },
  { name: 'last_inspection', label: 'Ostatni przegląd', type: 'date', hint: 'Uzupełniane automatycznie po zamknięciu przeglądu.' },
  { name: 'notes', label: 'Notatki', type: 'textarea', span: 2 },
];

export const deviceFields = [
  { name: 'type', label: 'Typ elementu', required: true, list: DEVICE_TYPES, span: 2 },
  { name: 'manufacturer', label: 'Producent' },
  { name: 'model', label: 'Model' },
  { name: 'serial', label: 'Nr seryjny' },
  { name: 'quantity', label: 'Ilość', type: 'number' },
  { name: 'loop_no', label: 'Pętla / linia', type: 'number' },
  { name: 'address_no', label: 'Adres', type: 'number' },
  { name: 'location', label: 'Lokalizacja', span: 2, placeholder: 'np. Korytarz 1p, przy windzie' },
  { name: 'installed_at', label: 'Data montażu', type: 'date' },
  { name: 'replace_by', label: 'Wymiana do', type: 'date', hint: 'np. akumulatory, czujki po okresie eksploatacji' },
  { name: 'status', label: 'Stan', type: 'select', options: DEVICE_STATUSES, required: true },
  { name: 'notes', label: 'Uwagi', type: 'textarea', span: 2 },
];

export const panelFields = [
  { name: 'name', label: 'Nazwa', required: true, placeholder: 'np. Centrala główna / Podcentrala B' },
  { name: 'location', label: 'Lokalizacja', placeholder: 'np. Pomieszczenie ochrony, parter' },
  { name: 'manufacturer', label: 'Producent', list: PANEL_MANUFACTURERS },
  { name: 'model', label: 'Model' },
  { name: 'serial', label: 'Nr seryjny' },
  { name: 'installed_at', label: 'Data uruchomienia', type: 'date' },
  { name: 'installer', label: 'Instalator / uruchamiający', span: 2 },
  { section: 'Konfiguracja' },
  { name: 'firmware', label: 'Wersja oprogramowania (firmware)' },
  { name: 'software_tool', label: 'Program serwisowy', placeholder: 'np. POLON-SERWIS 6000' },
  { name: 'loops', label: 'Liczba pętli', type: 'number' },
  { name: 'zones', label: 'Liczba stref', type: 'number' },
  { name: 'network_address', label: 'Adres sieciowy / IP', placeholder: 'np. 192.168.10.21' },
  { name: 'transmission', label: 'Transmisja / UTA', placeholder: 'np. UTA → KM PSP' },
  { section: 'Zasilanie' },
  { name: 'power_supply', label: 'Zasilacz' },
  { name: 'batteries', label: 'Akumulatory', placeholder: 'np. 2 × 12 V 17 Ah' },
  { section: 'Serwis' },
  { name: 'service_access', label: 'Dostęp serwisowy', type: 'textarea', span: 2, rows: 2,
    hint: 'Gdzie są klucze, kto wydaje kody dostępu. Nie zapisuj tu haseł.' },
  { name: 'notes', label: 'Uwagi', type: 'textarea', span: 2 },
];

export const scheduleFields = (sites, users) => [
  { name: 'site_id', label: 'Obiekt', type: 'select', options: opts(sites, (s) => `${s.name} — ${s.client_name}`), required: true, span: 2 },
  { name: 'type', label: 'Rodzaj', type: 'select', options: INSPECTION_TYPES, required: true },
  { name: 'scheduled_date', label: 'Planowana data', type: 'date', required: true },
  { name: 'technician_id', label: 'Technik', type: 'select', options: techOpts(users), span: 2 },
];

export const ticketFields = (sites, users) => [
  { name: 'site_id', label: 'Obiekt', type: 'select', options: opts(sites, (s) => `${s.name} — ${s.client_name}`), required: true, span: 2 },
  { name: 'title', label: 'Tytuł zgłoszenia', required: true, span: 2 },
  { name: 'category', label: 'Kategoria', type: 'select', options: TICKET_CATEGORIES, required: true },
  { name: 'priority', label: 'Priorytet', type: 'select', options: TICKET_PRIORITIES, required: true },
  { name: 'reported_by', label: 'Zgłaszający' },
  { name: 'due_date', label: 'Termin realizacji', type: 'date' },
  { name: 'description', label: 'Opis', type: 'textarea', span: 2 },
  { section: 'Realizacja' },
  { name: 'status', label: 'Status', type: 'select', options: TICKET_STATUSES, required: true },
  { name: 'assigned_to', label: 'Przypisany technik', type: 'select', options: techOpts(users) },
  { name: 'resolution', label: 'Sposób usunięcia / wykonane prace', type: 'textarea', span: 2 },
];

export const userFields = (isNew) => [
  { name: 'name', label: 'Imię i nazwisko', required: true, span: 2 },
  { name: 'email', label: 'E-mail (login)', type: 'email', required: true },
  { name: 'phone', label: 'Telefon', type: 'tel' },
  { name: 'role', label: 'Rola', type: 'select', required: true, options: [{ value: 'technik', label: 'Technik' }, { value: 'admin', label: 'Administrator' }] },
  { name: 'active', label: 'Konto', type: 'checkbox', checkLabel: 'Aktywne' },
  { name: 'password', label: isNew ? 'Hasło' : 'Nowe hasło', type: 'password', required: isNew, span: 2, hint: isNew ? 'Min. 8 znaków' : 'Zostaw puste, aby nie zmieniać' },
];

// Convert numeric-ish select values back before sending
export function clean(v) {
  const out = { ...v };
  for (const k of ['client_id', 'site_id', 'technician_id', 'assigned_to', 'inspection_interval_months', 'loops', 'zones', 'loop_no', 'address_no', 'quantity']) {
    if (out[k] === '') out[k] = null;
    else if (out[k] != null) out[k] = Number(out[k]);
  }
  return out;
}
// Prepare a DB row for a form (ids → strings for selects)
export function toForm(row = {}) {
  const out = { ...row };
  for (const k of ['client_id', 'site_id', 'technician_id', 'assigned_to', 'inspection_interval_months']) if (out[k] != null) out[k] = String(out[k]);
  return out;
}

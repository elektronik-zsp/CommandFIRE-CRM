// Permission catalog (shown as the role matrix in the app) and the default roles.
// `restrict` marks a permission that narrows access instead of granting it.
export const PERMISSION_GROUPS = [
  { group: 'Klienci', items: [
    { key: 'clients.view', label: 'Podgląd klientów' },
    { key: 'clients.edit', label: 'Dodawanie i edycja klientów' },
    { key: 'clients.delete', label: 'Usuwanie klientów' },
  ] },
  { group: 'Obiekty i elementy', items: [
    { key: 'sites.view', label: 'Podgląd obiektów i elementów systemu' },
    { key: 'sites.edit', label: 'Dodawanie i edycja obiektów' },
    { key: 'sites.delete', label: 'Usuwanie obiektów' },
    { key: 'devices.edit', label: 'Dodawanie i edycja elementów' },
    { key: 'devices.delete', label: 'Usuwanie elementów' },
  ] },
  { group: 'Centrale', items: [
    { key: 'panels.view', label: 'Podgląd kart central' },
    { key: 'panels.edit', label: 'Edycja kart central i przypisywanie obiektów' },
    { key: 'panels.delete', label: 'Usuwanie kart central' },
    { key: 'panels.access', label: 'Widok i edycja pola „Dostęp serwisowy”' },
    { key: 'configs.download', label: 'Pobieranie plików konfiguracji' },
    { key: 'configs.upload', label: 'Wgrywanie plików konfiguracji' },
    { key: 'configs.delete', label: 'Usuwanie plików konfiguracji innych osób' },
  ] },
  { group: 'Przeglądy', items: [
    { key: 'inspections.view', label: 'Podgląd przeglądów i protokołów' },
    { key: 'inspections.edit', label: 'Planowanie przeglądów i wypełnianie protokołu' },
    { key: 'inspections.complete', label: 'Zamykanie przeglądu (wynik, nr protokołu)' },
    { key: 'inspections.delete', label: 'Usuwanie przeglądów' },
  ] },
  { group: 'Zgłoszenia serwisowe', items: [
    { key: 'tickets.view', label: 'Podgląd zgłoszeń' },
    { key: 'tickets.create', label: 'Rejestrowanie zgłoszeń' },
    { key: 'tickets.edit', label: 'Edycja, przypisywanie i zmiana statusu' },
    { key: 'tickets.delete', label: 'Usuwanie zgłoszeń' },
  ] },
  { group: 'Historia', items: [
    { key: 'history.add', label: 'Wpisy serwisowe, komentarze i zdjęcia' },
    { key: 'history.delete', label: 'Usuwanie wpisów innych osób' },
  ] },
  { group: 'Ograniczenia', items: [
    { key: 'scope.own', label: 'Widzi tylko przypisane do siebie zgłoszenia i przeglądy', restrict: true },
  ] },
  { group: 'Administracja', items: [
    { key: 'users.manage', label: 'Zarządzanie kontami zespołu (bez kont administratorów)' },
    { key: 'settings.manage', label: 'Ustawienia: dane firmy i numeracja dokumentów' },
    { key: 'demo.manage', label: 'Wczytywanie i usuwanie danych demonstracyjnych' },
  ] },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
const GRANTS = ALL_PERMISSIONS.filter((k) => k !== 'scope.own');
const VIEW = ['clients.view', 'sites.view', 'panels.view', 'inspections.view', 'tickets.view'];

// Seeded once, when the roles table is empty. `admin` always has every grant and cannot be edited.
export const DEFAULT_ROLES = [
  { key: 'admin', name: 'Administrator', system: true, sort: 0, description: 'Pełny dostęp, zarządzanie rolami i uprawnieniami.', permissions: GRANTS },
  { key: 'kierownik', name: 'Kierownik serwisu', sort: 1, description: 'Prowadzi serwis: wszystko poza danymi demo.',
    permissions: GRANTS.filter((k) => k !== 'demo.manage') },
  { key: 'technik', name: 'Technik', sort: 2, description: 'Wykonuje przeglądy i obsługuje zgłoszenia w terenie.',
    permissions: [...VIEW, 'clients.edit', 'sites.edit', 'devices.edit', 'devices.delete', 'panels.edit', 'panels.access',
      'configs.download', 'configs.upload', 'inspections.edit', 'inspections.complete', 'inspections.delete',
      'tickets.create', 'tickets.edit', 'history.add'] },
  { key: 'biuro', name: 'Biuro / dyspozytor', sort: 3, description: 'Przyjmuje zgłoszenia, planuje przeglądy, prowadzi dane klientów.',
    permissions: [...VIEW, 'clients.edit', 'sites.edit', 'inspections.edit', 'tickets.create', 'tickets.edit', 'history.add'] },
  { key: 'podglad', name: 'Podgląd', sort: 4, description: 'Tylko odczyt — bez danych dostępowych i plików konfiguracji.', permissions: VIEW },
];

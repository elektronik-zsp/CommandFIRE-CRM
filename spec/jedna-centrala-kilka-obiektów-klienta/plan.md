# Jedna centrala → kilka obiektów klienta

## Kontekst
Dziś karta centrali należy do jednego obiektu (`panels.site_id`). W praktyce jedna centrala (np. POLON 6000 w budynku głównym) obsługuje kilka obiektów tego samego klienta (budynek + parking, pawilony szpitala). Cel: centrala należy do **klienta** i jest przypisana do **wielu jego obiektów**; jej karta, pliki konfiguracji i historia są wspólne i widoczne na każdym obsługiwanym obiekcie. Usunięcie jednego obiektu nie usuwa centrali.

## Model danych (`functions/api/schema.mjs`, idempotentna migracja przy starcie)
- `panels`: zamiast `site_id` → `client_id INT NOT NULL REFERENCES clients ON DELETE CASCADE`.
- Nowa tabela `panel_sites (panel_id → panels CASCADE, site_id → sites CASCADE, PRIMARY KEY (panel_id, site_id))`.
- `history.site_id` → dopuszczalny NULL; wpisy historii centrali zapisywane bez `site_id` (należą do centrali, nie do obiektu).
- Migracja istniejących danych w bloku `DO $$ … $$` (tylko gdy kolumna `panels.site_id` istnieje): `client_id` z obiektu, wiersz w `panel_sites`, `SET NOT NULL`, `DROP COLUMN site_id`; `UPDATE history SET site_id=NULL WHERE entity='panel'`. Definicja `CREATE TABLE panels` aktualizowana dla nowych baz.

## API (`functions/api/index.mjs`)
- `PANEL_COLS`: `client_id` zamiast `site_id`; `PANEL_SELECT` dokłada `sites` (lista `{id,name}` przez `panel_sites`).
- `panels.save({…, site_ids})`: walidacja, że wszystkie obiekty należą do `client_id`; podmiana zbioru w `panel_sites`; zmiana listy obiektów logowana w historii jako zmiana pola „Obsługiwane obiekty: A → A, B” (rozszerzenie `logChange`/`diff` o dodatkową pozycję).
- Nowe: `panels.linkSite` / `panels.unlinkSite({panel_id, site_id})` (przypisz istniejącą centralę klienta do obiektu / odłącz) — z wpisem w historii centrali.
- `panels.get`: zwraca `panel`, `client`, `sites` (obsługiwane obiekty z `SITE_SELECT`), `files`, `history` (zamiast pojedynczego `site`).
- `sites.get`: `panels` = centrale z `panel_sites` dla obiektu (+ lista pozostałych obsługiwanych obiektów); `clientPanels` = pozostałe centrale klienta (do „przypisz istniejącą”); `history` = wpisy elementów obiektu **+ wpisy central przypisanych do obiektu** (`entity='panel' AND entity_id IN (…panel_sites…)`).
- `clients.get`: dokłada `panels` (centrale klienta z listą obiektów).
- Sprzątanie plików: `purgeFiles` łączy przez `p.client_id` (usuwanie klienta / demo); **usunięcie obiektu nie usuwa plików centrali**. Usunięcie klienta kasuje też historię centrali (+ zdjęcia) — `purgePhotos` przechodzi na `LEFT JOIN sites`, by objąć wpisy bez obiektu.
- Klucz pliku konfiguracji: `configs/client-{id}/panel-{id}/…` (istniejące pliki zostają pod starymi kluczami — w bazie jest pełny klucz).
- `logEvent` dla centrali: `site_id: null`.

## Frontend
- `ui.jsx` `RecordForm`: nowy typ pola `checkboxes` (lista opcji, wartość = tablica id).
- `forms.js` `panelFields(sites)`: pole „Obsługiwane obiekty” (`checkboxes`, obiekty klienta); `clean` zamienia `site_ids` na liczby.
- `SiteDetail.jsx`, zakładka „Karta centrali”: karta pokazuje „obsługuje także: …” (linki); przyciski „Nowa centrala” (prefill: klient + ten obiekt zaznaczony) i „Przypisz istniejącą centralę klienta” (select z `clientPanels`), opcja „Odłącz od obiektu”; pasek „Centrala” pokazuje model przypisanej centrali.
- `PanelDetail.jsx`: nagłówek z klientem; nowa sekcja „Obsługiwane obiekty” (lista z linkami i następnym przeglądem); powrót do klienta; edycja z wyborem obiektów; `clients.list` niepotrzebny — obiekty klienta z `panels.get` (`clientSites`).
- `ClientDetail.jsx`: nowa karta „Centrale” (model, SN, obsługiwane obiekty, liczba plików) + „Dodaj centralę”.
- `HistoryList` (książka eksploatacji): wpisy centrali już linkują do `/centrale/:id` — bez zmian.

## Dane demo (`functions/api/demo.mjs`)
Centrale per klient: Galeria Wisła — jedna POLON 6000 obsługująca budynek główny **i** parking P-1; szpital — jedna Integral IP dla pawilonów A i C; pozostali po jednej. Historia centrali z `site_id NULL`. (Demo wczytuje się tylko przyciskiem — nie ruszam obecnych danych użytkownika.)

## Weryfikacja
1. `node --check`, `vite build`; commit → `openkbs fn deploy api` → `openkbs site deploy`.
2. Migracja na żywej bazie: istniejące karty centrali (jeśli są) zachowują pliki, historię i obiekt.
3. Test API na tymczasowym kliencie „TEST — usuwany automatycznie” (2 obiekty): centrala z dwoma obiektami, plik konfiguracji, wpis historii → widoczne na obu obiektach; obiekt innego klienta odrzucony; usunięcie jednego obiektu nie usuwa centrali ani pliku; usunięcie klienta czyści pliki w storage. Potem usunięcie klienta testowego.
4. UI na lokalnej kopii z mockiem API (jak poprzednio): zakładka centrali na obiekcie, przypisanie istniejącej, karta centrali z listą obiektów, karta klienta.

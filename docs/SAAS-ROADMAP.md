# CommandFIRE CRM — SaaS roadmap

## Cel
Rozwijamy istniejący CRM SSP, bez przepisywania interfejsu React/Vite od zera. Środowisko testowe: Debian 13, Docker, PostgreSQL 17, Redis 8, Nginx Proxy Manager; dostęp wyłącznie LAN.

## Architektura
- **Platforma**: rejestr tenantów, subskrypcji, planów i provisioningu.
- **Tenant**: osobna baza PostgreSQL, własne konta, obiekty, centrale, protokoły, pliki.
- **Frontend**: istniejący React/Vite, bez publicznego endpointu AWS.
- **API CRM**: adapter HTTP dla istniejącego kontraktu `POST {action,...}`, później refaktoryzacja.
- **Pliki**: prywatny wolumen lub zgodny z S3 magazyn, kontrola dostępu przez API.
- **Sieć**: wewnętrzne sieci Docker; NPM jako punkt wejścia w LAN.

## Etapy
1. Bezpieczny build frontend + lokalny adres API, bez zmiany produkcji.
2. Adapter HTTP dla backendu i migracje schematu (bez automatycznego DDL przy każdym żądaniu).
3. Oddzielna baza testowa i testy regresji CRM.
4. Model tenantów i routing po zweryfikowanej sesji, izolacja baz.
5. Provisioning, panel operatora, subskrypcje i limity.
6. Backup/restore per tenant, audyt, testy izolacji, hardening.
7. Testy LAN i dopiero później ewentualna publikacja zewnętrzna.

## Blokery bezpieczeństwa przed wdrożeniem
- `setup.admin` nie może być publicznym endpointem po bootstrapie; wymagany jednorazowy token lub komenda administracyjna.
- CORS musi mieć ograniczoną listę originów; przechowywanie tokenów w localStorage wymaga przeglądu.
- Nie używać `ssl: { rejectUnauthorized: false }` w produkcji.
- Nie ujawniać wewnętrznych wyjątków bazy w odpowiedziach HTTP.
- Weryfikować tenant po stronie serwera na każdym żądaniu, nigdy nie ufać samemu tenant_id z klienta.
- Pliki i zdjęcia: walidacja rozmiaru/typu, autoryzacja odczytu i usuwania.
- Nie mieszać bazy platformy `commandfire_platform` z bazami tenantów.
- Nie publikować PostgreSQL ani Redis na wszystkich interfejsach w docelowej konfiguracji.

## Uwaga
Gałąź rozwojowa nie jest jeszcze produktem gotowym do wdrożenia. Nie uruchamiać migracji na istniejących bazach bez backupu.

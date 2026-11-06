# CommandFIRE CRM — isolated LAN pilot

**Not production ready.** This compose stack does not modify the existing .NET API or the `commandfire_platform` database.

1. Prepare an isolated test PostgreSQL database and credentials.
2. Provide `CRM_DATABASE_URL` and `CRM_STORAGE_BUCKET` as environment variables (never commit credentials).
3. Review and configure object storage before using file/photo functions.
4. Run from `deploy/saas`: `docker compose config` to validate configuration, then `docker compose up -d --build`.
5. Verify `curl http://127.0.0.1:8280/` and `curl http://127.0.0.1:8280/api/health/live` (note: API health is available directly on its container path `/health/live`, not via the current web proxy; use `docker compose exec crm-api node -e "fetch('http://127.0.0.1:8080/health/live').then(r=>console.log(r.status))"`).
6. Do **not** expose this pilot to the internet or real users. Public administrator bootstrap and existing token/CORS/storage behavior require hardening.

The frontend calls the same-origin `/api/` endpoint. The Node HTTP adapter preserves the existing Lambda-style action dispatch. This is a compatibility bridge, not multi-tenant isolation yet.

The API currently uses AWS S3 SDK and the existing schema bootstrap. Storage, database SSL settings and secure migration handling are tracked as next tasks.

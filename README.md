# Offline QR School Attendance

An authenticated teacher attendance PWA for school-issued QR credentials. The teacher downloads an assigned-class roster into IndexedDB, creates a UUID-based offline session, scans with the camera or a USB keyboard-wedge scanner, and synchronizes an idempotent outbox when connectivity returns.

## Local development

Prerequisites: Node.js 22 and either PostgreSQL or the embedded PGlite test/development runtime.

```bash
npm ci
cp .env.example .env
npm run migrate
npm run seed                 # development fixtures only
npm run dev
```

The application does not run migrations or seed data on web-server startup. In production, run `npm run migrate` as a deployment step and keep `npm run seed:prod` as an explicit, reviewed data-load operation. There is no Gemini dependency or `GEMINI_API_KEY` requirement.

## Production deployment

Set `NODE_ENV=production`, `DATABASE_URL`, `SESSION_SECRET` (a high-entropy value), and the SMS provider configuration. Deploy in this order:

1. Build the image with `npm run build`.
2. Run `node dist/migrate.cjs` once against the target database and fail the release if it exits non-zero.
3. Start `node dist/server.cjs` and the separate `node dist/sms-worker.cjs` process.

Run migrations with the schema-owner role, but run the web and worker processes with a separate non-owner PostgreSQL role. The versioned RLS migration installs tenant `USING` and `WITH CHECK` policies; tenant-sensitive multi-query operations use the transaction-scoped `withTenantContext` helper.

`docker compose up --build` demonstrates the same order with a one-shot `migrate` service and a continuously running SMS worker. The worker claims jobs atomically, recovers stale claims, respects retry timing, segment limits, and configured SMS segment balance.

## Offline and sync behavior

Roster data, session snapshots, and scan events are stored in Dexie/IndexedDB. Every offline session gets a client UUID. Sync sends session metadata separately from events; PostgreSQL stores that UUID in `attendance_sessions.client_session_id`, transactionally creates or locates the server session, and maps all events to the server UUID. Repeated transmission is safe through `client_event_id` idempotency.

The browser must be online for initial authentication and roster download. Once the roster is cached, attendance collection continues offline. Finalization requires successful synchronization so the server can apply the authoritative review/finalization state and queue absence notifications.

## Backups and restore

Back up PostgreSQL with a tested, encrypted `pg_dump`/`pg_restore` process and retain the database plus deployment migration history together. Before restore, stop the web and SMS worker processes; restore into a new database, validate row counts and tenant boundaries, run the versioned migrations, and perform a controlled login/report/sync smoke test before switching traffic.

## Test credentials

The development seed creates fixtures only. Do not use them with real student data or a production SMS provider:

- Teacher: `+919100000002` / `TeacherPassword123!`
- School admin: `+919100000001` / `SchoolAdminPassword123!`
- Super admin: `+919000000000` / `SuperSecretAdminPassword123!`

## Verification

```bash
npm run check
npm test
npm run build
```

The Playwright workflow covers login, roster download, offline session creation, two scans, browser close/reopen persistence, reconnect, synchronization, and server-side session/record reconciliation.

# WorkPulse Production Deployment Runbook

## Purpose

This guide is for an authorized operator deploying WorkPulse. Keep all credentials in host secret storage; never commit `.env`, database dumps, reset links, device credentials, or backups.

## Prerequisites

- Node.js version approved by the host, MySQL 8+ compatible with the application, and MySQL client tools (`mysql`, `mysqldump`).
- Managed HTTPS domain, DNS ownership, reverse proxy, persistent logs, monitoring, Cloudinary account, and SMTP provider.
- A tested backup location outside the repository with restricted access.

## Required production environment

Set at least:

```text
NODE_ENV=production
PORT=5000
DB_HOST=...
DB_PORT=3306
DB_USER=least_privilege_workpulse_user
DB_PASSWORD=...
DB_NAME=workpulse
JWT_SECRET=a-random-secret-of-at-least-32-characters
FRONTEND_URL=https://app.example.com
TRUST_PROXY_HOPS=1
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
MAIL_HOST=...
MAIL_PORT=...
MAIL_USER=...
MAIL_PASSWORD=...
MAIL_FROM=WorkPulse <no-reply@example.com>
ATTENDANCE_PHOTO_RETENTION_DAYS=90
BACKUP_DIR=/secure/workpulse-backups
BACKUP_RETENTION_DAYS=30
```

`FRONTEND_URL` accepts a comma-separated HTTPS origin allowlist. Set `TRUST_PROXY_HOPS` only to the verified number of trusted proxies; do not use a blanket trust setting.

## Database creation and migrations

1. Provision an empty database and least-privilege application user. Configure `+05:30` session handling through the application; do not change historical attendance timestamps.
2. For a **new empty database**, load the complete portable schema once. It no longer selects a hard-coded database, so connect the MySQL client to the intended database explicitly:

   ```bash
   mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password "$DB_NAME" < database/schema.sql
   ```

   Do **not** run the historical additive migrations after this fresh schema load; `database/schema.sql` already includes their current structures.
3. For an **existing installation**, inspect the target schema and use only the applicable reviewed additive migration/helper. Never rerun a prior migration blindly. Take and verify a backup first:

   ```bash
   cd server
   npm run backup:database
   ```

   Then apply the idempotent fresh-schema completion helper before any other applicable reviewed helper:

   ```bash
   npm run migration:schema-completion
   ```

4. Apply the additive operations migration once when its tables/settings columns are absent:

   ```bash
   node scripts/apply-production-operations-migration.js
   ```

5. Run `npm run test:production-features` and record its output. It is read-only.

## Build and start

```bash
cd client
npm ci
npm run build

cd ../server
npm ci
npm run production:check
npm start
```

The preflight must pass before public deployment. It intentionally never prints secret values. The host should run the Node service under a process manager and place an HTTPS reverse proxy in front of it.

## Reverse proxy, HTTPS and CORS

- Terminate TLS at the proxy and redirect HTTP to HTTPS.
- Forward the correct protocol and client address only from trusted proxy hops.
- Serve the client build from the approved origin(s) in `FRONTEND_URL`.
- Confirm arbitrary origins receive no CORS permission.
- With `NODE_ENV=production`, `/api/test` must be absent.

## Storage and attendance photos

New attendance uploads use Cloudinary authenticated delivery. Attendance management fetches images through a branch-scoped authenticated backend route, so storage URLs are not included in the management table response. Existing public Cloudinary assets remain a legacy exposure until migrated or expired; do not mass-migrate them without a reviewed plan.

Schedule the retention command daily, initially in dry-run mode:

```bash
cd server
npm run cleanup:attendance-photos:dry-run
# after reviewing candidate output and approval:
npm run cleanup:attendance-photos
```

The command uses the Organization Settings retention value when available, otherwise `ATTENDANCE_PHOTO_RETENTION_DAYS`. It deletes only eligible Cloudinary assets and clears their corresponding database references. It is not run automatically by deployment.

## Backup, restore and rollback

- Schedule `npm run backup:database` daily and verify both the `.sql` file and adjacent SHA-256 file in protected storage.
- Test restoration only in an approved isolated environment. Verification mode is non-destructive:

  ```bash
  npm run restore:database:verify -- /secure/workpulse-backups/example.sql
  ```

- A real restore requires both `--execute` and `--confirm-restore`, plus explicit non-production acknowledgement where applicable. It must never be run casually against the live database.
- Before a risky release: backup, deploy, smoke-test, and roll back the application version if the smoke test fails. Restore DB only when schema/data rollback is approved.

## First Super Admin and device enforcement

Use the supported first-install setup path or approved seed process. Never place credentials in source.

Authorized attendance devices are optional and off by default. Generate the credential through the Super Admin device workflow, distribute it through a secure channel once, then enable enforcement in Organization Settings only after a device has been tested. Revoke/rotate a device if lost. No browser fingerprinting is used.

## Monitoring, logs and health

- Monitor `GET /` for HTTP 200 using a service such as UptimeRobot or host-native uptime checks.
- Collect process stderr/stdout in structured host logs. Error entries include a request ID but must not include passwords, JWTs, reset tokens, Aadhaar/PAN, or raw photo URLs.
- Alert on sustained 5xx responses, startup failures, backup failures, cleanup failures, and database connection errors.

## Production smoke test

1. Check `/`, `/api/setup/status`, and production CORS from an approved and an unapproved origin.
2. Verify a management login failure is rate-limited after the configured threshold; do not use real credentials repeatedly.
3. Verify Super Admin and Admin scopes, audit logs, alerts, report exports, photo viewing, correction workflow, and forced password change using disposable accounts.
4. Verify SMTP reset delivery with a test mailbox.
5. Confirm the photo cleanup dry-run, backup file, and preflight pass.

## Common troubleshooting

- **Preflight failure:** repair the named host configuration; do not add placeholder secrets.
- **CORS failure:** compare browser origin exactly with comma-separated `FRONTEND_URL` origins and verify `NODE_ENV=production`.
- **Photo unavailable:** confirm the viewer role/branch scope, Cloudinary credentials, public ID, and whether the photo has expired under retention.
- **Missing checkout alert:** compare server IST time, duty end, and configured grace; WorkPulse does not invent a checkout timestamp.
- **Import preview rejected:** download a fresh template, correct every row, and preview again. Imports are atomic after explicit confirmation.

## Explicit v1 exclusions

Payroll, salary calculation, biometrics, face recognition, continuous tracking, multi-tenant SaaS, billing, Platform Admin, complex shift engines, and native mobile apps are outside this release.

# WorkPulse Deployment Readiness

This operator checklist complements the detailed [production runbook](WORKPULSE_PRODUCTION_DEPLOYMENT_RUNBOOK.md). It does not contain production credentials.

## Before deployment

1. Keep production secrets only in host secret storage. Configure `server/.env.example` values with real production values: database access, a unique 32+ character JWT secret, HTTPS `FRONTEND_URL` allowlist, Cloudinary credentials, and SMTP sender/host. Configure the frontend's `VITE_API_BASE_URL` as the public HTTPS API URL ending in `/api`.
2. Set `NODE_ENV=production` and the exact verified `TRUST_PROXY_HOPS`. Do not use `trust proxy` broadly. Configure CORS only for approved HTTPS frontend origins.
3. Create a least-privilege MySQL user and an empty database. Load the portable base schema once:

   ```bash
   mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password "$DB_NAME" < database/schema.sql
   ```

   Do not apply historical migrations after a fresh schema load. For an existing database, take a verified backup, run `npm run migration:schema-completion`, then run only any other reviewed, applicable additive helper.
4. Build and validate:

   ```bash
   cd client && npm ci && npm run lint && npm run build
   cd ../server && npm ci && npm run production:check && npm run test:readiness-contract
   ```

5. Store database backups outside the repository with restricted access. Schedule `npm run backup:database`; verify the SQL file and SHA-256 companion. Test restore only in an approved isolated environment using `npm run restore:database:verify -- /approved/backup.sql` before authorizing a real restore.
6. Schedule `npm run cleanup:attendance-photos:dry-run` daily first. After reviewed approval, schedule `npm run cleanup:attendance-photos`. It deletes only Cloudinary assets already eligible under retention and clears their matching database references.
7. Review demo/test candidates with `npm run demo-data:identify`. This command never deletes. Use a separately approved, backup-first removal plan; do not run a generic production wipe.

## Deployment and smoke test

1. Serve the Vite build over HTTPS and run the API behind an HTTPS reverse proxy/process manager with persistent structured logs and uptime monitoring.
2. Confirm `GET /` returns 200, `/api/test` is 404, an approved browser origin receives CORS permission, and an unapproved origin does not.
3. Complete the supported first Super Admin setup path once. Do not retain seed credentials in host configuration after setup.
4. With disposable accounts, verify Super Admin/Admin branch scope, forced password change, password reset email/link/one-time expiry, attendance check-in/out/photo viewing, exports, alerts, audit logs, correction, and import preview/confirm.
5. Confirm backup dry run/result, photo-cleanup dry run, error monitoring, process restart behavior, and database connection alerts.

## No-go conditions

Do not deploy publicly until HTTPS domains/DNS, production secrets, managed MySQL backup/restore, Cloudinary, SMTP, CORS/proxy values, monitoring, a final schema check, and the disposable-account smoke test are all complete.

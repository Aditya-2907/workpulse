# WorkPulse Production Hardening & Features

Date: 22-09-2026

## 1. Executive Summary

**Status: IMPLEMENTED WITH PRODUCTION AND MANUAL FOLLOW-UP.** This is the authoritative ledger for the 22-09-2026 production-hardening phase. It preserves the stable single-organization WorkPulse V1 implementation, the Day-1 audit, forced-password flow, server-authoritative IST time, scoped attendance-photo viewer, and UI work. No production service, backup, supplied SQL dump, or production database was modified.

One additive local schema migration was applied after a read-only preflight. It added operational setting columns and empty `attendance_corrections` / `attendance_devices` tables; a second run safely skipped existing structures. No destructive photo cleanup, backup, restore, demo-data cleanup, employee import confirmation, attendance correction, device enrollment, or authenticated account mutation was executed.

| Feature | Status | Evidence / boundary |
| --- | --- | --- |
| Photo retention | PASS / PRODUCTION CONFIG REQUIRED | 90-day default and dry run passed; host scheduling remains required. |
| Rate limiting | PASS | Ephemeral HTTP test reaches safe 429 response. |
| HTTP security headers | PASS | Helmet and header/404 test passed. |
| Attendance-photo privacy | SOURCE VERIFIED / MANUAL TEST REQUIRED | New uploads authenticated; scoped proxy preserves authorization; legacy assets need a migration decision. |
| Backup/restore tooling | SOURCE VERIFIED / PRODUCTION CONFIG REQUIRED | Safe scripts/runbook added; no backup or restore ran. |
| Logging, errors, monitoring | PASS | Request ID, safe boundaries, health, process handlers and HTTP checks. |
| Expanded audit logging | SOURCE VERIFIED / MANUAL TEST REQUIRED | Central coverage includes Branch, Department, Leave and Holiday mutations in addition to earlier Admin/Employee/Settings/Correction/Device paths. |
| Audit Logs UI | SOURCE VERIFIED / MANUAL TEST REQUIRED | Super-Admin API/page/navigation added. |
| Below-70% attendance alert | PASS | Read-only service formula/database check passed. |
| Missing checkout alert | PASS | Read-only IST/duty/grace service check passed. |
| Attendance correction | SOURCE VERIFIED / MANUAL TEST REQUIRED | Super-Admin transactional flow implemented; no record corrected. |
| Bulk employee import | SOURCE VERIFIED / MANUAL TEST REQUIRED | Preview/confirm transaction flow; no import confirmed. |
| Organization settings / Alert Center | PASS / SOURCE VERIFIED | Additive schema, settings API/page and scoped alerts added. |
| Security/account events | PARTIAL | Safe audit/onboarding state exists; SMTP notification remains configuration-dependent. |
| Reporting enhancements | PARTIAL | Existing consolidated filters cover core report types; alert export remains future work. |
| Device foundation | PARTIAL | Secure backend foundation, disabled by default; no device UI. |
| Demo-data review | PASS | Read-only candidate finder ran; nothing deleted. |
| Production preflight/runbook | PASS / PRODUCTION CONFIG REQUIRED | Validator and operator runbook added; local preflight correctly failed production-only requirements. |

## 2. Safety Baseline and Architecture Preserved

- This remains **one installation = one organization**. No tenant, platform-admin, billing, plan, or organization-switching architecture was introduced.
- Existing dirty worktree changes were preserved; no reset, checkout, or destructive cleanup was used.
- React/Vite, Express/MySQL2, JWT/role middleware, Admin branch scope, Super Admin organization scope, Cloudinary photos, and the MySQL `+05:30` session model remain in use.
- Existing attendance/report exports remain photo-free. Attendance/geofence/device-browser flow and historical attendance were not rewritten.

## 3. Security and Operations Changes

### Rate limiting and proxy safety — PASS

- Added `express-rate-limit` with consistent non-enumerating JSON: `{ success: false, code: "RATE_LIMITED", message: "Too many requests. Please wait and try again." }`.
- Limits: management login 10/15 minutes, attendance login 12/15 minutes, forgot/reset password 5/60 minutes, Admin request 10/60 minutes, and setup completion 5/60 minutes.
- `TRUST_PROXY_HOPS` is optional and must be a non-negative integer. The app does not use unrestricted `trust proxy: true`.

### Headers, safe errors, and monitoring readiness — PASS

- Added Helmet with CSP disabled intentionally: the frontend/API may be separately hosted and an unreviewed CSP could break existing Vite/Cloudinary paths. HSTS is enabled only under production.
- API responses use `X-Request-Id`, safe request error logging, JSON 404 responses, and a centralized error response without client stack traces.
- Added safe process-level rejection/exception logging. This work does not intentionally log passwords, JWTs, reset tokens, Aadhaar/PAN, or raw photo URLs.
- Existing `GET /` remains the uptime-health endpoint; the runbook documents host/UptimeRobot-style monitoring without adding a vendor dependency.

### Photo privacy and retention — SOURCE VERIFIED

- New check-in/out uploads use Cloudinary authenticated delivery. Management rows return availability flags rather than raw photo paths.
- `GET /api/attendance/management/:id/photo/:kind` is an authenticated `check-in`/`check-out` proxy that preserves Admin branch and Super Admin organization scope, streams private/no-store content, and does not disclose storage credentials or a raw URL to the browser.
- The existing cleanup script was extended rather than duplicated. It covers check-in/out path and public-ID pairs, reads the safe DB/environment retention value (90 days by default), distinguishes authenticated/legacy deletion, supports dry run, and logs aggregates.
- Legacy Cloudinary `upload`-type photos cannot become private just because new uploads changed. Their migration/expiry is **PRODUCTION CONFIG REQUIRED**. No cleanup was executed.
- Scheduling instructions use an external host scheduler to avoid duplicate timers in multi-process deployments.

### Backup, restore, demo review, and preflight — SOURCE VERIFIED

- `backupDatabase.js` creates timestamped MySQL dumps plus SHA-256 checksums in configurable ignored directories. `restoreDatabase.js` defaults to verification, requires `--execute --confirm-restore`, and blocks non-production restore unless explicitly overridden.
- `identifyDemoData.js` is read-only and reports candidates by reviewable QA/test patterns. No destructive cleanup command was created or run.
- `productionCheck.js` validates environment shape without printing secret values. Its local run correctly failed non-production `NODE_ENV`/frontend-origin checks and warned that SMTP is incomplete.

## 4. Operational Features

### Organization settings and derived alert center

- Super-Admin settings now validate display contact information, `Asia/Kolkata`, attendance alert threshold (70 default), photo retention (90 default), missing-checkout grace (30 default), and optional device enforcement. Updates are audited and do not rewrite historical attendance.
- Alert Center is derived rather than stored as duplicate notification rows. Admin scope is branch-only; Super Admin scope is organization-wide.
- **Below-70 formula:** current month through database `CURDATE()`; denominator is active employee eligible days minus holidays, applicable weekly offs and approved leave; numerator is eligible days with a check-in. Only a value strictly below threshold alerts; exactly 70% does not.
- **Missing checkout rule:** a prior-day check-in without checkout is incomplete; a current-day check-in appears only after duty end plus configured grace. SQL relies on the existing IST `NOW()` / `CURDATE()` session.

### Auditability and corrections

- Added central audit helper redaction and safe metadata. New coverage includes Admin candidate request/approval/rejection/direct create/edit/status/recovery reset; Employee create/edit/status; bulk import aggregate; settings; device generation/revocation; and attendance correction. Existing transfer logging stays intact.
- Added Super-Admin-only Audit Logs API/page with newest-first pagination and date/action/entity/actor filters. Backend authorization does not rely on hidden navigation.
- Added Super-Admin-only attendance correction in Attendance Management. It requires a reason, locks and validates the record, recalculates derived values server-side, stores original/corrected metadata in `attendance_corrections`, and writes audit data in the same transaction. Admin/Employee correction is deliberately forbidden.
- Branch, Department, Leave and Holiday mutations now use the same central helper inside their mutation transactions. Authenticated mutation verification is still manual because this task did not create/change business data.

### Bulk import and authorized-device foundation

- Super Admin can download an employee import template, upload `.xlsx`, validate every row, inspect a masked preview, and explicitly confirm a single transaction. Validation covers unknown branch/department, duplicate file/database phone/Aadhaar values, dates, duty times, status/gender, and required fields. No sensitive identity values are shown in the browser preview.
- The optional attendance-device backend generates a token once, stores only a SHA-256 hash, supports revocation, and checks it only when settings enable enforcement. No browser fingerprinting or plaintext long-term secret was introduced. Default enforcement is off; a device-management UI remains follow-up.

### Reporting decision — PARTIAL

- Existing consolidated Attendance Report already supports date, search, branch/department/role/status, late, early departure, attendance-percent, worked-minute and check-in-time filtering, with Admin/Super-Admin scope and complete Excel/PDF exports. It covers monthly detail, late, early, absence/status and leave reporting without duplicating controllers.
- Below-threshold and missing-checkout exceptions are live in Alert Center rather than duplicated report/export types. Alert-summary export is future work if the client needs it.

## 5. Schema and API Changes

### Local migration — PASS

`server/scripts/apply-production-operations-migration.js` was preceded by a read-only schema check, applied once, then rerun to demonstrate idempotence.

- Added organization settings columns: address, phone, email, `timezone_name`, `attendance_alert_threshold`, `photo_retention_days`, `missing_checkout_grace_minutes`, `device_enforcement_enabled`.
- Added empty `attendance_corrections` and `attendance_devices` tables, with fresh-install parity in `database/schema.sql`.
- The migration creates schema only; it did not rewrite historical attendance or force account state.

| Endpoint group | Authorization | Purpose |
| --- | --- | --- |
| `/api/settings` | Super Admin | Organization settings. |
| `/api/alerts` | Admin/Super Admin, scoped | Derived alert center. |
| `/api/audit-logs` | Super Admin | Safe paginated audit view. |
| `/api/attendance/management/:id/photo/:kind` | Admin/Super Admin, scoped | Private management photo stream. |
| `/api/attendance/management/:id/correction` | Super Admin | Controlled correction/history. |
| `/api/employees/import/*` | Super Admin | Template, preview, explicit confirmation. |
| `/api/attendance-devices` | Super Admin | Optional device foundation. |

## 6. Files Added or Changed

- Security/services: `server/src/middleware/rateLimiters.js`, `server/src/services/auditService.js`, `server/src/services/managementAlertService.js`, revised photo service/app/server/auth middleware/routes.
- Controllers/routes: attendance photo, settings, alerts, audit logs, correction, device, employee import and their protected route modules.
- Schema/scripts: `server/migrations/20260922_add_production_operations_foundation.sql`, `server/scripts/apply-production-operations-migration.js`, backup/restore/demo/preflight/focused-test scripts, and `database/schema.sql`.
- UI: Organization Settings, Alert Center, Audit Logs, Employee Import, Attendance correction/photo support, API client, protected routes and navigation.
- Operations: `WORKPULSE_PRODUCTION_DEPLOYMENT_RUNBOOK.md`, `server/.env.example`, package scripts/dependencies and ignored backup directories.

## 7. Commands Actually Executed

| Command/check | Result |
| --- | --- |
| Read-only operations schema preflight | PASS — settings table existed with no operational columns before the additive migration. |
| `node scripts/apply-production-operations-migration.js` | PASS — applied missing structures once, then safely skipped them on rerun. |
| `npm run cleanup:attendance-photos:dry-run` | PASS — default 90 days; no eligible local candidate; no deletion. |
| `npm run test:security-middleware` | PASS — health, Helmet headers, JSON 404 and safe limiter 429. |
| `npm run test:production-features` | PASS — IST session, schema, derived alerts, routes and limiter contract. |
| `npm run demo-data:identify` | PASS — read-only candidate listing; no deletion. |
| `npm run production:check` | Expected local FAIL — workstation is not production-configured; SMTP warning expected. |
| Changed server `node --check` | PASS. |
| `npm.cmd run lint` in `client` | PASS — no errors; 12 existing/source warnings. |
| `npm.cmd run build` in `client` | PASS — Vite production build completed. |
| `git diff --check` | PASS — no whitespace errors; only CRLF notices. |

No type-check script and no browser automation framework are configured.

## 8. Required Production Configuration and Manual Checks

### Production configuration

1. Set production `NODE_ENV`, approved HTTPS `FRONTEND_URL`, strong JWT, least-privilege DB, Cloudinary and SMTP credentials in host secret storage.
2. Set `TRUST_PROXY_HOPS` for the actual proxy chain; do not use a generic value.
3. Schedule `npm run cleanup:attendance-photos` daily through the selected host and decide the legacy Cloudinary migration/expiry plan.
4. Select encrypted backup storage/retention/access, then perform a separately authorized staging restore drill.
5. Configure SMTP/domain authentication and test real reset/onboarding email delivery.
6. Run preflight, schema/migration verification, health and CORS smoke tests with real host values before release.

### Manual regression

1. Verify Admin/Super-Admin photo streaming scope, legacy/current viewer behavior, and absence of table raw URLs.
2. Verify Settings, Alert Center and Audit Logs filters/pagination in both themes and responsive widths.
3. Use disposable data for correction reason/history and bulk-import preview/confirm/rollback tests.
4. Enroll/revoke a disposable device and test enforcement only after a safe attendance-device plan.
5. Reconcile below-threshold and missing-checkout results against controlled leave/holiday/weekly-off cases.
6. Verify management and employee-login branding at desktop/mobile; browser visual automation is unavailable.

## 9. Branding Continuation Compatibility

The subsequent branding-resume work preserves this hardening phase. `WorkPulseLogo` supports official full/compact PNG assets, uses a branded-text failure state rather than `W`/`WS` initials, and enlarges authentication lockups while preserving aspect ratio. Details and the visual boundary are recorded in `WORKPULSE_IMPLEMENTATION_PROGRESS.md`.

## 10. Final Evidence Boundary

PASS claims are limited to the commands, static checks, ephemeral HTTP tests, migration checks and read-only database service checks listed above. Authenticated browser flows, actual Cloudinary delivery, SMTP delivery, host scheduling, production deployment, production backup/restore and all destructive operations were not run and are not claimed as passed.

## 11. Final Delivery-Readiness Regression — 2026-09-22

### Runtime fixes completed

- **Employee Transfer:** removed the misplaced, commented `EMPLOYEE_CREATED` block from `transferEmployeeBranch`. It had referenced create-only variables (`result`, `employeeCode`, `finalBranchId`, `departmentId`, `designation`) and caused the observed `ReferenceError`. The transfer now writes exactly one `EMPLOYEE_BRANCH_TRANSFER` event through `writeAuditLog` before the transaction commits, with the old and destination branch IDs/codes/names.
- **Employee creation:** added the proper `EMPLOYEE_CREATED` event to the actual create transaction before commit. It records only employee code, branch/department, designation and active status—never Aadhaar, PAN, or credentials.
- **Branch update:** the existing branch update changed the branch and weekly offs through separate autocommit statements and issued an unused debug query. It now locks the branch, replaces weekly offs, writes `BRANCH_UPDATED`, and commits or rolls back as one transaction. Branch status updates use the same pattern.
- **Audit serialization:** malformed legacy JSON in one audit row can no longer make the whole Audit Logs response fail. Unparseable metadata is safely omitted after redaction.
- **Bulk import:** the browser and upload middleware now intentionally accept only the current `.xlsx` template. Validation rejects actual invalid calendar dates and out-of-range times, detects duplicate email values, and records whether a preview is fully valid. Confirmation rejects a crafted token for a partially invalid preview, preventing a valid-subset import.
- **Attendance devices:** creation and revocation now commit their device state and audit record atomically. Enforcement remains off unless a Super Admin enables it.

### Audit coverage now present in source

| Mutation group | Actions |
| --- | --- |
| Employee | create, edit, status, branch transfer, bulk-import aggregate |
| Admin | candidate request, approval/rejection, direct create/edit/status/recovery reset |
| Branch | create, edit/weekly-off replacement, status |
| Department | create, edit, status |
| Leave | approved/create and cancelled |
| Holiday | create, edit, delete |
| Attendance | Super-Admin correction |
| Settings/devices | organization settings, device create/revoke |

The Audit Logs route remains authenticated and Super-Admin-only; source confirms newest-first ordering, capped pagination, date/action/entity/actor filters, safe metadata redaction, and client loading/error/empty states. Anonymous requests to `/api/audit-logs`, `/api/settings`, `/api/alerts`, device APIs, correction, and management photo routes returned 401 locally. Admin-versus-Super-Admin authenticated rejection remains manual because no disposable management credential was supplied.

### Final safe validation in this regression

| Check | Result |
| --- | --- |
| Changed controller/script `node --check` | PASS |
| `npm run test:employee-import-safety` | PASS — invalid date/time preview and crafted partial-preview confirmation blocked without inserts |
| `npm run test:security-middleware` | PASS |
| `npm run test:production-features` | PASS — IST session, operations structures, alert service and route contracts |
| `node scripts/test-reports-filters.js` | PASS — JSON, Excel and PDF routes reject anonymous access; authenticated report cases were not run without a disposable token |
| `npm run cleanup:attendance-photos:dry-run` | PASS — 90-day setting, no local candidate, no deletion |
| Local HTTP health/setup/anonymous protected routes | PASS — health/setup 200; protected routes 401 |
| Read-only schema/index inspection | PASS — expected operational tables present; branch/department/reset unique indexes present |
| `npm run demo-data:identify` | PASS — dry-run candidates only; no deletion |
| Restore verifier without a supplied file | EXPECTED LOCAL FAILURE — refuses to proceed without an explicit existing SQL path |
| `npm run production:check` | EXPECTED LOCAL FAILURE — local machine intentionally lacks production `NODE_ENV` / HTTPS origin; SMTP incomplete warning |
| Client lint | PASS — 12 existing/source warnings, no errors |
| Client production build | PASS |
| `git diff --check` | PASS — CRLF notices only |

### Final manual browser regression checklist

Use disposable credentials/data where a test mutates data. Do not mark any item PASS without its own evidence.

| Area | Checks | Result | Notes | Evidence |
| --- | --- | --- | --- | --- |
| Auth | Super Admin/Admin login, employee phone login, logout, change password, SMTP reset when configured |  |  |  |
| Employee | create/edit/status, transfer, transfer audit, DOB/gender/profile fields |  |  |  |
| Admin | request, approve/reject, edit/status/search, temporary-password flow |  |  |  |
| Branch / Department | create/edit, generated immutable codes, weekly offs, audit entries |  |  |  |
| Attendance | check-in/photo/location/check-out/duration, scoped photo viewer, missing-checkout alert, Super-Admin correction |  |  |  |
| Leave / Holiday | workflows, dashboard/report effects, audit entries |  |  |  |
| Reports | filters/search, 50/100/150/200 UI pagination, full-result Excel/PDF |  |  |  |
| Dashboard | KPI/drill-down/donut/department trend, Admin branch and Super Admin organization scope |  |  |  |
| Super Admin | Audit Logs, Settings, Alerts, import preview/confirm with disposable file |  |  |  |
| UI | Light/Dark, logins, official logo/mark, 1440/1024/768/600/430/390/375px |  |  |  |

### Production-only boundary

**PRODUCTION CONFIG REQUIRED:** approved DNS/domain/SSL, host/proxy and `TRUST_PROXY_HOPS`, production MySQL/JWT/Cloudinary/SMTP secrets, CORS origin, authenticated legacy-photo migration decision, host cleanup schedule, encrypted backup destination/retention, staging restore drill, uptime monitoring, mail-domain authentication and real reset-email delivery, and final production smoke testing.

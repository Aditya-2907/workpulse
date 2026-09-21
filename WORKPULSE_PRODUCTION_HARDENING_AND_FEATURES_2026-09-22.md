# WorkPulse Production Hardening & Features

## 1. Executive Summary

**Status: IN PROGRESS.** This is the authoritative ledger for the 22-09-2026 production-hardening phase. It begins from a stable single-organization WorkPulse implementation with the Day-1 audit, post-security regression, and attendance-photo UI work preserved. No production service, backup, or supplied SQL dump will be modified.

## Implementation Progress

- [~] Baseline and safety inventory
- [ ] 90-day photo retention operationalization
- [ ] Rate limiting
- [ ] HTTP security headers
- [ ] Attendance photo privacy
- [ ] Backup/restore tooling
- [ ] Logging, error handling, monitoring readiness
- [ ] Expanded audit logging and Audit Logs UI
- [ ] Below-70% attendance alert
- [ ] Missing checkout alert
- [ ] Attendance correction
- [ ] Bulk employee import
- [ ] Organization settings and Alert Center
- [ ] Reporting enhancements
- [ ] Optional authorized attendance device foundation
- [ ] Demo-data dry-run tool
- [ ] Production preflight and deployment runbook
- [ ] Targeted regression and final evidence

## 2. Baseline Before This Phase

- Existing Day-1 audit, security hardening, forced-password flow, server-authoritative IST attendance time, scoped photo viewer, and current UI changes are preserved.
- Working tree is intentionally dirty with prior developer/implementation work; it will not be reset or reverted.
- Existing photo cleanup script uses a 90-day default and explicit `--execute`; no cleanup will be run in this phase.

## 3. Existing Architecture Preserved

React/Vite frontend, Express/MySQL2 backend, JWT/role middleware, branch-scoped Admin management, Super Admin organization scope, Cloudinary attendance photos, MySQL session timezone `+05:30`, and additive SQL migrations.

## Baseline Evidence

Pending: client lint/build, server syntax/health, existing focused contracts, schema/migration read-only checks.

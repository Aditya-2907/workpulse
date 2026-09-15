# WorkPulse Reports Filter QA & Fix Report

## 1. Executive Summary

The audit found **2 reproducible filter-flow bugs** and fixed both:

1. Export helpers serialized unset advanced filters as literal `null`, causing Excel/PDF exports to fail validation after a normal report generation.
2. Changing Role could leave a previously selected Employee ID active; the employee list did not narrow by Role and stale selections were not reset.

No attendance-rule, precedence, routing, or authorization regression was found. Live JSON, Excel, PDF, validation, summary-consistency, and Admin branch-isolation checks passed. The authenticated runner recorded 18 PASS, 0 FAIL, and 7 NOT RUN cases (the latter were fixture-dependent statuses or Admin-token coverage). Browser click-through/mobile checks and some data-dependent filter cases remain manual or not run.

## 2. Existing Filter Architecture

`Reports.jsx` keeps draft controls in React state. `api.js` serializes the current values into query parameters. The backend authenticates and applies existing branch-scoped attendance normalization first, then validates/applies advanced filters, recalculates summary metrics from the filtered rows, and uses that same result for JSON, Excel, and PDF.

## 3. Filter Contract

| Filter | UI Value | Query Param | Backend Type | Default |
| --- | --- | --- | --- | --- |
| Start Date | `YYYY-MM-DD` | `startDate` | validated date string | current month start |
| End Date | `YYYY-MM-DD` | `endDate` | validated date string | today |
| Branch | `""` or numeric ID | `branchId` | positive integer; ignored for Admin | All Branches |
| Department | `""` or numeric ID | `departmentId` | positive integer | All Departments |
| Employee | `""` or numeric ID | `employeeId` | positive integer | All Employees |
| Status | `""`, `FULL_DAY`, etc. | `status` | canonical status enum | All Statuses |
| Role | `""`, `EMPLOYEE`, `ADMIN` | `role` | allowed role enum | All Roles |
| Late | `""`, `LATE`, `NOT_LATE` | `late` | canonical flag filter | All |
| Early Departure | `""`, `EARLY`, `NOT_EARLY` | `early` | canonical flag filter | All |
| Minimum Attendance % | empty or number | `minAttendancePercent` | number 0–100 | empty |
| Maximum Attendance % | empty or number | `maxAttendancePercent` | number 0–100 | empty |
| Minimum Worked Minutes | empty or integer | `minWorkedMinutes` | non-negative integer | empty |
| Maximum Worked Minutes | empty or integer | `maxWorkedMinutes` | non-negative integer | empty |
| Check-In From | empty or `HH:mm` | `checkInFrom` | validated time | empty |
| Check-In To | empty or `HH:mm` | `checkInTo` | validated time | empty |
| Employee Search | trimmed text | `searchEmployee` | case-insensitive post-filter | empty |

Unset values are omitted from requests; `null` is never serialized.

## 4. Bugs Found

| Bug ID | Severity | Area | Problem | Root Cause | Status |
| --- | --- | --- | --- | --- | --- |
| BUG-01 | HIGH | Excel/PDF export | Exporting a normally generated report sent `role=null`, `minAttendancePercent=null`, etc. and returned 400 | API helper treated `null` as a serializable value | FIXED |
| BUG-02 | MEDIUM | Employee dependency | Changing Role could keep an incompatible selected Employee ID and submit stale filtering | Employee options ignored Role and selection reset only handled Branch/Department | FIXED |

## 5. Fixes Applied

- BUG-01: all report JSON/Excel/PDF query helpers now append only values that are neither `undefined`, `null`, nor empty. Reproduction returned Excel 400 before the fix; the same generated-filter export returns 200 after the fix.
- BUG-02: Employee options now filter by Branch, Department, and Role. A small validity effect clears `employeeId` whenever the selected employee is no longer eligible; changing Role explicitly clears it as well.
- Backend worked-minute validation now requires non-negative integers, matching the UI contract.

## 6. Dependent Filter Verification

- Branch → Department: departments are global in the current schema (no branch foreign key), so changing branch does not create an invalid department ID.
- Branch/Department/Role → Employee: options narrow by all active dependencies and stale selections reset.
- Admin dropdowns remain own-branch scoped by the existing employee API; backend authorization remains authoritative.

## 7. Basic Filter Tests

| ID | Test | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| D01-D03 | Same-day and multi-day valid ranges | 200, inclusive range | 200 live report responses | PASS |
| D04-D07 | Reversed/missing/invalid dates | Clear 400/validation | Reversed range 400; missing/invalid browser cases not separately executed | NOT RUN |
| D08-D14 | Future, historical, weekly-off, leave, holiday, absent, real attendance ranges | Correct normalized rows | Existing normalization retained; not every data case independently re-fixtured | NOT RUN |
| B01-B05 | Super Admin branch selections | All/selected branch scope | Live selected-branch report matched scope | PASS |
| B06-B09 | Admin own-branch/override/omitted/invalid branch | Own branch only | Override request returned own branch only | PASS |
| DEP01-04 | Department dependency | Valid department scope, no stale IDs | Department filter returned 200; global department model verified | PASS |
| EMP01-09 | Employee dependency changes | Invalid employee resets | Role/branch/department reset logic fixed; browser interaction not executed | NOT RUN |
| S01-S09 | Every attendance status | Rows and summary match status | Insufficient status executed; other statuses lacked suitable fixtures in this range | NOT RUN |

## 8. Advanced Filter Tests

| ID | Test | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| R01 | Role=All | All scoped rows | Base report executed | PASS |
| R02 | Role=EMPLOYEE | Only employee rows | Employee role query executed | PASS |
| R03 | Role=ADMIN | Only admin rows | No suitable Admin attendance fixture | NOT RUN |
| L01-L02 | Late All/Late | Boolean flag filtering | Base and Late queries executed; summaries matched | PASS |
| L03 | Late=Not Late | `isLate === false` | Not separately run | NOT RUN |
| E01-E02 | Early All/Early | Boolean flag filtering | Base/combined query executed | PASS |
| E03 | Early=Not Early | `isEarlyDeparture === false` | Not separately run | NOT RUN |
| P01-P05 | Percentage bounds including 0/100 | Numeric bounded filtering | 0–100 combined query executed; individual boundaries not separately run | NOT RUN |
| P09-P13 | Invalid/decimal percentage inputs | 400 where invalid | Reversed percentage returned 400; remaining variants not separately run | NOT RUN |
| W01-W07 | Worked-minute ranges including 0 | Numeric bounded filtering | Minimum 0 included in combined query; every boundary not separately run | NOT RUN |
| W08-W11 | Invalid worked ranges | 400 | Reversed range validation passed; decimal/non-numeric variants not separately run | NOT RUN |
| T01-T07 | Valid check-in ranges/boundaries | Real check-ins only | Valid full-day range included in advanced request; boundary matrix not separately run | NOT RUN |
| T08-T10 | Invalid/reversed check-in time | 400 | `25:00` returned 400; reversed-time validation implemented but not separately executed | NOT RUN |
| Q01-Q10 | Name/code/trim/case-insensitive search | Matching or valid empty report | No-match search returned 0 rows without error; positive search not run | NOT RUN |

## 9. Combination Filter Tests

| ID | Filters | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| C01-C03 | Branch/Department/Employee combinations | AND semantics | Branch/employee scope was verified in the live regression harness | PASS |
| C04-C08 | Status + Late/Early + Role combinations | AND semantics | `INSUFFICIENT_ATTENDANCE + LATE + EARLY` returned consistent rows | PASS |
| C09-C13 | Percentage/Worked/Time/Search combinations | AND semantics | Representative combined advanced request returned 200 and matching summary | PASS |
| C14-C16 | Full 5–11-filter combinations | All filters applied | Not all matrix combinations separately run | NOT RUN |

## 10. Draft vs Applied Filter Verification

Exports use the **applied/generated** report filters (`report.filters`), not unsaved draft control state. Editing controls after generation does not change the displayed report or export request until Generate Report is clicked. Clear Filters resets both the visible draft state and the generated report.

## 11. Summary Consistency Tests

For every executed base, branch, employee, status, and advanced response, `summary.totalRecords === attendanceRecords.length`. Status, Late, and Early counts are recalculated after all filters and flags remain independent.

## 12. Virtual Attendance Tests

The report continues to call the existing normalized attendance controller, preserving REAL ATTENDANCE > HOLIDAY > LEAVE > ABSENT precedence. No normalization code was duplicated or changed in this audit. A fresh exhaustive virtual-row fixture matrix was not created.

## 13. Admin Branch Security Tests

An Admin assigned to branch 1 requested branch 2. The JSON report returned `filters.branchId = 1`, and every returned row remained in branch 1. Department, employee, search, role, status, flag, numeric, and time filters are applied only after this authorized scope.

## 14. Invalid Input Tests

Executed: reversed dates (400), reversed percentage/worked ranges (400), invalid time `25:00` (400), invalid role/status (400), and malformed branch/department/employee IDs (400). Errors were JSON 400 responses without SQL or stack-trace leakage. The reusable runner covers these cases with an owner-provided disposable token.

## 15. JSON / Web / Excel / PDF Consistency

For the same `late=LATE` filter over `2026-09-12` to `2026-09-13`:

- JSON rows: 3.
- JSON summary total: 3.
- Web table: same JSON dataset (client renders `attendanceRecords`).
- Excel data rows: 3 (4 rows including header).
- PDF detail rows: 3, confirmed from generated PDF text.

The same filter metadata and summary are supplied to all exports.

## 16. Excel Regression

- Sheet 1: `Report Summary`.
- Sheet 2: `Attendance Data`.
- Data headers are row 1; records begin row 2.
- Freeze configuration: `Attendance Data.views[0].ySplit = 1`.
- No `A25`/metadata freeze remains.
- ExcelJS reopened the workbook successfully.

## 17. PDF Regression

- Authenticated endpoint returned 200.
- Content-Type: `application/pdf`.
- Filename included the selected date range.
- Output began with `%PDF-` and was processed by `pdftotext`.
- Landscape A4, page footer, repeated headers, and filtered rows are implemented.
- Unauthenticated PDF returned 401.

## 18. Sensitive Data Audit

Report JSON, Excel, and PDF paths do not select or render password, `password_hash`, JWT/token, `token_version`, Aadhaar, PAN, or hash fields. Generated workbook headers were scanned and contained none of these terms.

## 19. Build & Syntax Tests

- `npm.cmd run build`: PASS.
- `node --check server/src/controllers/reportController.js`: PASS.
- `node --check server/src/routes/reportRoutes.js`: PASS.
- `node --check server/src/controllers/attendanceController.js`: PASS.
- API health endpoint: PASS (200).
- JSON/Excel/PDF unauthenticated checks: PASS (401).

## 20. Automated Tests Added

Added `server/scripts/test-reports-filters.js`. Authenticated execution covered base/status (where fixtures existed), advanced, representative combinations, invalid percent/worked/time/role/status/ID inputs, Excel, and PDF; missing status fixtures are reported as NOT RUN.

Run from `server` with an owner-provided disposable token:

```text
REPORT_TEST_TOKEN=<temporary-token> node scripts/test-reports-filters.js
```

Without a token it still runs unauthenticated checks and clearly labels authenticated cases `NOT RUN`; it never contains hardcoded credentials or JWTs.

## 21. Manual Browser Checks Required

Browser automation was unavailable. Manually verify:

1. Basic filter changes followed by Generate Report.
2. Advanced Filters expand/collapse without losing values.
3. Branch → Department behavior.
4. Department/Role → Employee narrowing and stale-selection reset.
5. Clear Filters visibly clears all controls and generated data.
6. Generate loading/error/no-data states.
7. Excel export after editing but before regenerating (must export applied report).
8. PDF export and page layout.
9. 375px, 390px, 430px, 768px, and desktop layouts.

## 22. Known Issues

- Several status and advanced boundary cases lack suitable local fixture data and were not individually executed.
- Browser visual/mobile and click-through checks remain pending.
- The reusable runner requires a temporary owner-provided token for authenticated execution; no credentials are committed.

## 23. Final Verdict

**REPORT FILTERS VERIFIED WITH MANUAL CHECKS PENDING**

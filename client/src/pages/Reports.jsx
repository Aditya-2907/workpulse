import { useEffect, useMemo, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";
import {
    exportAttendanceReportExcel, exportAttendanceReportPdf, getAdmins,
    getAttendanceReport, getBranches, getDepartments, getEmployees,
} from "../services/api";
import { formatAttendanceTime, formatWorkedDuration } from "../utils/attendanceDisplay";

const PAGE_SIZES = [50, 100, 150, 200];
const STATUS_OPTIONS = ["FULL_DAY", "PARTIAL_DAY", "INSUFFICIENT_ATTENDANCE", "ABSENT", "LEAVE", "HOLIDAY", "INCOMPLETE", "PENDING"];
const labelFor = (value) => String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
const toDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const initialFilters = () => {
    const today = new Date();
    return { startDate: toDate(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: toDate(today), branchId: "", departmentId: "", employeeId: "", status: "", role: "", late: "", early: "", minAttendancePercent: "", maxAttendancePercent: "", minWorkedMinutes: "", maxWorkedMinutes: "", checkInFrom: "", checkInTo: "", searchEmployee: "" };
};
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export default function Reports() {
    const user = JSON.parse(sessionStorage.getItem("managementUser") || "{}");
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const [filters, setFilters] = useState(initialFilters);
    const [branches, setBranches] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [report, setReport] = useState(null);
    const [loadingLookups, setLoadingLookups] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [exporting, setExporting] = useState("");
    const [error, setError] = useState("");
    const [validationError, setValidationError] = useState("");
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const loadLookups = async () => {
            try {
                setLoadingLookups(true);
                const requests = [getDepartments(), getEmployees()];
                if (isSuperAdmin) requests.push(getBranches(), getAdmins());
                const results = await Promise.all(requests);
                setDepartments((results[0].departments || []).filter((item) => item.status === "ACTIVE"));
                const employeeRows = results[1].employees || [];
                if (isSuperAdmin) {
                    setBranches((results[2]?.branches || []).filter((item) => item.status === "ACTIVE"));
                    setEmployees([...employeeRows, ...(results[3]?.admins || [])]);
                } else {
                    setEmployees([...employeeRows, { id: user.id, employeeCode: user.employeeCode || "ADMIN", fullName: user.fullName, role: "ADMIN", branchId: user.branchId }]);
                }
            } catch (lookupError) {
                setError(lookupError.message || "Failed to load report filters");
            } finally {
                setLoadingLookups(false);
            }
        };
        loadLookups();
    }, [isSuperAdmin, user.id, user.branchId, user.fullName, user.employeeCode]);

    const selectableEmployees = useMemo(() => employees.filter((employee) => {
        if (isSuperAdmin && filters.branchId && String(employee.branchId) !== String(filters.branchId)) return false;
        if (filters.departmentId && String(employee.departmentId) !== String(filters.departmentId)) return false;
        if (filters.role && employee.role !== filters.role) return false;
        return true;
    }), [employees, filters.branchId, filters.departmentId, filters.role, isSuperAdmin]);
    const searchedEmployees = useMemo(() => {
        const search = employeeSearch.trim().toLowerCase();
        return search ? selectableEmployees.filter((employee) => [employee.fullName, employee.employeeCode].some((value) => String(value || "").toLowerCase().includes(search))) : selectableEmployees;
    }, [employeeSearch, selectableEmployees]);

    const updateFilter = ({ target: { name, value } }) => {
        setCurrentPage(1);
        setFilters((current) => ({ ...current, [name]: value, ...( ["branchId", "departmentId", "role"].includes(name) ? { employeeId: "" } : {}) }));
    };
    const generateReport = async (event) => {
        event.preventDefault();
        if (!validDate(filters.startDate) || !validDate(filters.endDate) || filters.startDate > filters.endDate) {
            setValidationError("Choose a valid date range with the start date on or before the end date.");
            return;
        }
        try {
            setLoadingReport(true); setError(""); setValidationError("");
            const response = await getAttendanceReport(filters);
            setReport({ summary: response.summary || {}, records: response.attendanceRecords || [], filters: response.filters || filters });
            setCurrentPage(1);
        } catch (requestError) {
            setReport(null); setError(requestError.message || "Failed to generate report");
        } finally { setLoadingReport(false); }
    };
    const clearFilters = () => { setFilters(initialFilters()); setEmployeeSearch(""); setReport(null); setError(""); setValidationError(""); setPageSize(50); setCurrentPage(1); };
    const exportReport = async (type) => {
        if (!report?.records?.length || exporting) return;
        try {
            setExporting(type); setError("");
            const result = type === "pdf" ? await exportAttendanceReportPdf(report.filters) : await exportAttendanceReportExcel(report.filters);
            const url = URL.createObjectURL(result.blob);
            const anchor = document.createElement("a");
            anchor.href = url; anchor.download = result.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
        } catch (exportError) { setError(exportError.message || `Failed to export ${type.toUpperCase()} report`); } finally { setExporting(""); }
    };

    const records = report?.records || [];
    const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
    const page = Math.min(currentPage, totalPages);
    const first = records.length ? ((page - 1) * pageSize) + 1 : 0;
    const last = Math.min(page * pageSize, records.length);
    const visibleRecords = records.slice(first - 1, last);
    const summaryCards = [["Total records", report?.summary?.totalRecords], ["Full day", report?.summary?.fullDay], ["Partial day", report?.summary?.partialDay], ["Absent", report?.summary?.absent], ["Leave", report?.summary?.leave], ["Late", report?.summary?.late]];

    return <ManagementLayout><div className="management-page reports-page">
        <header className="management-page-header reports-page-header"><div><span className="dashboard-eyebrow">REPORTING</span><h1>Attendance Reports</h1><p>Generate, review and export workforce attendance reports.</p></div></header>
        {error && <div className="management-error" role="alert">{error}</div>}
        {validationError && <div className="management-error" role="alert">{validationError}</div>}
        <form className="management-form-card reports-filter-card" onSubmit={generateReport}>
            <div className="reports-section-heading"><div><h3>Report filters</h3><p>Choose a date range and optional workforce filters.</p></div>{loadingLookups && <span className="reports-loading-note">Loading filters…</span>}</div>
            <div className="management-form-grid">
                <div className="management-form-group"><label htmlFor="report-start">Start date</label><input id="report-start" type="date" name="startDate" value={filters.startDate} onChange={updateFilter} required /></div>
                <div className="management-form-group"><label htmlFor="report-end">End date</label><input id="report-end" type="date" name="endDate" value={filters.endDate} onChange={updateFilter} required /></div>
                {isSuperAdmin ? <div className="management-form-group"><label htmlFor="report-branch">Branch</label><select id="report-branch" name="branchId" value={filters.branchId} onChange={updateFilter}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} — {branch.branchName}</option>)}</select></div> : <div className="management-form-group"><label>Branch</label><input value="Your assigned branch" readOnly /></div>}
                <div className="management-form-group"><label htmlFor="report-department">Department</label><select id="report-department" name="departmentId" value={filters.departmentId} onChange={updateFilter}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.departmentCode ? `${department.departmentCode} — ` : ""}{department.departmentName}</option>)}</select></div>
                <div className="management-form-group report-employee-filter"><label htmlFor="report-employee-search">Find employee</label><input id="report-employee-search" type="search" value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search name or employee code" /><label htmlFor="report-employee">Employee</label><select id="report-employee" name="employeeId" value={filters.employeeId} onChange={updateFilter}><option value="">All employees</option>{searchedEmployees.map((employee) => <option key={`${employee.role}-${employee.id}`} value={employee.id}>{employee.employeeCode || "N/A"} — {employee.fullName}</option>)}</select></div>
                <div className="management-form-group"><label htmlFor="report-status">Attendance status</label><select id="report-status" name="status" value={filters.status} onChange={updateFilter}><option value="">All statuses</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}</select></div>
            </div>
            <details className="reports-advanced-panel"><summary>More filter options</summary><div className="management-form-grid reports-advanced-grid">
                <div className="management-form-group"><label htmlFor="report-role">Role</label><select id="report-role" name="role" value={filters.role} onChange={updateFilter}><option value="">All roles</option><option value="EMPLOYEE">Employee</option><option value="ADMIN">Admin</option></select></div>
                <div className="management-form-group"><label htmlFor="report-late">Late status</label><select id="report-late" name="late" value={filters.late} onChange={updateFilter}><option value="">All</option><option value="LATE">Late only</option><option value="NOT_LATE">Not late</option></select></div>
                <div className="management-form-group"><label htmlFor="report-early">Early departure</label><select id="report-early" name="early" value={filters.early} onChange={updateFilter}><option value="">All</option><option value="EARLY">Early departure only</option><option value="NOT_EARLY">Not early</option></select></div>
                <div className="management-form-group"><label htmlFor="report-min-percent">Minimum attendance %</label><input id="report-min-percent" type="number" min="0" max="100" name="minAttendancePercent" value={filters.minAttendancePercent} onChange={updateFilter} /></div>
                <div className="management-form-group"><label htmlFor="report-max-percent">Maximum attendance %</label><input id="report-max-percent" type="number" min="0" max="100" name="maxAttendancePercent" value={filters.maxAttendancePercent} onChange={updateFilter} /></div>
                <div className="management-form-group"><label htmlFor="report-min-work">Minimum worked minutes</label><input id="report-min-work" type="number" min="0" name="minWorkedMinutes" value={filters.minWorkedMinutes} onChange={updateFilter} /></div>
                <div className="management-form-group"><label htmlFor="report-max-work">Maximum worked minutes</label><input id="report-max-work" type="number" min="0" name="maxWorkedMinutes" value={filters.maxWorkedMinutes} onChange={updateFilter} /></div>
                <div className="management-form-group"><label htmlFor="report-check-from">Check-in from</label><input id="report-check-from" type="time" name="checkInFrom" value={filters.checkInFrom} onChange={updateFilter} /></div>
                <div className="management-form-group"><label htmlFor="report-check-to">Check-in to</label><input id="report-check-to" type="time" name="checkInTo" value={filters.checkInTo} onChange={updateFilter} /></div>
                <div className="management-form-group"><label htmlFor="report-search">Search returned employee</label><input id="report-search" type="search" name="searchEmployee" value={filters.searchEmployee} onChange={updateFilter} placeholder="Name or code" /></div>
            </div></details>
            <div className="management-form-actions reports-form-actions"><button type="submit" className="management-primary-button" disabled={loadingReport || loadingLookups}>{loadingReport ? "Generating…" : "Generate report"}</button><button type="button" className="management-secondary-button" onClick={clearFilters} disabled={loadingReport}>Clear filters</button></div>
        </form>
        {!report && !loadingReport && <div className="management-empty-state reports-empty-state"><strong>Your report will appear here.</strong><span>Select filters, then generate a report to review or export the full result set.</span></div>}
        {loadingReport && <div className="management-empty-state reports-empty-state" aria-live="polite">Generating attendance report…</div>}
        {report && <>
            <section className="reports-results-header"><div><span className="dashboard-eyebrow">GENERATED REPORT</span><h2>Attendance summary</h2><p>{records.length ? `${records.length} matching record${records.length === 1 ? "" : "s"} from ${report.filters.startDate} to ${report.filters.endDate}.` : "No matching attendance records."}</p></div><div className="reports-export-actions"><span>Export all {records.length} records</span><button type="button" className="management-secondary-button" disabled={!records.length || Boolean(exporting)} onClick={() => exportReport("excel")}>{exporting === "excel" ? "Exporting…" : "Excel"}</button><button type="button" className="management-secondary-button" disabled={!records.length || Boolean(exporting)} onClick={() => exportReport("pdf")}>{exporting === "pdf" ? "Exporting…" : "PDF"}</button></div></section>
            <div className="attendance-summary-grid reports-summary-grid">{summaryCards.map(([label, value]) => <div className="attendance-summary-card" key={label}><span>{label}</span><strong>{value || 0}</strong></div>)}</div>
            <section className="management-table-card reports-results-card"><div className="management-table-header reports-table-header"><div><h3>Attendance details</h3><p>{records.length ? `Showing ${first}–${last} of ${records.length} records` : "No attendance records found."}</p></div>{records.length > 0 && <label className="reports-page-size">Records per page<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>}</div>
                {!records.length ? <div className="management-empty-state">No attendance records found for the selected filters.</div> : <><div className="management-table-wrapper"><table className="management-table reports-table"><thead><tr><th>Date</th><th>Employee</th><th>Role</th><th>Branch</th><th>Department</th><th>Designation</th><th>Duty time</th><th>Check in</th><th>Check out</th><th>Worked</th><th>Attendance %</th><th>Status</th><th>Late</th><th>Early departure</th><th>Remarks</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={`${record.id}-${record.userId}-${record.attendanceDate}`}><td>{record.attendanceDate || "--"}</td><td><strong>{record.fullName || "--"}</strong><div className="management-table-subtext">{record.employeeCode || "--"}</div></td><td>{labelFor(record.role)}</td><td>{record.branchName || "--"}<div className="management-table-subtext">{record.branchCode || ""}</div></td><td>{record.departmentName || "--"}</td><td>{record.designation || "--"}</td><td>{formatAttendanceTime(record.dutyStartTime)} – {formatAttendanceTime(record.dutyEndTime)}</td><td>{formatAttendanceTime(record.checkInTimeLocal || record.checkInTime)}</td><td>{formatAttendanceTime(record.checkOutTimeLocal || record.checkOutTime)}</td><td>{formatWorkedDuration(record.workedMinutes)}</td><td>{record.attendancePercentage === null || record.attendancePercentage === undefined ? "--" : `${Number(record.attendancePercentage).toFixed(2)}%`}</td><td><span className={`report-status-badge status-${String(record.attendanceStatus || "pending").toLowerCase()}`}>{labelFor(record.attendanceStatus)}</span></td><td>{record.isLate ? "Yes" : "No"}</td><td>{record.isEarlyDeparture ? "Yes" : "No"}</td><td>{record.checkOutRemarks || record.checkInRemarks || record.leaveReason || record.holidayPurpose || "--"}</td></tr>)}</tbody></table></div><nav className="reports-pagination" aria-label="Attendance report pages"><span>Page {page} of {totalPages}</span><div><button type="button" className="management-secondary-button" disabled={page <= 1} onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}>Previous</button><button type="button" className="management-secondary-button" disabled={page >= totalPages} onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}>Next</button></div></nav></>}
            </section>
        </>}
    </div></ManagementLayout>;
}

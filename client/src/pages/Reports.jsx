import React, { useEffect, useMemo, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";
import {
    exportAttendanceReportExcel,
    exportAttendanceReportPdf,
    getAdmins,
    getAttendanceReport,
    getBranches,
    getDepartments,
    getEmployees,
} from "../services/api";

const STATUS_OPTIONS = ["FULL_DAY", "PARTIAL_DAY", "INSUFFICIENT_ATTENDANCE", "ABSENT", "LEAVE", "HOLIDAY", "INCOMPLETE", "PENDING"];
const labelFor = (value) => String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());

const toDateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthDefaults = () => { const today = new Date(); return { startDate: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: toDateInput(today) }; };
const initialFilters = () => ({ ...monthDefaults(), branchId: "", departmentId: "", employeeId: "", status: "", role: "", late: "", early: "", minAttendancePercent: "", maxAttendancePercent: "", minWorkedMinutes: "", maxWorkedMinutes: "", checkInFrom: "", checkInTo: "", searchEmployee: "" });
const isValidDateInput = (value) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false; const [year, month, day] = value.split("-").map(Number); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day; };
const formatDate = (value) => value || "--";
const formatTime = (value) => { if (!value) return "--"; const match = String(value).match(/(?:^|[T\s])(\d{2}:\d{2})/); return match ? match[1] : "--"; };
const formatWorked = (minutes) => { if (minutes === null || minutes === undefined || minutes === "") return "--"; const total = Number(minutes); return Number.isFinite(total) ? `${Math.floor(total / 60)}h ${total % 60}m` : "--"; };

const Reports = () => {
    const user = JSON.parse(sessionStorage.getItem("managementUser") || "{}");
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const [filters, setFilters] = useState(initialFilters);
    const [branches, setBranches] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [report, setReport] = useState(null);
    const [loadingLookups, setLoadingLookups] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [exporting, setExporting] = useState("");
    const [error, setError] = useState("");
    const [validationError, setValidationError] = useState("");

    useEffect(() => {
        const loadLookups = async () => {
            try {
                setLoadingLookups(true);
                const requests = [getDepartments(), getEmployees()];
                if (isSuperAdmin) requests.push(getBranches(), getAdmins());
                const results = await Promise.all(requests);
                setDepartments((results[0].departments || []).filter((department) => department.status === "ACTIVE"));
                const employeeRows = results[1].employees || [];
                if (isSuperAdmin) {
                    setEmployees([...employeeRows, ...(results[3]?.admins || [])]);
                    setBranches((results[2]?.branches || []).filter((branch) => branch.status === "ACTIVE"));
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

    const visibleEmployees = useMemo(() => employees.filter((employee) => {
        if (isSuperAdmin && filters.branchId && String(employee.branchId) !== String(filters.branchId)) return false;
        if (filters.departmentId && String(employee.departmentId) !== String(filters.departmentId)) return false;
        if (filters.role && employee.role !== filters.role) return false;
        return true;
    }), [employees, filters.branchId, filters.departmentId, filters.role, isSuperAdmin]);

    useEffect(() => {
        if (!filters.employeeId) return;
        const stillValid = visibleEmployees.some((employee) => String(employee.id) === String(filters.employeeId));
        if (!stillValid) {
            setFilters((current) => ({ ...current, employeeId: "" }));
        }
    }, [filters.employeeId, visibleEmployees]);

    const updateFilter = (event) => {
        const { name, value } = event.target;
        setFilters((current) => ({ ...current, [name]: value, ...(name === "branchId" || name === "departmentId" || name === "role" ? { employeeId: "" } : {}) }));
    };

    const validateFilters = () => {
        if (!isValidDateInput(filters.startDate) || !isValidDateInput(filters.endDate)) return "Start date and end date are required and must be valid dates.";
        if (filters.startDate > filters.endDate) return "Start date cannot be after end date.";
        const minPercent = filters.minAttendancePercent === "" ? null : Number(filters.minAttendancePercent);
        const maxPercent = filters.maxAttendancePercent === "" ? null : Number(filters.maxAttendancePercent);
        if ((minPercent !== null && (!Number.isFinite(minPercent) || minPercent < 0 || minPercent > 100)) || (maxPercent !== null && (!Number.isFinite(maxPercent) || maxPercent < 0 || maxPercent > 100)) || (minPercent !== null && maxPercent !== null && minPercent > maxPercent)) return "Attendance percentage must be between 0 and 100, with minimum no greater than maximum.";
        const minWorked = filters.minWorkedMinutes === "" ? null : Number(filters.minWorkedMinutes);
        const maxWorked = filters.maxWorkedMinutes === "" ? null : Number(filters.maxWorkedMinutes);
        if ((minWorked !== null && (!Number.isInteger(minWorked) || minWorked < 0)) || (maxWorked !== null && (!Number.isInteger(maxWorked) || maxWorked < 0)) || (minWorked !== null && maxWorked !== null && minWorked > maxWorked)) return "Worked minutes must be non-negative, with minimum no greater than maximum.";
        if (filters.checkInFrom && filters.checkInTo && filters.checkInFrom > filters.checkInTo) return "Check-in start time cannot be after end time.";
        return "";
    };

    const handleGenerate = async (event) => {
        event.preventDefault();
        const message = validateFilters();
        setValidationError(message);
        if (message) return;
        try {
            setLoadingReport(true);
            setError("");
            const response = await getAttendanceReport(filters);
            setReport({ summary: response.summary || {}, records: response.attendanceRecords || [], filters: response.filters || filters });
        } catch (reportError) {
            setReport(null);
            setError(reportError.message || "Failed to generate report");
        } finally {
            setLoadingReport(false);
        }
    };

    const handleExport = async (type) => {
        if (!report?.records?.length || exporting) return;
        try {
            setExporting(type);
            setError("");
            const result = type === "pdf" ? await exportAttendanceReportPdf(report.filters) : await exportAttendanceReportExcel(report.filters);
            const url = URL.createObjectURL(result.blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = result.filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch (exportError) {
            setError(exportError.message || `Failed to export ${type.toUpperCase()} report`);
        } finally {
            setExporting("");
        }
    };

    const clearFilters = () => {
        setFilters(initialFilters());
        setReport(null);
        setError("");
        setValidationError("");
    };

    const summary = report?.summary || {};
    const summaryCards = [["Total Records", summary.totalRecords], ["Full Day", summary.fullDay], ["Partial Day", summary.partialDay], ["Insufficient Attendance", summary.insufficientAttendance], ["Absent", summary.absent], ["Leave", summary.leave], ["Holiday", summary.holiday], ["Incomplete", summary.incomplete], ["Pending", summary.pending], ["Late", summary.late], ["Early Departure", summary.earlyDeparture]];

    return (
        <ManagementLayout>
            <div className="management-page reports-page">
                <div className="management-page-header"><div><h1>Attendance Reports</h1><p>Generate, filter, review and export workforce attendance reports.</p></div></div>
                {error && <div className="management-error" role="alert">{error}</div>}
                {validationError && <div className="management-error" role="alert">{validationError}</div>}
                <form className="management-form-card reports-filter-card" onSubmit={handleGenerate}>
                    <h3>Basic Filters</h3>
                    <div className="management-form-grid">
                        <div className="management-form-group"><label htmlFor="report-start-date">Start Date</label><input id="report-start-date" type="date" name="startDate" value={filters.startDate} onChange={updateFilter} required /></div>
                        <div className="management-form-group"><label htmlFor="report-end-date">End Date</label><input id="report-end-date" type="date" name="endDate" value={filters.endDate} onChange={updateFilter} required /></div>
                        {isSuperAdmin ? <div className="management-form-group"><label htmlFor="report-branch">Branch</label><select id="report-branch" name="branchId" value={filters.branchId} onChange={updateFilter}><option value="">All Branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.branchName}</option>)}</select></div> : <div className="management-form-group"><label>Branch</label><input value={`Own branch (#${user.branchId || "unassigned"})`} readOnly /></div>}
                        <div className="management-form-group"><label htmlFor="report-department">Department</label><select id="report-department" name="departmentId" value={filters.departmentId} onChange={updateFilter}><option value="">All Departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.departmentName}</option>)}</select></div>
                        <div className="management-form-group"><label htmlFor="report-employee">Employee</label><select id="report-employee" name="employeeId" value={filters.employeeId} onChange={updateFilter}><option value="">All Employees</option>{visibleEmployees.map((employee) => <option key={`${employee.role}-${employee.id}`} value={employee.id}>{employee.employeeCode || "N/A"} - {employee.fullName}</option>)}</select></div>
                        <div className="management-form-group"><label htmlFor="report-status">Attendance Status</label><select id="report-status" name="status" value={filters.status} onChange={updateFilter}><option value="">All Statuses</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}</select></div>
                    </div>
                    <details className="reports-advanced-panel"><summary>Advanced Filters</summary><div className="management-form-grid reports-advanced-grid">
                        <div className="management-form-group"><label htmlFor="report-role">Role</label><select id="report-role" name="role" value={filters.role} onChange={updateFilter}><option value="">All Roles</option><option value="EMPLOYEE">Employee</option><option value="ADMIN">Admin</option></select></div>
                        <div className="management-form-group"><label htmlFor="report-late">Late Status</label><select id="report-late" name="late" value={filters.late} onChange={updateFilter}><option value="">All</option><option value="LATE">Late Only</option><option value="NOT_LATE">Not Late</option></select></div>
                        <div className="management-form-group"><label htmlFor="report-early">Early Departure</label><select id="report-early" name="early" value={filters.early} onChange={updateFilter}><option value="">All</option><option value="EARLY">Early Departure Only</option><option value="NOT_EARLY">Not Early Departure</option></select></div>
                        <div className="management-form-group"><label htmlFor="report-min-percent">Minimum %</label><input id="report-min-percent" type="number" min="0" max="100" step="0.01" name="minAttendancePercent" value={filters.minAttendancePercent} onChange={updateFilter} placeholder="0" /></div>
                        <div className="management-form-group"><label htmlFor="report-max-percent">Maximum %</label><input id="report-max-percent" type="number" min="0" max="100" step="0.01" name="maxAttendancePercent" value={filters.maxAttendancePercent} onChange={updateFilter} placeholder="100" /></div>
                        <div className="management-form-group"><label htmlFor="report-min-worked">Minimum Worked Minutes</label><input id="report-min-worked" type="number" min="0" step="1" name="minWorkedMinutes" value={filters.minWorkedMinutes} onChange={updateFilter} placeholder="0" /></div>
                        <div className="management-form-group"><label htmlFor="report-max-worked">Maximum Worked Minutes</label><input id="report-max-worked" type="number" min="0" step="1" name="maxWorkedMinutes" value={filters.maxWorkedMinutes} onChange={updateFilter} placeholder="480" /></div>
                        <div className="management-form-group"><label htmlFor="report-check-in-from">Check-In From</label><input id="report-check-in-from" type="time" name="checkInFrom" value={filters.checkInFrom} onChange={updateFilter} /></div>
                        <div className="management-form-group"><label htmlFor="report-check-in-to">Check-In To</label><input id="report-check-in-to" type="time" name="checkInTo" value={filters.checkInTo} onChange={updateFilter} /></div>
                        <div className="management-form-group"><label htmlFor="report-search">Search Employee</label><input id="report-search" type="search" name="searchEmployee" value={filters.searchEmployee} onChange={updateFilter} placeholder="Code or name" /></div>
                    </div></details>
                    <div className="management-form-actions"><button type="submit" className="management-primary-button" disabled={loadingReport || loadingLookups}>{loadingReport ? "Generating..." : "Generate Report"}</button><button type="button" className="management-secondary-button" disabled={!report?.records?.length || Boolean(exporting)} onClick={() => handleExport("excel")}>{exporting === "excel" ? "Exporting..." : "Export Excel"}</button><button type="button" className="management-secondary-button" disabled={!report?.records?.length || Boolean(exporting)} onClick={() => handleExport("pdf")}>{exporting === "pdf" ? "Exporting..." : "Export PDF"}</button><button type="button" className="management-secondary-button" onClick={clearFilters}>Clear Filters</button></div>
                </form>
                {!report ? <div className="management-empty-state reports-empty-state">Select filters and generate a report.</div> : <><div className="attendance-summary-grid reports-summary-grid">{summaryCards.map(([label, value]) => <div className="attendance-summary-card" key={label}><span>{label}</span><strong>{value || 0}</strong></div>)}</div><div className="management-table-card"><div className="management-table-header"><div><h3>Attendance Report</h3><p>{report.records.length ? `${report.records.length} record(s) found` : "No attendance records found for the selected filters."}</p></div></div>{report.records.length === 0 ? <div className="management-empty-state">No attendance records found for the selected filters.</div> : <div className="management-table-wrapper"><table className="management-table reports-table"><thead><tr><th>Date</th><th>Employee</th><th>Role</th><th>Branch</th><th>Department</th><th>Designation</th><th>Duty Time</th><th>Check In</th><th>Check Out</th><th>Worked</th><th>Attendance %</th><th>Status</th><th>Late</th><th>Early Departure</th><th>Remarks</th></tr></thead><tbody>{report.records.map((record) => <tr key={`${record.id}-${record.userId}-${record.attendanceDate}`}><td>{formatDate(record.attendanceDate)}</td><td><strong>{record.fullName || "--"}</strong><div className="management-table-subtext">{record.employeeCode || "--"}</div></td><td>{labelFor(record.role)}</td><td>{record.branchName || "--"}<div className="management-table-subtext">{record.branchCode || ""}</div></td><td>{record.departmentName || "--"}</td><td>{record.designation || "--"}</td><td>{formatTime(record.dutyStartTime)} - {formatTime(record.dutyEndTime)}</td><td>{formatTime(record.checkInTime)}</td><td>{formatTime(record.checkOutTime)}</td><td>{formatWorked(record.workedMinutes)}</td><td>{record.attendancePercentage === null || record.attendancePercentage === undefined ? "--" : `${Number(record.attendancePercentage).toFixed(2)}%`}</td><td>{labelFor(record.attendanceStatus)}</td><td>{record.isLate ? "Yes" : "No"}</td><td>{record.isEarlyDeparture ? "Yes" : "No"}</td><td>{record.checkOutRemarks || record.checkInRemarks || record.leaveReason || record.holidayPurpose || "--"}</td></tr>)}</tbody></table></div>}</div></>}
            </div>
        </ManagementLayout>
    );
};

export default Reports;

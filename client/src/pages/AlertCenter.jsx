import { useEffect, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";
import { getManagementAlerts } from "../services/api";

const percent = (value) => `${Number(value || 0).toFixed(2)}%`;

export default function AlertCenter() {
    const [alerts, setAlerts] = useState(null);
    const [error, setError] = useState("");
    useEffect(() => { getManagementAlerts().then((data) => setAlerts(data.alerts)).catch((loadError) => setError(loadError.message || "Unable to load alerts")); }, []);
    return <ManagementLayout><div className="management-page">
        <header className="management-page-header"><div><span className="dashboard-eyebrow">OPERATIONS</span><h1>Alert Center</h1><p>Current-month attendance and incomplete attendance alerts.</p></div></header>
        {error && <div className="management-error" role="alert">{error}</div>}
        {!alerts && !error && <div className="management-empty-state">Loading alerts…</div>}
        {alerts && <>
            <section className="attendance-summary-grid"><div className="attendance-summary-card"><span>Open alerts</span><strong>{alerts.totalCount}</strong></div><div className="attendance-summary-card"><span>Below {alerts.belowThreshold.threshold}%</span><strong>{alerts.belowThreshold.employees.length}</strong></div><div className="attendance-summary-card"><span>Missing checkout</span><strong>{alerts.missingCheckout.records.length}</strong></div>{alerts.pendingAdminRequests !== undefined && <div className="attendance-summary-card"><span>Pending Admin requests</span><strong>{alerts.pendingAdminRequests}</strong></div>}</section>
            <section className="management-table-card"><div className="management-table-header"><div><h3>Employees below {alerts.belowThreshold.threshold}%</h3><p>Month-to-date rate: attended eligible working days ÷ eligible working days. Holidays, branch weekly offs and approved leave are excluded; exactly 70% is not listed.</p></div></div>{alerts.belowThreshold.employees.length ? <div className="management-table-wrapper"><table className="management-table"><thead><tr><th>Employee</th><th>Branch</th><th>Department</th><th>Present days</th><th>Eligible days</th><th>Rate</th></tr></thead><tbody>{alerts.belowThreshold.employees.map((item) => <tr key={item.userId}><td><strong>{item.fullName}</strong><div className="management-table-subtext">{item.employeeCode || "—"}</div></td><td>{item.branchName}</td><td>{item.departmentName || "—"}</td><td>{item.presentDays}</td><td>{item.eligibleDays}</td><td>{percent(item.attendanceRate)}</td></tr>)}</tbody></table></div> : <div className="management-empty-state">No employees are below the configured attendance threshold.</div>}</section>
            <section className="management-table-card"><div className="management-table-header"><div><h3>Missing checkout</h3><p>Prior-day incomplete records and today’s records only after duty end plus the configured grace period.</p></div></div>{alerts.missingCheckout.records.length ? <div className="management-table-wrapper"><table className="management-table"><thead><tr><th>Date</th><th>Employee</th><th>Branch</th><th>Check in</th><th>Duty end</th></tr></thead><tbody>{alerts.missingCheckout.records.map((item) => <tr key={item.attendanceRecordId}><td>{String(item.attendanceDate).slice(0, 10)}</td><td><strong>{item.fullName}</strong><div className="management-table-subtext">{item.employeeCode || "—"}</div></td><td>{item.branchName}</td><td>{item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td>{item.dutyEndTime || "—"}</td></tr>)}</tbody></table></div> : <div className="management-empty-state">No missing checkout alerts.</div>}</section>
        </>}
    </div></ManagementLayout>;
}

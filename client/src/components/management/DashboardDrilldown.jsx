import { useEffect, useRef, useState } from "react";
import { getDashboardDrilldown } from "../../services/api";

const labels = {
    PRESENT: "Present",
    LATE: "Late",
    LEAVE: "On Leave",
    ABSENT: "Absent",
};

export default function DashboardDrilldown({ type, count, icon, description }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [records, setRecords] = useState([]);
    const triggerRef = useRef(null);
    const closeButtonRef = useRef(null);
    const label = labels[type];
    const employeeCount = Number.isFinite(Number(count)) ? Number(count) : 0;

    useEffect(() => {
        if (open) closeButtonRef.current?.focus();
    }, [open]);

    const closeDrilldown = () => {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    const openDrilldown = async () => {
        setOpen(true);
        setLoading(true);
        setError("");
        try {
            const response = await getDashboardDrilldown(type);
            setRecords(response.data?.records || []);
        } catch (requestError) {
            setError(requestError.message || "Unable to load employees");
        } finally {
            setLoading(false);
        }
    };

    return <>
        <button
            ref={triggerRef}
            type="button"
            className="dashboard-stat-card dashboard-kpi-card dashboard-drilldown-button"
            onClick={openDrilldown}
            aria-label={`View ${employeeCount} ${label} employees`}
        >
            <span className="stat-card-top">
                <span className="stat-icon" aria-hidden="true">{icon}</span>
                <span className="stat-badge">Today</span>
            </span>
            <span className="dashboard-kpi-label">{label}</span>
            <strong className="dashboard-kpi-value">{employeeCount}</strong>
            <span className="stat-description">{description || `View ${label.toLowerCase()} employees`}</span>
            <span className="dashboard-kpi-action" aria-hidden="true">View employees <span>→</span></span>
        </button>
        {open && <div className="management-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDrilldown();
        }}>
            <section className="management-password-modal dashboard-drilldown-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-drilldown-title" onKeyDown={(event) => {
                if (event.key === "Escape") closeDrilldown();
            }}>
                <div className="dashboard-panel-header dashboard-drilldown-header"><div><h3 id="dashboard-drilldown-title">{label} Today</h3><p>{employeeCount} employee{employeeCount === 1 ? "" : "s"} in this dashboard count.</p></div><button ref={closeButtonRef} type="button" className="management-secondary-button" onClick={closeDrilldown}>Close</button></div>
                <div className="dashboard-drilldown-content" aria-live="polite">
                    {loading && <p className="dashboard-drilldown-status">Loading employees...</p>}
                    {error && <div className="management-error-message" role="alert">{error}</div>}
                    {!loading && !error && (records.length === 0 ? <div className="management-empty-state">No employees are in this group.</div> : <div className="management-table-wrapper"><table className="management-table"><thead><tr><th>Employee</th><th>Branch</th><th>Department</th><th>Designation</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><strong>{record.fullName}</strong><div className="management-table-subtext">{record.employeeCode || "--"}</div></td><td>{record.branchName || "--"}<div className="management-table-subtext">{record.branchCode || ""}</div></td><td>{record.departmentName || "--"}</td><td>{record.designation || "--"}</td></tr>)}</tbody></table></div>)}
                </div>
            </section>
        </div>}
    </>;
}

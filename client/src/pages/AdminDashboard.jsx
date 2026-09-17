import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagementLayout from "../components/management/ManagementLayout";
import { getAdminDashboard } from "../services/api";

function AdminDashboard() {
    const navigate = useNavigate();

    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const user = JSON.parse(
        sessionStorage.getItem("managementUser") || "{}"
    );

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await getAdminDashboard();

                setDashboardData(response.data);
            } catch (err) {
                setError(
                    err.message || "Failed to load dashboard data"
                );
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    const branch = dashboardData?.branch || null;

    const totals = dashboardData?.totals || {
        employees: 0,
        presentToday: 0,
    };

    const attendance = dashboardData?.attendance || {
        present: 0,
        late: 0,
        leave: 0,
        absent: 0,
    };

    return (
        <ManagementLayout>
            <section className="dashboard-welcome-section">
                <div>
                    <span className="dashboard-eyebrow">
                        ADMIN PORTAL
                    </span>

                    <h2>Branch Workforce Overview</h2>

                    <p>
                        Welcome, {user.fullName || "Admin"}
                        {branch?.name
                            ? ` — ${branch.name}`
                            : ""}
                    </p>
                </div>
            </section>

            {loading && (
                <div className="dashboard-panel">
                    Loading dashboard data...
                </div>
            )}

            {error && (
                <div className="dashboard-panel">
                    <strong>
                        Failed to load dashboard:
                    </strong>{" "}
                    {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    {branch && (
                        <section className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <div>
                                    <h3>{branch.name}</h3>

                                    <p>
                                        Branch Code:{" "}
                                        {branch.code || "-"}
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="dashboard-stat-grid">
                        <div className="dashboard-stat-card">
                            <div className="stat-card-top">
                                <span className="stat-icon">
                                    ♟
                                </span>

                                <span className="stat-badge">
                                    Workforce
                                </span>
                            </div>

                            <p>Total Employees</p>

                            <h3>
                                {totals.employees}
                            </h3>

                            <span className="stat-description">
                                Active employees in your branch
                            </span>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="stat-card-top">
                                <span className="stat-icon">
                                    ✓
                                </span>

                                <span className="stat-badge">
                                    Today
                                </span>
                            </div>

                            <p>Present Today</p>

                            <h3>
                                {totals.presentToday}
                            </h3>

                            <span className="stat-description">
                                Employees checked in today
                            </span>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="stat-card-top">
                                <span className="stat-icon">
                                    ◷
                                </span>

                                <span className="stat-badge">
                                    Today
                                </span>
                            </div>

                            <p>Late Today</p>

                            <h3>
                                {attendance.late}
                            </h3>

                            <span className="stat-description">
                                Late arrivals in your branch
                            </span>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="stat-card-top">
                                <span className="stat-icon">
                                    ○
                                </span>

                                <span className="stat-badge">
                                    Today
                                </span>
                            </div>

                            <p>On Leave</p>

                            <h3>
                                {attendance.leave}
                            </h3>

                            <span className="stat-description">
                                Employees on approved leave
                            </span>
                        </div>
                    </section>

                    <section className="dashboard-grid">
                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <div>
                                    <h3>
                                        Today's Attendance
                                    </h3>

                                    <p>
                                        Attendance summary for{" "}
                                        {branch?.name ||
                                            "your branch"}
                                    </p>
                                </div>
                            </div>

                            <div className="attendance-summary-list">
                                <div className="attendance-summary-item">
                                    <div>
                                        <span className="summary-dot"></span>
                                        Present
                                    </div>

                                    <strong>
                                        {attendance.present}
                                    </strong>
                                </div>

                                <div className="attendance-summary-item">
                                    <div>
                                        <span className="summary-dot"></span>
                                        Late
                                    </div>

                                    <strong>
                                        {attendance.late}
                                    </strong>
                                </div>

                                <div className="attendance-summary-item">
                                    <div>
                                        <span className="summary-dot"></span>
                                        Leave
                                    </div>

                                    <strong>
                                        {attendance.leave}
                                    </strong>
                                </div>

                                <div className="attendance-summary-item">
                                    <div>
                                        <span className="summary-dot"></span>
                                        Absent
                                    </div>

                                    <strong>
                                        {attendance.absent}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <div>
                                    <h3>Quick Actions</h3>

                                    <p>
                                        Common branch management
                                        operations
                                    </p>
                                </div>
                            </div>

                            <div className="quick-actions-grid">
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            "/admin/employees"
                                        )
                                    }
                                >
                                    <span>♟</span>
                                    Employees
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            "/admin/attendance"
                                        )
                                    }
                                >
                                    <span>✓</span>
                                    Attendance
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            "/admin/leaves"
                                        )
                                    }
                                >
                                    <span>▤</span>
                                    Leaves
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            "/admin/reports"
                                        )
                                    }
                                >
                                    <span>▤</span>
                                    Reports
                                </button>
                            </div>
                        </div>
                    </section>
                </>
            )}
        </ManagementLayout>
    );
}

export default AdminDashboard;
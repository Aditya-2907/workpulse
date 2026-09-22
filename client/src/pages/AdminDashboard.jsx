import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagementLayout from "../components/management/ManagementLayout";
import { getAdminDashboard } from "../services/api";
import DashboardDrilldown from "../components/management/DashboardDrilldown";
import DashboardCharts from "../components/management/DashboardCharts";

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
                        <section className="dashboard-panel admin-dashboard-branch-info">
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

                        <DashboardDrilldown type="PRESENT" count={attendance.present} icon="✓" description="Employees checked in today" />

                        <DashboardDrilldown type="LATE" count={attendance.late} icon="◷" description="Late arrivals in your branch" />

                        <DashboardDrilldown type="LEAVE" count={attendance.leave} icon="○" description="Employees on approved leave" />

                        <DashboardDrilldown type="ABSENT" count={attendance.absent} icon="−" description="Employees absent today" />
                    </section>

                    <DashboardCharts
                        attendance={attendance}
                        analytics={dashboardData?.analytics}
                        totalEmployees={totals.employees}
                    />

                    <section className="dashboard-grid dashboard-quick-actions-only">
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

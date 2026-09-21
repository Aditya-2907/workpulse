import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ManagementLayout from "../components/management/ManagementLayout";
import { getSuperAdminDashboard } from "../services/api";
import DashboardDrilldown from "../components/management/DashboardDrilldown";
import DashboardCharts from "../components/management/DashboardCharts";

const SuperAdminDashboard = () => {
    const navigate = useNavigate();

    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await getSuperAdminDashboard();

                setDashboardData(response.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    const totals = dashboardData?.totals || {
        branches: 0,
        admins: 0,
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
                        SUPER ADMIN OVERVIEW
                    </span>

                    <h2>Workforce Overview</h2>

                    <p>
                        Monitor branches, employees, attendance and
                        workforce activity from one place.
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
                    <section className="dashboard-stat-grid">
                        <div className="dashboard-stat-card">
                            <div className="stat-card-top">
                                <span className="stat-icon">
                                    ▣
                                </span>

                                <span className="stat-badge">
                                    Active
                                </span>
                            </div>

                            <p>Total Branches</p>

                            <h3>
                                {totals.branches}
                            </h3>

                            <span className="stat-description">
                                Registered office branches
                            </span>
                        </div>

                        <div className="dashboard-stat-card">
                            <div className="stat-card-top">
                                <span className="stat-icon">
                                    ♙
                                </span>

                                <span className="stat-badge">
                                    Management
                                </span>
                            </div>

                            <p>Total Admins</p>

                            <h3>
                                {totals.admins}
                            </h3>

                            <span className="stat-description">
                                Active branch administrators
                            </span>
                        </div>

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
                                Active employees across branches
                            </span>
                        </div>

                        <DashboardDrilldown type="PRESENT" count={attendance.present} icon="✓" description="Employees checked in today" />

                        <DashboardDrilldown type="LATE" count={attendance.late} icon="◷" description="Late arrivals today" />

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
                                    <h3>
                                        Quick Actions
                                    </h3>

                                    <p>
                                        Common Super Admin operations
                                    </p>
                                </div>
                            </div>

                            <div className="quick-actions-grid">
                                <button
                                    type="button"
                                    onClick={() => navigate("/super-admin/branches")}
                                >
                                    <span>＋</span>
                                    Add Branch
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navigate("/super-admin/admins")}
                                >
                                    <span>＋</span>
                                    Add Admin
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navigate("/super-admin/departments")}
                                >
                                    <span>＋</span>
                                    Add Department
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navigate("/super-admin/reports")}
                                >
                                    <span>▤</span>
                                    View Reports
                                </button>
                            </div>
                        </div>
                    </section>
                </>
            )}
        </ManagementLayout>
    );
};

export default SuperAdminDashboard;

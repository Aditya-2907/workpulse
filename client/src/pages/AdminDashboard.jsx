import ManagementLayout from "../components/management/ManagementLayout";

function AdminDashboard() {
    const user = JSON.parse(
        sessionStorage.getItem("managementUser") || "{}"
    );

    return (
        <ManagementLayout>
            <section className="dashboard-welcome-section">
                <div>
                    <span className="dashboard-eyebrow">
                        ADMIN PORTAL
                    </span>

                    <h2>Admin Dashboard</h2>

                    <p>
                        Welcome, {user.fullName || "Admin"}
                    </p>
                </div>
            </section>

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h3>Account Overview</h3>

                        <p>
                            Your current WorkPulse management
                            access information.
                        </p>
                    </div>
                </div>

                <div className="dashboard-stats-grid">
                    <div className="dashboard-stat-card">
                        <span className="dashboard-stat-label">
                            Role
                        </span>

                        <strong className="dashboard-stat-value">
                            {user.role || "ADMIN"}
                        </strong>
                    </div>

                    <div className="dashboard-stat-card">
                        <span className="dashboard-stat-label">
                            Branch ID
                        </span>

                        <strong className="dashboard-stat-value">
                            {user.branchId || "-"}
                        </strong>
                    </div>
                </div>
            </section>

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h3>Branch Management</h3>

                        <p>
                            Manage employees, attendance,
                            leaves and administrative requests
                            for your assigned branch.
                        </p>
                    </div>
                </div>

                <div className="dashboard-quick-info">
                    <p>
                        Use the sidebar to access your
                        branch management modules.
                    </p>
                </div>
            </section>
        </ManagementLayout>
    );
}

export default AdminDashboard;
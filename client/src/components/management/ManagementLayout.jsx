import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "../../styles/management.css";

const ManagementLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    let user = null;

    try {
        user = JSON.parse(
            sessionStorage.getItem("managementUser")
        );
    } catch {
        user = null;
    }

    return (
        <div className="management-layout">
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                userRole={user?.role}
            />

            <div className="management-main">
                <Topbar
                    onMenuClick={() =>
                        setSidebarOpen((current) => !current)
                    }
                    user={user}
                />

                <main className="management-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default ManagementLayout;
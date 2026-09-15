import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

const Sidebar = ({ isOpen, onClose, userRole }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        sessionStorage.removeItem("managementToken");
        sessionStorage.removeItem("managementUser");

        navigate("/management/login");
    };

    const superAdminMenu = [
        {
            label: "Dashboard",
            icon: "⌂",
            path: "/super-admin/dashboard",
        },
        {
            label: "Branches",
            icon: "▣",
            path: "/super-admin/branches",
        },
        {
            label: "Departments",
            icon: "◫",
            path: "/super-admin/departments",
        },
        {
            label: "Admins",
            icon: "♙",
            path: "/super-admin/admins",
        },
        {
            label: "Employees",
            icon: "♟",
            path: "/super-admin/employees",
        },
        {
            label: "Attendance",
            icon: "✓",
            path: "/super-admin/attendance",
        },
        {
            label: "Leaves",
            icon: "◷",
            path: "/super-admin/leaves",
        },
        {
            label: "Holidays",
            icon: "★",
            path: "/super-admin/holidays",
        },
        {
            label: "Reports",
            icon: "▤",
            path: "/super-admin/reports",
        },
    ];

    const adminMenu = [
        {
            label: "Dashboard",
            icon: "⌂",
            path: "/admin/dashboard",
        },
        {
            label: "Employees",
            icon: "♟",
            path: "/admin/employees",
        },
        {
            label: "Request Admin",
            icon: "＋",
            path: "/admin/admin-request",
        },
        {
            label: "Attendance",
            icon: "✓",
            path: "/admin/attendance",
        },
        {
            label: "Leaves",
            icon: "◷",
            path: "/admin/leaves",
        },
        {
            label: "Reports",
            icon: "▤",
            path: "/admin/reports",
        },
    ];

    const menuItems =
        userRole === "SUPER_ADMIN"
            ? superAdminMenu
            : adminMenu;

    return (
        <>
            {isOpen && (
                <div
                    className="management-sidebar-overlay"
                    onClick={onClose}
                />
            )}

            <aside
                className={`management-sidebar ${isOpen ? "sidebar-open" : ""
                    }`}
            >
                <div className="management-sidebar-header">
                    <div className="management-logo">
                        <div className="management-logo-icon">
                            W
                        </div>

                        <div>
                            <h2>WorkPulse</h2>
                            <span>
                                Workforce Management
                            </span>
                        </div>
                    </div>

                    <button
                        className="sidebar-close-button"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <nav className="management-sidebar-nav">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `management-nav-link ${isActive
                                    ? "active"
                                    : ""
                                }`
                            }
                        >
                            <span className="management-nav-icon">
                                {item.icon}
                            </span>

                            <span>
                                {item.label}
                            </span>
                        </NavLink>
                    ))}
                </nav>

                <div className="management-sidebar-footer">
                    <button
                        className="management-logout-button"
                        onClick={handleLogout}
                    >
                        <span>↪</span>
                        Logout
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
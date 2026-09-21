import React from "react";
import { NavLink } from "react-router-dom";
import WorkPulseLogo from "../WorkPulseLogo";

const Sidebar = ({ isOpen, onClose, userRole }) => {
    const superAdminMenu = [
        {
            label: "Dashboard",
            icon: "⌂",
            path: "/super-admin/dashboard",
        },
        {
            label: "My Profile",
            icon: "◉",
            path: "/super-admin/profile",
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
            label: "Import Employees",
            icon: "⇧",
            path: "/super-admin/employees/import",
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
        {
            label: "Alert Center",
            icon: "!",
            path: "/super-admin/alerts",
        },
        {
            label: "Audit Logs",
            icon: "◌",
            path: "/super-admin/audit-logs",
        },
        {
            label: "Settings",
            icon: "⚙",
            path: "/super-admin/settings",
        },
    ];

    const adminMenu = [
        {
            label: "Dashboard",
            icon: "⌂",
            path: "/admin/dashboard",
        },
        {
            label: "My Profile",
            icon: "◉",
            path: "/admin/profile",
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
        {
            label: "Alert Center",
            icon: "!",
            path: "/admin/alerts",
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
                        <WorkPulseLogo className="management-sidebar-logo" />
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

            </aside>
        </>
    );
};

export default Sidebar;

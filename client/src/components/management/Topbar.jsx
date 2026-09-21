import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { changeManagementPassword } from "../../services/api";
import WorkPulseLogo from "../WorkPulseLogo";
import { getManagementPageMeta } from "../../config/managementPageMeta";

const emptyPasswordForm = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
};

const Topbar = ({ onMenuClick, user }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
    const [passwordError, setPasswordError] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);
    const [theme, setTheme] = useState(() => localStorage.getItem("workpulse-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    const pageMeta = getManagementPageMeta(location.pathname);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("workpulse-theme", theme);
    }, [theme]);

    useEffect(() => {
        if (!isUserMenuOpen) return undefined;

        const closeOnOutsideInteraction = (event) => {
            if (!userMenuRef.current?.contains(event.target)) setIsUserMenuOpen(false);
        };
        const closeOnEscape = (event) => {
            if (event.key === "Escape") setIsUserMenuOpen(false);
        };

        document.addEventListener("pointerdown", closeOnOutsideInteraction);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideInteraction);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [isUserMenuOpen]);

    const closePasswordForm = () => {
        setPasswordForm(emptyPasswordForm);
        setPasswordError("");
        setShowPasswordForm(false);
    };

    const openPasswordForm = () => {
        setIsUserMenuOpen(false);
        setShowPasswordForm(true);
    };

    const openProfile = () => {
        setIsUserMenuOpen(false);
        navigate(user?.role === "SUPER_ADMIN" ? "/super-admin/profile" : "/admin/profile");
    };

    const handleLogout = () => {
        setIsUserMenuOpen(false);
        sessionStorage.removeItem("managementToken");
        sessionStorage.removeItem("managementUser");
        navigate("/management/login");
    };

    const handlePasswordChange = (event) => {
        const { name, value } = event.target;
        setPasswordForm((current) => ({ ...current, [name]: value }));
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        setPasswordError("");

        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            setPasswordError("All password fields are required.");
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            setPasswordError("New password must be at least 8 characters.");
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("New password and confirmation do not match.");
            return;
        }

        if (passwordForm.newPassword === passwordForm.currentPassword) {
            setPasswordError("New password must be different from current password.");
            return;
        }

        try {
            setSavingPassword(true);
            await changeManagementPassword(passwordForm);
            window.alert("Password changed successfully. Please log in again.");
            sessionStorage.removeItem("managementToken");
            sessionStorage.removeItem("managementUser");
            navigate("/management/login");
        } catch (error) {
            setPasswordError(error.message || "Failed to change password.");
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <>
            <header className="management-topbar">
                <div className="management-topbar-left">
                    <button
                        className="management-menu-button"
                        onClick={onMenuClick}
                        aria-label="Open navigation menu"
                    >
                        ☰
                    </button>

                    <div>
                        <h1>{pageMeta.title}</h1>
                        <p>{pageMeta.subtitle}</p>
                    </div>
                </div>

                <div className="management-topbar-user">
                    <button
                        type="button"
                        className="management-theme-toggle"
                        onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
                        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    >
                        <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
                    </button>
                    <div className="management-user-menu" ref={userMenuRef}>
                        <button
                            type="button"
                            className="management-user-trigger"
                            onClick={() => setIsUserMenuOpen((open) => !open)}
                            aria-haspopup="menu"
                            aria-expanded={isUserMenuOpen}
                            aria-controls="management-user-menu-actions"
                        >
                            <span className="management-user-avatar" aria-hidden="true">
                                <WorkPulseLogo variant="mark" className="management-user-brand-mark" alt="" />
                            </span>
                            <span className="management-user-info">
                                <strong>{user?.fullName || "WorkPulse User"}</strong>
                                <span>{user?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
                            </span>
                            <span className="management-user-menu-chevron" aria-hidden="true">⌄</span>
                        </button>

                        {isUserMenuOpen && (
                            <div id="management-user-menu-actions" className="management-user-dropdown" role="menu">
                                <button type="button" role="menuitem" onClick={openProfile}>My Profile</button>
                                <button type="button" role="menuitem" onClick={openPasswordForm}>Change Password</button>
                                <span className="management-user-menu-divider" aria-hidden="true" />
                                <button type="button" role="menuitem" className="management-user-logout" onClick={handleLogout}>Logout</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {showPasswordForm && (
                <div className="management-modal-backdrop" role="presentation">
                    <section
                        className="management-password-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="change-password-title"
                    >
                        <div className="dashboard-panel-header">
                            <div>
                                <h3 id="change-password-title">Change Password</h3>
                                <p>Use your current password to set a new one.</p>
                            </div>
                        </div>

                        <form className="management-password-form" onSubmit={handlePasswordSubmit}>
                            <label>
                                Current Password
                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={passwordForm.currentPassword}
                                    onChange={handlePasswordChange}
                                    autoComplete="current-password"
                                    required
                                />
                            </label>

                            <label>
                                New Password
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={passwordForm.newPassword}
                                    onChange={handlePasswordChange}
                                    autoComplete="new-password"
                                    minLength="8"
                                    required
                                />
                            </label>

                            <label>
                                Confirm New Password
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={passwordForm.confirmPassword}
                                    onChange={handlePasswordChange}
                                    autoComplete="new-password"
                                    minLength="8"
                                    required
                                />
                            </label>

                            {passwordError && (
                                <p className="management-form-error" role="alert">{passwordError}</p>
                            )}

                            <div className="management-form-actions">
                                <button type="button" className="secondary-action-btn" onClick={closePasswordForm} disabled={savingPassword}>
                                    Cancel
                                </button>
                                <button type="submit" className="primary-action-btn" disabled={savingPassword}>
                                    {savingPassword ? "Saving..." : "Change Password"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </>
    );
};

export default Topbar;

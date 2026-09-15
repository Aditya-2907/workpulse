import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeManagementPassword } from "../../services/api";

const emptyPasswordForm = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
};

const Topbar = ({ onMenuClick, user }) => {
    const navigate = useNavigate();
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
    const [passwordError, setPasswordError] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);

    const initials = user?.fullName
        ? user.fullName
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "WP";

    const closePasswordForm = () => {
        setPasswordForm(emptyPasswordForm);
        setPasswordError("");
        setShowPasswordForm(false);
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
                        <h1>Dashboard</h1>
                        <p>Welcome back to WorkPulse</p>
                    </div>
                </div>

                <div className="management-topbar-user">
                    <div className="management-user-avatar">{initials}</div>

                    <div className="management-user-info">
                        <strong>{user?.fullName || "WorkPulse User"}</strong>
                        <span>{user?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
                    </div>

                    <button
                        type="button"
                        className="topbar-password-button"
                        onClick={() => setShowPasswordForm(true)}
                    >
                        Change Password
                    </button>
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

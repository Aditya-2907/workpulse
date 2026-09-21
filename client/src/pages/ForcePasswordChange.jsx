import { useState } from "react";
import { useNavigate } from "react-router-dom";
import WorkPulseLogo from "../components/WorkPulseLogo";
import { forceManagementPasswordChange } from "../services/api";

export default function ForcePasswordChange() {
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        if (newPassword.length < 8 || newPassword !== confirmPassword) {
            setError("Use matching passwords of at least 8 characters.");
            return;
        }
        try {
            setSaving(true);
            await forceManagementPasswordChange({ newPassword, confirmPassword });
            sessionStorage.removeItem("managementToken");
            sessionStorage.removeItem("managementUser");
            navigate("/management/login", { replace: true, state: { passwordChanged: true } });
        } catch (requestError) {
            setError(requestError.message || "Unable to set the new password.");
        } finally {
            setSaving(false);
        }
    };

    return <main className="management-login-page"><section className="management-login-shell force-password-shell" aria-label="Set your new WorkPulse password"><aside className="management-login-intro"><WorkPulseLogo className="management-login-logo" /><div className="management-login-copy"><p className="management-login-eyebrow">ACCOUNT SECURITY</p><h1>Set your new password.</h1><p>Your temporary password can only be used to reach this screen.</p></div></aside><section className="management-login-panel"><div className="management-login-panel-heading"><div><p>FIRST SIGN-IN</p><h2>Create a private password</h2></div></div><p className="management-login-description">Choose a password with at least 8 characters. You will then sign in again.</p><form className="management-login-form" onSubmit={submit}><label htmlFor="forced-new-password">New Password<input id="forced-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength="8" required /></label><label htmlFor="forced-confirm-password">Confirm New Password<input id="forced-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength="8" required /></label>{error && <div className="management-login-error" role="alert">{error}</div>}<button type="submit" className="management-login-submit" disabled={saving}>{saving ? "Saving…" : "Set New Password"}</button></form><button type="button" className="management-login-link" onClick={() => { sessionStorage.removeItem("managementToken"); sessionStorage.removeItem("managementUser"); navigate("/management/login", { replace: true }); }}>Log out</button></section></section></main>;
}

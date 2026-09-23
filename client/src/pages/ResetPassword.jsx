import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetManagementPassword } from "../services/api";
import WorkPulseLogo from "../components/WorkPulseLogo";

function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const token = searchParams.get("token") || "";

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        if (!token) {
            setError("This reset link is invalid or incomplete.");
            return;
        }
        if (newPassword.length < 8 || newPassword !== confirmPassword) {
            setError("Use matching passwords of at least 8 characters.");
            return;
        }
        try {
            setSaving(true);
            await resetManagementPassword({ token, newPassword, confirmPassword });
            navigate("/management/login", { replace: true, state: { passwordChanged: true } });
        } catch (requestError) {
            setError(requestError.message || "Unable to reset password.");
        } finally {
            setSaving(false);
        }
    };

    return <main className="management-login-page"><section className="management-login-shell" aria-label="Reset WorkPulse password"><aside className="management-login-intro"><WorkPulseLogo className="management-login-logo" /><div className="management-login-copy"><p className="management-login-eyebrow">ACCOUNT RECOVERY</p><h1>Choose a new password.</h1><p>Reset links are single-use and expire after 30 minutes.</p></div></aside><section className="management-login-panel"><div className="management-login-panel-heading"><div><p>RESET PASSWORD</p><h2>Create a new password</h2></div></div><p className="management-login-description">Use a private password with at least 8 characters.</p><form className="management-login-form" onSubmit={submit}><label htmlFor="reset-new-password">New password<input id="reset-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength="8" required /></label><label htmlFor="reset-confirm-password">Confirm new password<input id="reset-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength="8" required /></label>{error && <div className="management-login-error" role="alert">{error}</div>}<button type="submit" className="management-login-submit" disabled={saving}>{saving ? "Saving…" : "Reset password"}</button></form><button type="button" className="management-login-link" onClick={() => navigate("/management/login")}>Back to sign in</button></section></section></main>;
}

export default ResetPassword;

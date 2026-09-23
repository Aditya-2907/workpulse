import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestManagementPasswordReset } from "../services/api";
import WorkPulseLogo from "../components/WorkPulseLogo";

function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!email.trim()) {
            setError("Enter your registered email address.");
            return;
        }
        try {
            setSaving(true);
            const result = await requestManagementPasswordReset(email.trim());
            setMessage(result.message);
        } catch (requestError) {
            setError(requestError.message || "Unable to request a password reset.");
        } finally {
            setSaving(false);
        }
    };

    return <main className="management-login-page"><section className="management-login-shell" aria-label="Request WorkPulse password reset"><aside className="management-login-intro"><WorkPulseLogo className="management-login-logo" /><div className="management-login-copy"><p className="management-login-eyebrow">ACCOUNT RECOVERY</p><h1>Reset your password securely.</h1><p>We send a one-time reset link only when the email belongs to an active management account.</p></div></aside><section className="management-login-panel"><div className="management-login-panel-heading"><div><p>FORGOT PASSWORD</p><h2>Request a reset link</h2></div></div><p className="management-login-description">Enter your registered email address. The response is intentionally the same for all requests.</p><form className="management-login-form" onSubmit={submit}><label htmlFor="forgot-password-email">Email address<input id="forgot-password-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>{error && <div className="management-login-error" role="alert">{error}</div>}{message && <div className="management-login-success" role="status">{message}</div>}<button type="submit" className="management-login-submit" disabled={saving}>{saving ? "Sending…" : "Send reset link"}</button></form><button type="button" className="management-login-link" onClick={() => navigate("/management/login")}>Back to sign in</button></section></section></main>;
}

export default ForgotPassword;

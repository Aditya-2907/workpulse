import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { managementLogin } from "../services/api";
import WorkPulseLogo from "../components/WorkPulseLogo";

function ManagementLogin() {
    const navigate = useNavigate();
    const location = useLocation();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        if (!phone.trim() || !password) {
            setError("Phone number and password are required.");
            return;
        }
        try {
            setLoading(true);
            const data = await managementLogin(phone.trim(), password);
            sessionStorage.setItem("managementToken", data.token);
            sessionStorage.setItem("managementUser", JSON.stringify(data.user));
            if (data.user.mustChangePassword) {
                navigate("/management/force-password-change", { replace: true });
                return;
            }
            if (data.user.role === "SUPER_ADMIN") {
                navigate("/super-admin/dashboard", { replace: true });
                return;
            }
            if (data.user.role === "ADMIN") {
                navigate("/admin/dashboard", { replace: true });
                return;
            }
            setError("You are not authorized to access management.");
        } catch (requestError) {
            setError(requestError.message || "Unable to sign in.");
        } finally {
            setLoading(false);
        }
    };

    return <main className="management-login-page">
        <div className="management-login-atmosphere" aria-hidden="true">
            <span className="login-orb login-orb-one" />
            <span className="login-orb login-orb-two" />
            <span className="login-orb login-orb-three" />
            <span className="login-grid" />
            <span className="login-curve login-curve-one" />
            <span className="login-curve login-curve-two" />
        </div>
        <section className="management-login-shell" aria-label="WorkPulse management sign in">
            <aside className="management-login-intro">
                <div className="management-login-brand">
                    <WorkPulseLogo className="management-login-logo" />
                </div>
                <div className="management-login-copy">
                    <p className="management-login-eyebrow">MANAGEMENT PORTAL</p>
                    <h1>Run your workforce with clarity.</h1>
                    <p>Securely manage teams, attendance, and branch operations from one focused workspace.</p>
                </div>
                <ul className="management-login-features" aria-label="WorkPulse features">
                    <li><span aria-hidden="true">{"\u2713"}</span> Branch-aware workforce management</li>
                    <li><span aria-hidden="true">{"\u2713"}</span> Attendance and leave visibility</li>
                    <li><span aria-hidden="true">{"\u2713"}</span> Role-protected administration</li>
                </ul>
            </aside>
            <section className="management-login-panel">
                <div className="management-login-panel-heading">
                    <span className="management-login-panel-icon" aria-hidden="true">↗</span>
                    <div><p>WELCOME BACK</p><h2>Sign in to WorkPulse</h2></div>
                </div>
                <p className="management-login-description">Use your registered phone number and management password.</p>
                {location.state?.passwordChanged && <div className="management-login-success" role="status">Password changed. Please sign in with your new password.</div>}
                <form className="management-login-form" onSubmit={handleSubmit}>
                    <label htmlFor="management-phone">Phone number
                        <div className="management-login-phone-field"><span>+91</span><input id="management-phone" type="tel" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="Registered phone number" maxLength={10} autoComplete="username" required /></div>
                    </label>
                    <label htmlFor="management-password">Password
                        <input id="management-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                    </label>
                    {error && <div className="management-login-error" role="alert">{error}</div>}
                    <button type="submit" className="management-login-submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></button>
                </form>
                <div className="management-login-footer"><span>Need to mark attendance instead?</span><button type="button" onClick={() => navigate("/")}>Go to attendance</button></div>
            </section>
        </section>
    </main>;
}

export default ManagementLogin;

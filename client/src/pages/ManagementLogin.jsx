import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { managementLogin } from "../services/api";

function ManagementLogin() {
    const navigate = useNavigate();

    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");

        if (!phone.trim() || !password) {
            setError("Phone number and password are required");
            return;
        }

        try {
            setLoading(true);

            const data = await managementLogin(
                phone.trim(),
                password
            );

            sessionStorage.setItem(
                "managementToken",
                data.token
            );

            sessionStorage.setItem(
                "managementUser",
                JSON.stringify(data.user)
            );

            if (data.user.role === "SUPER_ADMIN") {
                navigate("/super-admin/dashboard", {
                    replace: true,
                });
                return;
            }

            if (data.user.role === "ADMIN") {
                navigate("/admin/dashboard", {
                    replace: true,
                });
                return;
            }

            setError("You are not authorized to access management");
        } catch (err) {
            setError(
                err.message || "Unable to login"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.brand}>
                    <div style={styles.logo}>W</div>

                    <div>
                        <h1 style={styles.title}>WorkPulse</h1>
                        <p style={styles.subtitle}>
                            Workforce Management
                        </p>
                    </div>
                </div>

                <div style={styles.headingSection}>
                    <h2 style={styles.heading}>
                        Management Login
                    </h2>

                    <p style={styles.description}>
                        Sign in as an Admin or Super Admin
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>
                            Phone Number
                        </label>

                        <input
                            type="tel"
                            value={phone}
                            onChange={(event) =>
                                setPhone(
                                    event.target.value.replace(
                                        /\D/g,
                                        ""
                                    )
                                )
                            }
                            placeholder="Enter registered phone number"
                            maxLength={10}
                            autoComplete="username"
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>
                            Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder="Enter password"
                            autoComplete="current-password"
                            style={styles.input}
                        />
                    </div>

                    {error && (
                        <div style={styles.error}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...styles.button,
                            opacity: loading ? 0.7 : 1,
                            cursor: loading
                                ? "not-allowed"
                                : "pointer",
                        }}
                    >
                        {loading
                            ? "Signing in..."
                            : "Sign In"}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={() => navigate("/")}
                    style={styles.attendanceLink}
                >
                    ← Back to Attendance
                </button>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
            "linear-gradient(135deg, #eef4ff 0%, #f8fafc 55%, #edfdf8 100%)",
        fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },

    card: {
        width: "100%",
        maxWidth: "420px",
        background: "#ffffff",
        borderRadius: "22px",
        padding: "32px",
        boxShadow:
            "0 20px 60px rgba(15, 23, 42, 0.10)",
        border: "1px solid #e2e8f0",
    },

    brand: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "34px",
    },

    logo: {
        width: "46px",
        height: "46px",
        borderRadius: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2563eb",
        color: "#ffffff",
        fontSize: "22px",
        fontWeight: "700",
    },

    title: {
        margin: 0,
        color: "#0f172a",
        fontSize: "22px",
        fontWeight: "700",
    },

    subtitle: {
        margin: "3px 0 0",
        color: "#64748b",
        fontSize: "13px",
    },

    headingSection: {
        marginBottom: "26px",
    },

    heading: {
        margin: 0,
        color: "#0f172a",
        fontSize: "26px",
        fontWeight: "700",
    },

    description: {
        margin: "8px 0 0",
        color: "#64748b",
        fontSize: "14px",
    },

    formGroup: {
        marginBottom: "18px",
    },

    label: {
        display: "block",
        marginBottom: "7px",
        color: "#334155",
        fontSize: "14px",
        fontWeight: "600",
    },

    input: {
        width: "100%",
        boxSizing: "border-box",
        padding: "13px 14px",
        borderRadius: "10px",
        border: "1px solid #cbd5e1",
        outline: "none",
        fontSize: "15px",
        background: "#ffffff",
        color: "#0f172a",
    },

    error: {
        padding: "11px 12px",
        marginBottom: "16px",
        borderRadius: "9px",
        background: "#fef2f2",
        color: "#b91c1c",
        fontSize: "14px",
    },

    button: {
        width: "100%",
        border: "none",
        borderRadius: "10px",
        padding: "14px",
        background: "#2563eb",
        color: "#ffffff",
        fontSize: "15px",
        fontWeight: "600",
    },

    attendanceLink: {
        width: "100%",
        marginTop: "20px",
        padding: 0,
        border: "none",
        background: "transparent",
        color: "#64748b",
        cursor: "pointer",
        fontSize: "14px",
    },
};

export default ManagementLogin;
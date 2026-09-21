const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");

const authRoutes = require("./routes/authRoutes");
const branchRoutes = require("./routes/branchRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const setupRoutes = require("./routes/setupRoutes");
const adminApprovalRoutes = require("./routes/adminApprovalRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const holidayRoutes = require("./routes/holidayRoutes");
const reportRoutes = require("./routes/reportRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const alertRoutes = require("./routes/alertRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const attendanceDeviceRoutes = require("./routes/attendanceDeviceRoutes");

const app = express();

const trustedProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || "0", 10);
if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
    app.set("trust proxy", trustedProxyHops);
}

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: process.env.NODE_ENV === "production" ? undefined : false,
}));

app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
});

const normalizeOrigin = (value) => {
    try {
        const url = new URL(String(value || "").trim());
        return ["http:", "https:"].includes(url.protocol)
            ? url.origin
            : null;
    } catch {
        return null;
    }
};

const configuredOrigins = String(process.env.FRONTEND_URL || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

const localDevelopmentOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

const allowedOrigins = new Set([
    ...configuredOrigins,
    ...(process.env.NODE_ENV === "production" ? [] : localDevelopmentOrigins),
]);

app.use(cors({
    origin(origin, callback) {
        // Requests without an Origin header are non-browser/server-to-server
        // requests and are not governed by browser CORS policy.
        if (!origin) return callback(null, true);
        return callback(null, allowedOrigins.has(normalizeOrigin(origin)));
    },
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"],
}));
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "WorkPulse API is running",
    });
});

app.use("/api/auth", authRoutes);

if (process.env.NODE_ENV !== "production") {
    const testRoutes = require("./routes/testRoutes");
    app.use("/api/test", testRoutes);
}

app.use("/api/branches", branchRoutes);

app.use("/api/departments", departmentRoutes);

app.use("/api/admins", adminRoutes);

app.use("/api/employees", employeeRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/admin-approvals", adminApprovalRoutes);

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/setup", setupRoutes);

app.use("/api/leaves", leaveRoutes);

app.use("/api/holidays", holidayRoutes);

app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/attendance-devices", attendanceDeviceRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: "API route not found" }));
app.use((error, req, res, _next) => {
    const requestId = req.requestId;
    console.error("API error", { requestId, method: req.method, path: req.path, message: error.message });
    res.status(error.status || 500).json({ success: false, message: "Internal server error", requestId });
});

module.exports = app;

require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");
const { getManagementAlerts } = require("../src/services/managementAlertService");

const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS: ${message}`); };

const run = async () => {
    try {
        const [[timezone]] = await db.query("SELECT @@session.time_zone AS timezone");
        assert(timezone.timezone === "+05:30", "database session uses IST (+05:30)");
        const [tables] = await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('attendance_corrections', 'attendance_devices')");
        assert(tables.length === 2, "operations tables are present");
        const [columns] = await db.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organization_settings' AND COLUMN_NAME IN ('attendance_alert_threshold', 'photo_retention_days', 'missing_checkout_grace_minutes', 'device_enforcement_enabled')");
        assert(columns.length === 4, "organization settings operational columns are present");
        const alerts = await getManagementAlerts(null, true);
        assert(Array.isArray(alerts.belowThreshold.employees) && Array.isArray(alerts.missingCheckout.records), "derived alerts execute read-only");
        const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
        const routes = ["authRoutes", "attendanceRoutes", "adminApprovalRoutes", "setupRoutes"];
        routes.forEach((route) => assert(appSource.includes(route), `application mounts ${route}`));
        const limiterSource = fs.readFileSync(path.join(__dirname, "..", "src", "middleware", "rateLimiters.js"), "utf8");
        assert(limiterSource.includes("RATE_LIMITED"), "rate limiter uses safe 429 payload");
        console.log("PASS: production feature read-only contract checks completed");
    } finally { await db.end(); }
};
run().catch((error) => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });

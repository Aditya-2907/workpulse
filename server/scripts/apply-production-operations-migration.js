require("dotenv").config({ quiet: true });

const db = require("../src/config/db");

const addColumnIfMissing = async (connection, column, definition) => {
    const [[found]] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organization_settings' AND COLUMN_NAME = ?`,
        [column]
    );
    if (found) return false;
    await connection.query(`ALTER TABLE organization_settings ADD COLUMN ${definition}`);
    return true;
};

const run = async () => {
    const connection = await db.getConnection();
    try {
        const [[settingsTable]] = await connection.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organization_settings'`
        );
        if (!settingsTable) throw new Error("organization_settings does not exist; apply the setup migration first");

        const columns = [
            ["organization_address", "organization_address TEXT NULL AFTER organization_name"],
            ["organization_phone", "organization_phone VARCHAR(30) NULL AFTER organization_address"],
            ["organization_email", "organization_email VARCHAR(150) NULL AFTER organization_phone"],
            ["timezone_name", "timezone_name VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata' AFTER organization_email"],
            ["attendance_alert_threshold", "attendance_alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 70.00 AFTER timezone_name"],
            ["photo_retention_days", "photo_retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 90 AFTER attendance_alert_threshold"],
            ["missing_checkout_grace_minutes", "missing_checkout_grace_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30 AFTER photo_retention_days"],
            ["device_enforcement_enabled", "device_enforcement_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER missing_checkout_grace_minutes"],
        ];

        const applied = [];
        for (const [name, definition] of columns) {
            if (await addColumnIfMissing(connection, name, definition)) applied.push(name);
        }

        const migrationSql = require("fs").readFileSync(
            require("path").join(__dirname, "..", "migrations", "20260922_add_production_operations_foundation.sql"),
            "utf8"
        );
        const statements = migrationSql
            .split(";\n")
            .map((statement) => statement.replace(/--[^\n]*/g, "").trim())
            .filter(Boolean);
        for (const statement of statements) await connection.query(statement);

        console.log(applied.length ? `APPLIED settings columns: ${applied.join(", ")}` : "SKIPPED settings columns: already present");
        console.log("PASS: attendance_corrections and attendance_devices are available");
    } finally {
        connection.release();
        await db.end();
    }
};

run().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
});

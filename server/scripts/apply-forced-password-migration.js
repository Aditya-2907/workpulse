require("dotenv").config({ quiet: true });

const db = require("../src/config/db");

const run = async () => {
    const connection = await db.getConnection();
    try {
        const [columns] = await connection.query(
            "SHOW COLUMNS FROM users LIKE 'must_change_password'"
        );

        if (columns.length === 0) {
            await connection.query(
                "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER password_hash"
            );
            console.log("APPLIED: must_change_password added with FALSE default.");
        } else {
            console.log("SKIPPED: must_change_password already exists.");
        }

        const [[summary]] = await connection.query(
            `SELECT
                COUNT(*) AS adminCount,
                SUM(CASE WHEN must_change_password THEN 1 ELSE 0 END) AS forcedChangeCount
             FROM users
             WHERE role = 'ADMIN'`
        );
        console.log(JSON.stringify({ adminCount: summary.adminCount, forcedChangeCount: Number(summary.forcedChangeCount || 0) }));
    } finally {
        connection.release();
        await db.end();
    }
};

run().catch((error) => {
    console.error("Forced-password migration failed:", error.message);
    process.exitCode = 1;
});

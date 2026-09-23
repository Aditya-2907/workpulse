require("dotenv").config({ quiet: true });

const db = require("../src/config/db");

const hasColumn = async (connection, table, column) => {
    const [[row]] = await connection.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return Boolean(row);
};

const addColumnIfMissing = async (connection, column, definition) => {
    if (await hasColumn(connection, "attendance_records", column)) return false;
    await connection.query(`ALTER TABLE attendance_records ADD COLUMN ${definition}`);
    return true;
};

const run = async () => {
    const connection = await db.getConnection();
    try {
        const applied = [];
        await connection.query(`CREATE TABLE IF NOT EXISTS branch_weekly_offs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            branch_id BIGINT UNSIGNED NOT NULL,
            weekday ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_branch_weekly_offs_branch FOREIGN KEY (branch_id)
                REFERENCES branches(id) ON UPDATE CASCADE ON DELETE CASCADE,
            UNIQUE KEY uq_branch_weekly_offs_day (branch_id, weekday)
        )`);
        applied.push("branch_weekly_offs ensured");

        await connection.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT UNSIGNED NOT NULL,
            token_hash CHAR(64) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            consumed_at DATETIME NULL,
            requested_ip VARCHAR(45) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id)
                REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            INDEX idx_password_reset_tokens_lookup (token_hash, expires_at, consumed_at),
            INDEX idx_password_reset_tokens_user (user_id, created_at)
        )`);
        applied.push("password_reset_tokens ensured");

        if (await addColumnIfMissing(connection, "check_in_photo_public_id", "check_in_photo_public_id VARCHAR(500) NULL AFTER check_in_photo_path")) {
            applied.push("check_in_photo_public_id added");
        }
        if (await addColumnIfMissing(connection, "check_out_photo_public_id", "check_out_photo_public_id VARCHAR(500) NULL AFTER check_out_photo_path")) {
            applied.push("check_out_photo_public_id added");
        }

        console.log(`PASS: schema completion migration finished (${applied.join(", ")})`);
    } finally {
        connection.release();
        await db.end();
    }
};

run().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
});

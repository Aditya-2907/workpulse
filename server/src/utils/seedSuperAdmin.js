const bcrypt = require("bcryptjs");
const db = require("../config/db");

const seedSuperAdmin = async () => {
    try {
        const phone = process.env.SUPER_ADMIN_PHONE;
        const email = process.env.SUPER_ADMIN_EMAIL;
        const password = process.env.SUPER_ADMIN_PASSWORD;

        if (!phone || !email || !password) {
            console.log(
                "Super Admin seed skipped: environment variables are missing"
            );
            return;
        }

        const [existingUsers] = await db.query(
            `SELECT id
             FROM users
             WHERE role = 'SUPER_ADMIN'
             LIMIT 1`
        );

        if (existingUsers.length > 0) {
            console.log("Super Admin already exists");
            return;
        }

        const passwordHash = await bcrypt.hash(
            password,
            10
        );

        await db.query(
            `INSERT INTO users (
                full_name,
                phone,
                email,
                password_hash,
                role,
                account_status
            )
            VALUES (?, ?, ?, ?, 'SUPER_ADMIN', 'ACTIVE')`,
            [
                "WorkPulse Super Admin",
                phone,
                email,
                passwordHash,
            ]
        );

        console.log(
            "Super Admin created successfully"
        );
    } catch (error) {
        console.error(
            "Super Admin seed failed:",
            error.message
        );
    }
};

module.exports = seedSuperAdmin;
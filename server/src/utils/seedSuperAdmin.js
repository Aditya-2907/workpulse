const bcrypt = require("bcryptjs");
const db = require("../config/db");

const seedSuperAdmin = async () => {
    try {
        const phone = "9999999999";
        const email = "superadmin@workpulse.local";
        const password = "WorkPulse@123";

        const [existingUsers] = await db.query(
            `SELECT id FROM users
       WHERE role = 'SUPER_ADMIN'
       LIMIT 1`
        );

        if (existingUsers.length > 0) {
            console.log("Super Admin already exists");
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);

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

        console.log("Super Admin created successfully");
        console.log("Login Phone:", phone);
        console.log("Login Password:", password);
    } catch (error) {
        console.error("Super Admin seed failed:");
        console.error(error.message);
    }
};

module.exports = seedSuperAdmin;
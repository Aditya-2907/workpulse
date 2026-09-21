const bcrypt = require("bcryptjs");
const db = require("../config/db");

const getSetupStatus = async (req, res) => {
    try {
        const [[settings]] = await db.query("SELECT id, organization_name AS organizationName FROM organization_settings WHERE id = 1");
        const [[superAdmin]] = await db.query("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1");
        return res.json({ success: true, setupRequired: !settings && !superAdmin, organizationName: settings?.organizationName || null });
    } catch (error) { return res.status(500).json({ success: false, message: "Unable to determine setup status" }); }
};

const completeSetup = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { organizationName, fullName, email, phone, password, confirmPassword } = req.body;
        if (![organizationName, fullName, email, phone, password, confirmPassword].every((value) => typeof value === "string" && value.trim())) return res.status(400).json({ success: false, message: "Organization and Super Admin details are required" });
        if (password.length < 8 || password !== confirmPassword) return res.status(400).json({ success: false, message: "Use matching passwords of at least 8 characters" });
        await connection.beginTransaction();
        const [[existingSettings]] = await connection.query("SELECT id FROM organization_settings WHERE id = 1 FOR UPDATE");
        const [[existingSuperAdmin]] = await connection.query("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1 FOR UPDATE");
        if (existingSettings || existingSuperAdmin) { await connection.rollback(); return res.status(409).json({ success: false, message: "Initial setup has already been completed" }); }
        const [[duplicate]] = await connection.query("SELECT id FROM users WHERE phone = ? OR email = ? LIMIT 1", [phone.trim(), email.trim().toLowerCase()]);
        if (duplicate) { await connection.rollback(); return res.status(409).json({ success: false, message: "Phone number or email is already in use" }); }
        const passwordHash = await bcrypt.hash(password, 10);
        await connection.query("INSERT INTO users (full_name, phone, email, password_hash, role, account_status) VALUES (?, ?, ?, ?, 'SUPER_ADMIN', 'ACTIVE')", [fullName.trim(), phone.trim(), email.trim().toLowerCase(), passwordHash]);
        await connection.query("INSERT INTO organization_settings (id, organization_name, setup_completed_at) VALUES (1, ?, NOW())", [organizationName.trim()]);
        await connection.commit();
        return res.status(201).json({ success: true, message: "Organization setup completed. You can now sign in." });
    } catch (error) { await connection.rollback(); return res.status(500).json({ success: false, message: "Unable to complete setup" }); } finally { connection.release(); }
};

module.exports = { getSetupStatus, completeSetup };

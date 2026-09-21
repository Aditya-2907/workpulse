const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const db = require("../config/db");

const resetRequestTimes = new Map();
const RESET_WINDOW_MS = 15 * 60 * 1000;

const getManagementProfile = async (req, res) => {
    try {
        const [[profile]] = await db.query(
            `SELECT
                u.id,
                u.employee_code AS employeeCode,
                u.full_name AS fullName,
                u.phone,
                u.email,
                u.address,
                u.pincode,
                u.designation,
                u.role,
                u.profile_photo_path AS profilePhotoPath,
                b.branch_code AS branchCode,
                b.branch_name AS branchName,
                d.department_code AS departmentCode,
                d.department_name AS departmentName
             FROM users u
             LEFT JOIN branches b ON b.id = u.branch_id
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.id = ?
             AND u.role IN ('ADMIN', 'SUPER_ADMIN')
             AND u.account_status = 'ACTIVE'
             LIMIT 1`,
            [req.user.id]
        );
        if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
        return res.json({ success: true, profile });
    } catch (error) {
        console.error("Get management profile error:", error);
        return res.status(500).json({ success: false, message: "Unable to load profile" });
    }
};

const updateManagementProfile = async (req, res) => {
    try {
        // Only these self-service contact fields are accepted. Role, branch,
        // department, employee code, identity values, and name stay protected.
        const phone = String(req.body.phone || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase() || null;
        const address = String(req.body.address || "").trim() || null;
        const pincode = String(req.body.pincode || "").trim() || null;
        if (!phone || phone.length > 20 || (email && (email.length > 150 || !/^\S+@\S+\.\S+$/.test(email))) || (pincode && pincode.length > 10)) {
            return res.status(400).json({ success: false, message: "Enter a valid phone, email, and pincode." });
        }
        const [duplicates] = await db.query(
            `SELECT id FROM users WHERE id <> ? AND (phone = ? OR (? IS NOT NULL AND email = ?)) LIMIT 1`,
            [req.user.id, phone, email, email]
        );
        if (duplicates.length) return res.status(409).json({ success: false, message: "That phone number or email is already in use." });
        const [result] = await db.query(
            `UPDATE users SET phone = ?, email = ?, address = ?, pincode = ?
             WHERE id = ? AND role IN ('ADMIN', 'SUPER_ADMIN') AND account_status = 'ACTIVE'`,
            [phone, email, address, pincode, req.user.id]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: "Profile not found" });
        return res.json({ success: true, message: "Profile updated successfully." });
    } catch (error) {
        console.error("Update management profile error:", error);
        return res.status(500).json({ success: false, message: "Unable to update profile" });
    }
};

const requestPasswordReset = async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const generic = { success: true, message: "If the email is registered, a reset link will be sent shortly." };
        if (!email || email.length > 150) return res.status(200).json(generic);
        const lastRequest = resetRequestTimes.get(email);
        if (lastRequest && Date.now() - lastRequest < RESET_WINDOW_MS) return res.status(200).json(generic);
        resetRequestTimes.set(email, Date.now());
        const [[user]] = await db.query("SELECT id FROM users WHERE email = ? AND role IN ('ADMIN', 'SUPER_ADMIN') AND account_status = 'ACTIVE' LIMIT 1", [email]);
        if (!user) return res.status(200).json(generic);
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        await db.query("UPDATE password_reset_tokens SET consumed_at = NOW() WHERE user_id = ? AND consumed_at IS NULL", [user.id]);
        await db.query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE), ?)", [user.id, tokenHash, req.ip || null]);
        if (process.env.MAIL_HOST && process.env.MAIL_FROM && process.env.FRONTEND_URL) {
            const transporter = nodemailer.createTransport({ host: process.env.MAIL_HOST, port: Number(process.env.MAIL_PORT || 587), secure: process.env.MAIL_SECURE === "true", auth: process.env.MAIL_USER ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD } : undefined });
            const url = `${process.env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;
            await transporter.sendMail({ from: process.env.MAIL_FROM, to: email, subject: "Reset your WorkPulse password", text: `Use this one-time link within 30 minutes: ${url}` });
        }
        return res.status(200).json(generic);
    } catch (error) { console.error("Password reset request failed", error.message); return res.status(200).json({ success: true, message: "If the email is registered, a reset link will be sent shortly." }); }
};

const resetPassword = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { token, newPassword, confirmPassword } = req.body;
        if (typeof token !== "string" || typeof newPassword !== "string" || newPassword.length < 8 || newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "A valid token and matching password of at least 8 characters are required" });
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await connection.beginTransaction();
        const [[reset]] = await connection.query("SELECT id, user_id AS userId FROM password_reset_tokens WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > NOW() LIMIT 1 FOR UPDATE", [tokenHash]);
        if (!reset) { await connection.rollback(); return res.status(400).json({ success: false, message: "This reset link is invalid or has expired" }); }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await connection.query("UPDATE users SET password_hash = ?, must_change_password = FALSE, token_version = token_version + 1 WHERE id = ? AND role IN ('ADMIN', 'SUPER_ADMIN')", [passwordHash, reset.userId]);
        await connection.query("UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = ?", [reset.id]);
        await connection.commit();
        return res.json({ success: true, message: "Password reset successfully. Please sign in." });
    } catch (error) { await connection.rollback(); return res.status(500).json({ success: false, message: "Unable to reset password" }); } finally { connection.release(); }
};

const forceManagementPasswordChange = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { newPassword, confirmPassword } = req.body;
        if (typeof newPassword !== "string" || typeof confirmPassword !== "string" || newPassword.length < 8 || newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Use matching passwords of at least 8 characters." });
        }

        await connection.beginTransaction();
        const [[user]] = await connection.query(
            `SELECT id, password_hash AS passwordHash, must_change_password AS mustChangePassword
             FROM users
             WHERE id = ? AND role = 'ADMIN' AND account_status = 'ACTIVE'
             LIMIT 1 FOR UPDATE`,
            [req.user.id]
        );

        if (!user || !user.mustChangePassword) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "A forced password change is not required for this account." });
        }

        if (await bcrypt.compare(newPassword, user.passwordHash)) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Choose a password different from the temporary password." });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await connection.query(
            `UPDATE users
             SET password_hash = ?, must_change_password = FALSE, token_version = token_version + 1
             WHERE id = ? AND role = 'ADMIN'`,
            [passwordHash, req.user.id]
        );
        await connection.commit();
        return res.status(200).json({ success: true, message: "Password set successfully. Please sign in again.", reauthenticationRequired: true });
    } catch (error) {
        await connection.rollback();
        console.error("Forced password change error:", error);
        return res.status(500).json({ success: false, message: "Unable to set the new password." });
    } finally {
        connection.release();
    }
};

const managementLogin = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Phone number and password are required",
            });
        }

        const [users] = await db.query(
            `SELECT
          id,
          full_name,
          phone,
          email,
          password_hash,
          must_change_password,
          role,
          account_status,
          branch_id,
          token_version
       FROM users
       WHERE phone = ?
       AND role IN ('ADMIN', 'SUPER_ADMIN')
       LIMIT 1`,
            [phone]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid phone number or password",
            });
        }

        const user = users[0];

        if (user.account_status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Your account is not active",
            });
        }

        if (!user.password_hash) {
            return res.status(401).json({
                success: false,
                message: "Password login is not available for this account",
            });
        }

        const passwordMatched = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatched) {
            return res.status(401).json({
                success: false,
                message: "Invalid phone number or password",
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role,
                branchId: user.branch_id,
                tokenVersion: user.token_version,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h",
            }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                phone: user.phone,
                email: user.email,
                role: user.role,
                branchId: user.branch_id,
                mustChangePassword: Boolean(user.must_change_password),
            },
        });
    } catch (error) {
        console.error("Management login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const changeManagementPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (
            typeof currentPassword !== "string" ||
            typeof newPassword !== "string" ||
            typeof confirmPassword !== "string" ||
            !currentPassword ||
            !newPassword ||
            !confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "Current password, new password and confirm password are required",
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters",
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match",
            });
        }

        const [users] = await db.query(
            `SELECT password_hash
             FROM users
             WHERE id = ?
               AND role IN ('ADMIN', 'SUPER_ADMIN')
               AND account_status = 'ACTIVE'
             LIMIT 1`,
            [req.user.id]
        );

        if (users.length === 0 || !users[0].password_hash) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const passwordMatched = await bcrypt.compare(
            currentPassword,
            users[0].password_hash
        );

        if (!passwordMatched) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect",
            });
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({
                success: false,
                message: "New password must be different from current password",
            });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await db.query(
            `UPDATE users
             SET password_hash = ?,
                 token_version = token_version + 1
             WHERE id = ?
               AND role IN ('ADMIN', 'SUPER_ADMIN')`,
            [passwordHash, req.user.id]
        );

        return res.status(200).json({
            success: true,
            message: "Password changed successfully",
        });
    } catch (error) {
        console.error("Change management password error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = {
    managementLogin,
    changeManagementPassword,
    requestPasswordReset,
    resetPassword,
    forceManagementPasswordChange,
    getManagementProfile,
    updateManagementProfile,
};

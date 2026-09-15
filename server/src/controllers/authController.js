const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

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
};

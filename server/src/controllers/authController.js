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
          branch_id
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

module.exports = {
    managementLogin,
};
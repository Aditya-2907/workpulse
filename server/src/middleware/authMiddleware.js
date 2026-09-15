const jwt = require("jsonwebtoken");
const db = require("../config/db");

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is required",
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [users] = await db.query(
            `SELECT
          id,
          full_name,
          phone,
          email,
          role,
          account_status,
          branch_id,
          token_version
       FROM users
       WHERE id = ?
       LIMIT 1`,
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        const user = users[0];

        if (user.account_status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Your account is not active",
            });
        }

        if (decoded.tokenVersion !== user.token_version) {
            return res.status(401).json({
                success: false,
                message: "Session is no longer valid. Please log in again.",
            });
        }

        req.user = {
            id: user.id,
            fullName: user.full_name,
            phone: user.phone,
            email: user.email,
            role: user.role,
            branchId: user.branch_id,
        };

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token expired",
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Invalid token",
            });
        }

        console.error("Authentication error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = {
    authenticate,
};

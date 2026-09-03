const jwt = require("jsonwebtoken");
const db = require("../config/db");

const authenticateAttendance = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                success: false,
                message: "Attendance token is required",
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (decoded.purpose !== "ATTENDANCE") {
            return res.status(401).json({
                success: false,
                message: "Invalid attendance token",
            });
        }

        const [users] = await db.query(
            `SELECT
        id,
        role,
        account_status AS accountStatus,
        branch_id AS branchId,
        duty_start_time AS dutyStartTime,
        duty_end_time AS dutyEndTime
       FROM users
       WHERE id = ?
       AND role IN ('EMPLOYEE', 'ADMIN')
       LIMIT 1`,
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Attendance user not found",
            });
        }

        const user = users[0];

        if (user.accountStatus !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Account is not active",
            });
        }

        req.attendanceUser = user;

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message:
                    "Attendance session expired. Please login again.",
            });
        }

        return res.status(401).json({
            success: false,
            message: "Invalid attendance session",
        });
    }
};

module.exports = {
    authenticateAttendance,
};
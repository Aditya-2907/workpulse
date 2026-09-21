const jwt = require("jsonwebtoken");
const db = require("../config/db");
const crypto = require("crypto");

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

        // Optional by default: a Super Admin may enable this only after a
        // registered device has been provisioned. Browser fingerprints are not used.
        try {
            const [[settings]] = await db.query("SELECT device_enforcement_enabled AS enabled FROM organization_settings WHERE id = 1");
            if (settings?.enabled) {
                const credential = String(req.headers["x-attendance-device"] || "");
                const hash = crypto.createHash("sha256").update(credential).digest("hex");
                const [[device]] = await db.query("SELECT id FROM attendance_devices WHERE device_token_hash = ? AND status = 'ACTIVE'", [hash]);
                if (!credential || !device) return res.status(403).json({ success: false, code: "AUTHORIZED_DEVICE_REQUIRED", message: "An authorized attendance device is required." });
                await db.query("UPDATE attendance_devices SET last_used_at = NOW() WHERE id = ?", [device.id]);
            }
        } catch (error) {
            // Before the additive operations migration, device enforcement remains off.
            if (error.code !== "ER_BAD_FIELD_ERROR" && error.code !== "ER_NO_SUCH_TABLE") throw error;
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

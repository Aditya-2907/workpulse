const jwt = require("jsonwebtoken");
const db = require("../config/db");

const attendanceLogin = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !phone.trim()) {
            return res.status(400).json({
                success: false,
                message: "Registered phone number is required",
            });
        }

        const cleanPhone = phone.trim();

        // Employee and Admin can give attendance.
        // Super Admin does not need attendance.
        const [users] = await db.query(
            `SELECT
        u.id,
        u.employee_code AS employeeCode,
        u.full_name AS fullName,
        u.phone,
        u.role,
        u.account_status AS accountStatus,
        u.branch_id AS branchId,
        u.department_id AS departmentId,
        u.designation,
        u.duty_start_time AS dutyStartTime,
        u.duty_end_time AS dutyEndTime,

        b.branch_name AS branchName,
        b.branch_code AS branchCode,
        b.status AS branchStatus,

        d.department_name AS departmentName

       FROM users u

       LEFT JOIN branches b
         ON b.id = u.branch_id

       LEFT JOIN departments d
         ON d.id = u.department_id

       WHERE u.phone = ?
       AND u.role IN ('EMPLOYEE', 'ADMIN')
       LIMIT 1`,
            [cleanPhone]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No employee or admin found with this phone number",
            });
        }

        const user = users[0];

        if (user.accountStatus !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Your account is not active",
            });
        }

        if (!user.branchId) {
            return res.status(400).json({
                success: false,
                message: "No branch is assigned to this user",
            });
        }

        if (user.branchStatus !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Assigned branch is inactive",
            });
        }

        if (!user.dutyStartTime || !user.dutyEndTime) {
            return res.status(400).json({
                success: false,
                message: "Duty timing is not configured for this user",
            });
        }

        // MySQL server date is authoritative.
        const [attendanceRows] = await db.query(
            `SELECT
        id,
        attendance_date AS attendanceDate,
        check_in_time AS checkInTime,
        check_out_time AS checkOutTime,
        attendance_status AS attendanceStatus
       FROM attendance_records
       WHERE user_id = ?
       AND attendance_date = CURDATE()
       LIMIT 1`,
            [user.id]
        );

        let nextAction = "CHECK_IN";
        let todayAttendance = null;

        if (attendanceRows.length > 0) {
            todayAttendance = attendanceRows[0];

            if (
                todayAttendance.checkInTime &&
                !todayAttendance.checkOutTime
            ) {
                nextAction = "CHECK_OUT";
            }

            if (
                todayAttendance.checkInTime &&
                todayAttendance.checkOutTime
            ) {
                nextAction = "COMPLETED";
            }
        }

        const attendanceToken = jwt.sign(
            {
                userId: user.id,
                role: user.role,
                branchId: user.branchId,
                purpose: "ATTENDANCE",
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "10m",
            }
        );

        return res.status(200).json({
            success: true,
            message: "Attendance login successful",

            attendanceToken,

            user: {
                id: user.id,
                employeeCode: user.employeeCode,
                fullName: user.fullName,
                role: user.role,
                designation: user.designation,
                departmentName: user.departmentName,
                branchId: user.branchId,
                branchName: user.branchName,
                branchCode: user.branchCode,
                dutyStartTime: user.dutyStartTime,
                dutyEndTime: user.dutyEndTime,
            },

            todayAttendance,

            nextAction,
        });
    } catch (error) {
        console.error("Attendance login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = {
    attendanceLogin,
};
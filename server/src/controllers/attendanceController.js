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

const calculateDistance = (
    lat1,
    lon1,
    lat2,
    lon2
) => {
    const earthRadius = 6371000;

    const toRadians = (degree) =>
        (degree * Math.PI) / 180;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadius * c;
};

const validateLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Current GPS location is required",
            });
        }

        const currentLatitude = Number(latitude);
        const currentLongitude = Number(longitude);

        if (
            !Number.isFinite(currentLatitude) ||
            !Number.isFinite(currentLongitude) ||
            currentLatitude < -90 ||
            currentLatitude > 90 ||
            currentLongitude < -180 ||
            currentLongitude > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid GPS coordinates",
            });
        }

        const user = req.attendanceUser;

        const [branches] = await db.query(
            `SELECT
        id,
        branch_name AS branchName,
        latitude,
        longitude,
        status
       FROM branches
       WHERE id = ?
       LIMIT 1`,
            [user.branchId]
        );

        if (branches.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Assigned branch not found",
            });
        }

        const branch = branches[0];

        if (branch.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Assigned branch is inactive",
            });
        }

        if (
            branch.latitude === null ||
            branch.longitude === null
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Branch GPS location is not configured",
            });
        }

        const distance = calculateDistance(
            currentLatitude,
            currentLongitude,
            Number(branch.latitude),
            Number(branch.longitude)
        );

        const roundedDistance =
            Math.round(distance * 100) / 100;

        const allowedRadius = 50;

        if (distance > allowedRadius) {
            return res.status(403).json({
                success: false,
                locationValid: false,
                message:
                    "You are outside the allowed attendance area",
                distanceMeters: roundedDistance,
                allowedRadiusMeters: allowedRadius,
            });
        }

        return res.status(200).json({
            success: true,
            locationValid: true,
            message: "Location verified successfully",
            distanceMeters: roundedDistance,
            allowedRadiusMeters: allowedRadius,
            branchName: branch.branchName,
        });
    } catch (error) {
        console.error(
            "Attendance location validation error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const checkIn = async (req, res) => {
    try {
        const user = req.attendanceUser;

        const {
            latitude,
            longitude,
            remarks,
        } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Live attendance photo is required",
            });
        }

        if (
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Current GPS location is required",
            });
        }

        const currentLatitude = Number(latitude);
        const currentLongitude = Number(longitude);

        if (
            !Number.isFinite(currentLatitude) ||
            !Number.isFinite(currentLongitude)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid GPS coordinates",
            });
        }

        const [branches] = await db.query(
            `SELECT
        id,
        branch_name AS branchName,
        latitude,
        longitude,
        status
       FROM branches
       WHERE id = ?
       LIMIT 1`,
            [user.branchId]
        );

        if (branches.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Assigned branch not found",
            });
        }

        const branch = branches[0];

        if (branch.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Assigned branch is inactive",
            });
        }

        const distance = calculateDistance(
            currentLatitude,
            currentLongitude,
            Number(branch.latitude),
            Number(branch.longitude)
        );

        const roundedDistance =
            Math.round(distance * 100) / 100;

        if (distance > 50) {
            return res.status(403).json({
                success: false,
                message:
                    "You are outside the allowed attendance area",
                distanceMeters: roundedDistance,
                allowedRadiusMeters: 50,
            });
        }

        const [existingRecords] = await db.query(
            `SELECT
        id,
        check_in_time AS checkInTime,
        check_out_time AS checkOutTime
       FROM attendance_records
       WHERE user_id = ?
       AND attendance_date = CURDATE()
       LIMIT 1`,
            [user.id]
        );

        if (
            existingRecords.length > 0 &&
            existingRecords[0].checkInTime
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Check-in has already been completed for today",
            });
        }

        const [timeRows] = await db.query(
            `SELECT
        CURDATE() AS currentDate,
        NOW() AS currentDateTime`
        );

        const currentDate =
            timeRows[0].currentDate;

        const currentDateTime =
            timeRows[0].currentDateTime;

        const dutyStart =
            user.dutyStartTime;

        const dutyEnd =
            user.dutyEndTime;

        const [durationRows] = await db.query(
            `SELECT
        TIMESTAMPDIFF(
          MINUTE,
          CONCAT(?, ' ', ?),
          CONCAT(?, ' ', ?)
        ) AS requiredMinutes,

        CASE
          WHEN ? >
            DATE_ADD(
              CONCAT(?, ' ', ?),
              INTERVAL 15 MINUTE
            )
          THEN 1
          ELSE 0
        END AS isLate`,
            [
                currentDate,
                dutyStart,
                currentDate,
                dutyEnd,

                currentDateTime,
                currentDate,
                dutyStart,
            ]
        );

        const requiredMinutes =
            durationRows[0].requiredMinutes;

        const isLate =
            Boolean(durationRows[0].isLate);

        const photoPath =
            `uploads/attendance/${req.file.filename}`;

        if (existingRecords.length === 0) {
            await db.query(
                `INSERT INTO attendance_records (
          user_id,
          branch_id,
          attendance_date,
          check_in_time,
          check_in_photo_path,
          check_in_latitude,
          check_in_longitude,
          check_in_distance_meters,
          check_in_remarks,
          required_minutes,
          is_late,
          attendance_status
        )
        VALUES (?, ?, CURDATE(), NOW(), ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
                [
                    user.id,
                    user.branchId,
                    photoPath,
                    currentLatitude,
                    currentLongitude,
                    roundedDistance,
                    remarks || null,
                    requiredMinutes,
                    isLate ? 1 : 0,
                ]
            );
        } else {
            await db.query(
                `UPDATE attendance_records
         SET
           check_in_time = NOW(),
           check_in_photo_path = ?,
           check_in_latitude = ?,
           check_in_longitude = ?,
           check_in_distance_meters = ?,
           check_in_remarks = ?,
           required_minutes = ?,
           is_late = ?,
           attendance_status = 'PENDING'
         WHERE id = ?`,
                [
                    photoPath,
                    currentLatitude,
                    currentLongitude,
                    roundedDistance,
                    remarks || null,
                    requiredMinutes,
                    isLate ? 1 : 0,
                    existingRecords[0].id,
                ]
            );
        }

        return res.status(201).json({
            success: true,
            message: "Check-in completed successfully",
            attendance: {
                checkInTime: currentDateTime,
                distanceMeters: roundedDistance,
                isLate,
                status: "PENDING",
            },
        });
    } catch (error) {
        console.error("Attendance check-in error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = {
    attendanceLogin,
    validateLocation,
    checkIn,
};

const checkOut = async (req, res) => {
    try {
        const user = req.attendanceUser;

        const {
            latitude,
            longitude,
            remarks,
        } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Live attendance photo is required",
            });
        }

        if (
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Current GPS location is required",
            });
        }

        const currentLatitude = Number(latitude);
        const currentLongitude = Number(longitude);

        if (
            !Number.isFinite(currentLatitude) ||
            !Number.isFinite(currentLongitude) ||
            currentLatitude < -90 ||
            currentLatitude > 90 ||
            currentLongitude < -180 ||
            currentLongitude > 180
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid GPS coordinates",
            });
        }

        const [branches] = await db.query(
            `SELECT
                id,
                branch_name AS branchName,
                latitude,
                longitude,
                status
             FROM branches
             WHERE id = ?
             LIMIT 1`,
            [user.branchId]
        );

        if (branches.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Assigned branch not found",
            });
        }

        const branch = branches[0];

        if (branch.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Assigned branch is inactive",
            });
        }

        if (
            branch.latitude === null ||
            branch.longitude === null
        ) {
            return res.status(400).json({
                success: false,
                message: "Branch GPS location is not configured",
            });
        }

        const distance = calculateDistance(
            currentLatitude,
            currentLongitude,
            Number(branch.latitude),
            Number(branch.longitude)
        );

        const roundedDistance =
            Math.round(distance * 100) / 100;

        if (distance > 50) {
            return res.status(403).json({
                success: false,
                message:
                    "You are outside the allowed attendance area",
                distanceMeters: roundedDistance,
                allowedRadiusMeters: 50,
            });
        }

        const [records] = await db.query(
            `SELECT
                id,
                check_in_time AS checkInTime,
                check_out_time AS checkOutTime,
                required_minutes AS requiredMinutes
             FROM attendance_records
             WHERE user_id = ?
             AND attendance_date = CURDATE()
             LIMIT 1`,
            [user.id]
        );

        if (records.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Check-in record not found for today",
            });
        }

        const record = records[0];

        if (!record.checkInTime) {
            return res.status(400).json({
                success: false,
                message:
                    "Check-in must be completed before check-out",
            });
        }

        if (record.checkOutTime) {
            return res.status(409).json({
                success: false,
                message:
                    "Check-out has already been completed for today",
            });
        }

        const [calculationRows] = await db.query(
            `SELECT
                NOW() AS currentDateTime,

                TIMESTAMPDIFF(
                    MINUTE,
                    ?,
                    NOW()
                ) AS workedMinutes,

                CASE
                    WHEN NOW() <
                        CONCAT(
                            CURDATE(),
                            ' ',
                            ?
                        )
                    THEN 1
                    ELSE 0
                END AS isEarlyDeparture`,
            [
                record.checkInTime,
                user.dutyEndTime,
            ]
        );

        const currentDateTime =
            calculationRows[0].currentDateTime;

        let workedMinutes =
            Number(calculationRows[0].workedMinutes);

        if (workedMinutes < 0) {
            workedMinutes = 0;
        }

        const requiredMinutes =
            Number(record.requiredMinutes || 0);

        let attendancePercentage = 0;

        if (requiredMinutes > 0) {
            attendancePercentage =
                (workedMinutes / requiredMinutes) * 100;
        }

        attendancePercentage =
            Math.round(attendancePercentage * 100) / 100;

        const isEarlyDeparture =
            Boolean(
                calculationRows[0].isEarlyDeparture
            );

        let attendanceStatus =
            "INSUFFICIENT_ATTENDANCE";

        if (attendancePercentage >= 80) {
            attendanceStatus = "FULL_DAY";
        } else if (attendancePercentage >= 40) {
            attendanceStatus = "PARTIAL_DAY";
        } else if (attendancePercentage > 0) {
            attendanceStatus =
                "INSUFFICIENT_ATTENDANCE";
        } else {
            attendanceStatus =
                "INSUFFICIENT_ATTENDANCE";
        }

        const photoPath =
            `uploads/attendance/${req.file.filename}`;

        await db.query(
            `UPDATE attendance_records
             SET
                check_out_time = NOW(),
                check_out_photo_path = ?,
                check_out_latitude = ?,
                check_out_longitude = ?,
                check_out_distance_meters = ?,
                check_out_remarks = ?,
                worked_minutes = ?,
                attendance_percentage = ?,
                is_early_departure = ?,
                attendance_status = ?
             WHERE id = ?`,
            [
                photoPath,
                currentLatitude,
                currentLongitude,
                roundedDistance,
                remarks || null,
                workedMinutes,
                attendancePercentage,
                isEarlyDeparture ? 1 : 0,
                attendanceStatus,
                record.id,
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Check-out completed successfully",
            attendance: {
                checkOutTime: currentDateTime,
                workedMinutes,
                requiredMinutes,
                attendancePercentage,
                isEarlyDeparture,
                attendanceStatus,
                distanceMeters: roundedDistance,
            },
        });
    } catch (error) {
        console.error(
            "Attendance check-out error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = {
    attendanceLogin,
    validateLocation,
    checkIn,
    checkOut,
};
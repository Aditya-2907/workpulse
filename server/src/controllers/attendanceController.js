const jwt = require("jsonwebtoken");
const fs = require("fs/promises");
const db = require("../config/db");

const {
    uploadAttendancePhoto,
    deleteAttendancePhoto,
} = require("../services/attendancePhotoService");

const removeLocalAttendancePhoto = async (filePath) => {
    if (!filePath) {
        return;
    }

    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                "Failed to remove temporary attendance photo:",
                error
            );
        }
    }
};

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
        DATE_FORMAT(
            u.joining_date,
            '%Y-%m-%d'
        ) AS joiningDate,

        DATE_FORMAT(
            u.leaving_date,
            '%Y-%m-%d'
        ) AS leavingDate,

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

        // Start Aditya - Block new attendance outside employment period

        const [employmentDateRows] = await db.query(
            `SELECT
        DATE_FORMAT(
            CURDATE(),
            '%Y-%m-%d'
        ) AS today`
        );

        const today =
            employmentDateRows[0].today;

        /*
         * Employment date restriction applies only when
         * the user is about to create a NEW attendance.
         *
         * If already checked in today, checkout must remain
         * available so the attendance record does not get stuck.
         */
        if (nextAction === "CHECK_IN") {
            if (
                user.joiningDate &&
                today < user.joiningDate
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        `Attendance is not available before joining date (${user.joiningDate})`,
                });
            }

            if (
                user.leavingDate &&
                today > user.leavingDate
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        `Attendance is not available after leaving date (${user.leavingDate})`,
                });
            }
        }

        // End Aditya

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

        // Start Aditya - Final employment period validation before check-in

        const [employmentRows] = await db.query(
            `SELECT
        DATE_FORMAT(
            joining_date,
            '%Y-%m-%d'
        ) AS joiningDate,

        DATE_FORMAT(
            leaving_date,
            '%Y-%m-%d'
        ) AS leavingDate,

        DATE_FORMAT(
            CURDATE(),
            '%Y-%m-%d'
        ) AS today

     FROM users

     WHERE id = ?
     LIMIT 1`,
            [user.id]
        );

        if (employmentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const employment =
            employmentRows[0];

        if (
            employment.joiningDate &&
            employment.today <
            employment.joiningDate
        ) {
            return res.status(403).json({
                success: false,
                message:
                    `Attendance is not available before joining date (${employment.joiningDate})`,
            });
        }

        if (
            employment.leavingDate &&
            employment.today >
            employment.leavingDate
        ) {
            return res.status(403).json({
                success: false,
                message:
                    `Attendance is not available after leaving date (${employment.leavingDate})`,
            });
        }

        // End Aditya

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

        // Start Aditya - Fix duty duration and late calculation

        const [durationRows] = await db.query(
            `SELECT
        TIMESTAMPDIFF(
            MINUTE,
            CONCAT(CURDATE(), ' ', ?),
            CONCAT(CURDATE(), ' ', ?)
        ) AS requiredMinutes,

        CASE
            WHEN NOW() >
                DATE_ADD(
                    CONCAT(CURDATE(), ' ', ?),
                    INTERVAL 15 MINUTE
                )
            THEN 1
            ELSE 0
        END AS isLate`,
            [
                dutyStart,
                dutyEnd,
                dutyStart,
            ]
        );

        // End Aditya

        const requiredMinutes =
            durationRows[0].requiredMinutes;

        const isLate =
            Boolean(durationRows[0].isLate);

        let uploadedPhoto = null;

        try {
            uploadedPhoto =
                await uploadAttendancePhoto(req.file.path);
        } finally {
            await removeLocalAttendancePhoto(req.file.path);
        }

        const photoPath = uploadedPhoto.url;
        const photoPublicId = uploadedPhoto.publicId;

        try {
            if (existingRecords.length === 0) {
                await db.query(
                    `INSERT INTO attendance_records (
              user_id,
              branch_id,
              attendance_date,
              check_in_time,
              check_in_photo_path,
              check_in_photo_public_id,
              check_in_latitude,
              check_in_longitude,
              check_in_distance_meters,
              check_in_remarks,
              required_minutes,
              is_late,
              attendance_status
            )
            VALUES (?, ?, CURDATE(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
                    [
                        user.id,
                        user.branchId,
                        photoPath,
                        photoPublicId,
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
               check_in_photo_public_id = ?,
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
                        photoPublicId,
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
        } catch (error) {
            try {
                await deleteAttendancePhoto(photoPublicId);
            } catch (cleanupError) {
                console.error(
                    "Failed to rollback Cloudinary check-in photo:",
                    cleanupError
                );
            }

            throw error;
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
    } finally {
        if (req.file?.path) {
            await removeLocalAttendancePhoto(req.file.path);
        }
    }
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

        let uploadedPhoto = null;

        try {
            uploadedPhoto =
                await uploadAttendancePhoto(req.file.path);
        } finally {
            await removeLocalAttendancePhoto(req.file.path);
        }

        const photoPath = uploadedPhoto.url;
        const photoPublicId = uploadedPhoto.publicId;

        try {
            await db.query(
                `UPDATE attendance_records
         SET
            check_out_time = NOW(),
            check_out_photo_path = ?,
            check_out_photo_public_id = ?,
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
                    photoPublicId,
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
        } catch (error) {
            try {
                await deleteAttendancePhoto(photoPublicId);
            } catch (cleanupError) {
                console.error(
                    "Failed to rollback Cloudinary check-out photo:",
                    cleanupError
                );
            }

            throw error;
        }

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
    } finally {
        if (req.file?.path) {
            await removeLocalAttendancePhoto(req.file.path);
        }
    }
};

// Start Aditya - Management Attendance

const getManagementAttendance = async (req, res) => {
    try {
        const currentUser = req.user;

        const {
            startDate,
            endDate,
            employeeId,
            status,
            branchId,
            departmentId,
        } = req.query;

        // ======================================================
        // VALIDATION
        // ======================================================

        const datePattern = /^\d{4}-\d{2}-\d{2}$/;

        if (startDate && !datePattern.test(startDate)) {
            return res.status(400).json({
                success: false,
                message:
                    "startDate must be in YYYY-MM-DD format",
            });
        }

        if (endDate && !datePattern.test(endDate)) {
            return res.status(400).json({
                success: false,
                message:
                    "endDate must be in YYYY-MM-DD format",
            });
        }

        if (
            startDate &&
            endDate &&
            startDate > endDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "startDate cannot be after endDate",
            });
        }

        const allowedStatuses = [
            "PENDING",
            "FULL_DAY",
            "PARTIAL_DAY",
            "INSUFFICIENT_ATTENDANCE",
            "ABSENT",
            "LEAVE",
            "HOLIDAY",
            "INCOMPLETE",
        ];

        if (
            status &&
            !allowedStatuses.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid attendance status",
            });
        }

        let parsedEmployeeId = null;
        let parsedBranchId = null;
        let parsedDepartmentId = null;

        if (employeeId) {
            parsedEmployeeId =
                Number(employeeId);

            if (
                !Number.isInteger(
                    parsedEmployeeId
                ) ||
                parsedEmployeeId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid employeeId",
                });
            }
        }

        if (
            currentUser.role ===
            "SUPER_ADMIN" &&
            branchId
        ) {
            parsedBranchId =
                Number(branchId);

            if (
                !Number.isInteger(
                    parsedBranchId
                ) ||
                parsedBranchId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid branchId",
                });
            }
        }

        if (departmentId) {
            parsedDepartmentId = Number(departmentId);

            if (
                !Number.isInteger(parsedDepartmentId) ||
                parsedDepartmentId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid departmentId",
                });
            }
        }

        if (
            currentUser.role === "ADMIN" &&
            !currentUser.branchId
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "No branch is assigned to this Admin",
            });
        }

        // ======================================================
        // 1. NORMAL ATTENDANCE RECORDS
        // ======================================================

        let attendanceSql = `
            SELECT
                ar.id,

                ar.user_id AS userId,
                u.employee_code AS employeeCode,
                u.full_name AS fullName,
                u.role,
                u.designation,
                u.duty_start_time AS dutyStartTime,
                u.duty_end_time AS dutyEndTime,

                ar.branch_id AS branchId,
                b.branch_name AS branchName,
                b.branch_code AS branchCode,

                u.department_id AS departmentId,
                d.department_name AS departmentName,

                DATE_FORMAT(
                    ar.attendance_date,
                    '%Y-%m-%d'
                ) AS attendanceDate,

                ar.check_in_time AS checkInTime,
                ar.check_out_time AS checkOutTime,

                DATE_FORMAT(
                    ar.check_in_time,
                    '%H:%i:%s'
                ) AS checkInTimeLocal,

                DATE_FORMAT(
                    ar.check_out_time,
                    '%H:%i:%s'
                ) AS checkOutTimeLocal,

                ar.check_in_photo_path AS checkInPhotoPath,
                ar.check_out_photo_path AS checkOutPhotoPath,

                ar.check_in_distance_meters AS checkInDistanceMeters,
                ar.check_out_distance_meters AS checkOutDistanceMeters,

                ar.check_in_remarks AS checkInRemarks,
                ar.check_out_remarks AS checkOutRemarks,

                ar.worked_minutes AS workedMinutes,
                ar.required_minutes AS requiredMinutes,
                ar.attendance_percentage AS attendancePercentage,

                ar.is_late AS isLate,
                ar.is_early_departure AS isEarlyDeparture,

                ar.attendance_status AS attendanceStatus,

                ar.created_at AS createdAt,
                ar.updated_at AS updatedAt

            FROM attendance_records ar

            INNER JOIN users u
                ON u.id = ar.user_id

            LEFT JOIN branches b
                ON b.id = ar.branch_id

            LEFT JOIN departments d
                ON d.id = u.department_id

            WHERE u.role IN (
                'EMPLOYEE',
                'ADMIN'
            )
        `;

        const attendanceParams = [];

        // ------------------------------------------------------
        // Branch isolation
        // ------------------------------------------------------

        if (
            currentUser.role === "ADMIN"
        ) {
            attendanceSql += `
                AND ar.branch_id = ?
            `;

            attendanceParams.push(
                currentUser.branchId
            );
        } else if (parsedBranchId) {
            attendanceSql += `
                AND ar.branch_id = ?
            `;

            attendanceParams.push(
                parsedBranchId
            );
        }

        // ------------------------------------------------------
        // Date filtering
        // ------------------------------------------------------

        if (startDate) {
            attendanceSql += `
                AND ar.attendance_date >= ?
            `;

            attendanceParams.push(
                startDate
            );
        }

        if (endDate) {
            attendanceSql += `
                AND ar.attendance_date <= ?
            `;

            attendanceParams.push(
                endDate
            );
        }

        if (!startDate && !endDate) {
            attendanceSql += `
                AND ar.attendance_date =
                    CURDATE()
            `;
        }

        // ------------------------------------------------------
        // Employee / user filter
        // ------------------------------------------------------

        if (parsedEmployeeId) {
            attendanceSql += `
                AND ar.user_id = ?
            `;

            attendanceParams.push(
                parsedEmployeeId
            );
        }

        if (parsedDepartmentId) {
            attendanceSql += `
                AND u.department_id = ?
            `;

            attendanceParams.push(parsedDepartmentId);
        }

        attendanceSql += `
            ORDER BY
                ar.attendance_date DESC,
                ar.check_in_time DESC,
                u.full_name ASC
        `;

        const [attendanceRows] =
            await db.query(
                attendanceSql,
                attendanceParams
            );

        // ======================================================
        // 2. HOLIDAY RECORDS
        // ======================================================

        /*
        |--------------------------------------------------------------------------
        | Organization-wide holiday -> virtual attendance row
        |--------------------------------------------------------------------------
        |
        | No row is inserted into attendance_records.
        |
        | Eligibility:
        | - EMPLOYEE or ADMIN
        | - ACTIVE account
        | - joined on/before holiday
        | - not left before holiday
        |
        | Precedence later:
        | REAL ATTENDANCE > HOLIDAY > LEAVE
        */

        let holidaySql = `
            SELECT
                h.id AS holidayId,

                DATE_FORMAT(
                    h.holiday_date,
                    '%Y-%m-%d'
                ) AS attendanceDate,

                h.purpose AS holidayPurpose,

                u.id AS userId,
                u.employee_code AS employeeCode,
                u.full_name AS fullName,
                u.role,
                u.designation,
                u.duty_start_time AS dutyStartTime,
                u.duty_end_time AS dutyEndTime,

                u.branch_id AS branchId,
                b.branch_name AS branchName,
                b.branch_code AS branchCode,

                u.department_id AS departmentId,
                d.department_name AS departmentName

            FROM holidays h

            INNER JOIN users u
                ON u.role IN (
                    'EMPLOYEE',
                    'ADMIN'
                )

                AND u.account_status =
                    'ACTIVE'

                AND (
                    u.joining_date IS NULL
                    OR u.joining_date <=
                        h.holiday_date
                )

                AND (
                    u.leaving_date IS NULL
                    OR u.leaving_date >=
                        h.holiday_date
                )

            LEFT JOIN branches b
                ON b.id = u.branch_id

            LEFT JOIN departments d
                ON d.id = u.department_id

            WHERE 1 = 1
        `;

        const holidayParams = [];

        // ------------------------------------------------------
        // Branch isolation
        // ------------------------------------------------------

        if (
            currentUser.role === "ADMIN"
        ) {
            holidaySql += `
                AND u.branch_id = ?
            `;

            holidayParams.push(
                currentUser.branchId
            );

            /*
             * Admin can see holiday rows for:
             * - own branch employees
             * - self
             *
             * Cannot see other Admins.
             */
            holidaySql += `
                AND (
                    u.role = 'EMPLOYEE'
                    OR u.id = ?
                )
            `;

            holidayParams.push(
                currentUser.id
            );
        } else if (parsedBranchId) {
            holidaySql += `
                AND u.branch_id = ?
            `;

            holidayParams.push(
                parsedBranchId
            );
        }

        // ------------------------------------------------------
        // Date filtering
        // ------------------------------------------------------

        if (startDate) {
            holidaySql += `
                AND h.holiday_date >= ?
            `;

            holidayParams.push(
                startDate
            );
        }

        if (endDate) {
            holidaySql += `
                AND h.holiday_date <= ?
            `;

            holidayParams.push(
                endDate
            );
        }

        if (!startDate && !endDate) {
            holidaySql += `
                AND h.holiday_date =
                    CURDATE()
            `;
        }

        // ------------------------------------------------------
        // Employee / user filter
        // ------------------------------------------------------

        if (parsedEmployeeId) {
            holidaySql += `
                AND u.id = ?
            `;

            holidayParams.push(
                parsedEmployeeId
            );
        }

        if (parsedDepartmentId) {
            holidaySql += `
                AND u.department_id = ?
            `;

            holidayParams.push(parsedDepartmentId);
        }

        holidaySql += `
            ORDER BY
                h.holiday_date DESC,
                u.full_name ASC
        `;

        const [holidayRows] =
            await db.query(
                holidaySql,
                holidayParams
            );

        // ======================================================
        // 3. APPROVED LEAVE RECORDS
        // ======================================================

        /*
        |--------------------------------------------------------------------------
        | Expand approved leave into one virtual row per date
        |--------------------------------------------------------------------------
        */

        let leaveSql = `
            WITH RECURSIVE leave_dates AS (

                SELECT
                    l.id AS leaveId,
                    l.user_id AS userId,
                    l.from_date AS leaveDate,
                    l.to_date AS toDate,
                    l.reason

                FROM leaves l

                WHERE l.status = 'APPROVED'

                UNION ALL

                SELECT
                    leaveId,
                    userId,

                    DATE_ADD(
                        leaveDate,
                        INTERVAL 1 DAY
                    ),

                    toDate,
                    reason

                FROM leave_dates

                WHERE leaveDate < toDate
            )

            SELECT
                ld.leaveId,
                ld.userId,

                u.employee_code AS employeeCode,
                u.full_name AS fullName,
                u.role,
                u.designation,
                u.duty_start_time AS dutyStartTime,
                u.duty_end_time AS dutyEndTime,

                u.branch_id AS branchId,
                b.branch_name AS branchName,
                b.branch_code AS branchCode,

                u.department_id AS departmentId,
                d.department_name AS departmentName,

                DATE_FORMAT(
                    ld.leaveDate,
                    '%Y-%m-%d'
                ) AS attendanceDate,

                ld.reason AS leaveReason

            FROM leave_dates ld

            INNER JOIN users u
                ON u.id = ld.userId

            LEFT JOIN branches b
                ON b.id = u.branch_id

            LEFT JOIN departments d
                ON d.id = u.department_id

            WHERE u.role IN (
                'EMPLOYEE',
                'ADMIN'
            )
        `;

        const leaveParams = [];

        // ------------------------------------------------------
        // Branch isolation
        // ------------------------------------------------------

        if (
            currentUser.role === "ADMIN"
        ) {
            leaveSql += `
                AND u.branch_id = ?
            `;

            leaveParams.push(
                currentUser.branchId
            );

            leaveSql += `
                AND (
                    u.role = 'EMPLOYEE'
                    OR u.id = ?
                )
            `;

            leaveParams.push(
                currentUser.id
            );
        } else if (parsedBranchId) {
            leaveSql += `
                AND u.branch_id = ?
            `;

            leaveParams.push(
                parsedBranchId
            );
        }

        // ------------------------------------------------------
        // Date filtering
        // ------------------------------------------------------

        if (startDate) {
            leaveSql += `
                AND ld.leaveDate >= ?
            `;

            leaveParams.push(
                startDate
            );
        }

        if (endDate) {
            leaveSql += `
                AND ld.leaveDate <= ?
            `;

            leaveParams.push(
                endDate
            );
        }

        if (!startDate && !endDate) {
            leaveSql += `
                AND ld.leaveDate =
                    CURDATE()
            `;
        }

        // ------------------------------------------------------
        // Employee / user filter
        // ------------------------------------------------------

        if (parsedEmployeeId) {
            leaveSql += `
                AND ld.userId = ?
            `;

            leaveParams.push(
                parsedEmployeeId
            );
        }

        if (parsedDepartmentId) {
            leaveSql += `
                AND u.department_id = ?
            `;

            leaveParams.push(parsedDepartmentId);
        }

        leaveSql += `
            ORDER BY
                ld.leaveDate DESC,
                u.full_name ASC
        `;

        const [leaveRows] =
            await db.query(
                leaveSql,
                leaveParams
            );
        
        // Start Aditya - Build potential ABSENT working-day candidates

        /*
        |--------------------------------------------------------------------------
        | Potential ABSENT candidates
        |--------------------------------------------------------------------------
        |
        | Generate one row for every eligible user + past date.
        |
        | Final ABSENT filtering happens later using precedence:
        |
        | REAL ATTENDANCE > HOLIDAY > LEAVE > ABSENT
        |
        | Weekly-off dates are excluded here.
        | Today and future dates are never generated as ABSENT.
        */

        let absentSql = `
    WITH RECURSIVE date_range AS (

        SELECT
            ${startDate
                ? "CAST(? AS DATE)"
                : endDate
                    ? "CAST(? AS DATE)"
                    : "DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
            } AS attendanceDate

        UNION ALL

        SELECT
            DATE_ADD(
                attendanceDate,
                INTERVAL 1 DAY
            )

        FROM date_range

        WHERE attendanceDate <
            ${endDate
                ? "LEAST(CAST(? AS DATE), DATE_SUB(CURDATE(), INTERVAL 1 DAY))"
                : startDate
                    ? "DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
                    : "DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
            }
    )

    SELECT
        u.id AS userId,

        u.employee_code AS employeeCode,
        u.full_name AS fullName,
        u.role,
        u.designation,
        u.duty_start_time AS dutyStartTime,
        u.duty_end_time AS dutyEndTime,

        u.branch_id AS branchId,
        b.branch_name AS branchName,
        b.branch_code AS branchCode,

        u.department_id AS departmentId,
        d.department_name AS departmentName,

        DATE_FORMAT(
            dr.attendanceDate,
            '%Y-%m-%d'
        ) AS attendanceDate

    FROM date_range dr

    INNER JOIN users u
        ON u.role IN (
            'EMPLOYEE',
            'ADMIN'
        )

        AND u.branch_id IS NOT NULL

        AND (
            u.joining_date IS NULL
            OR u.joining_date <=
                dr.attendanceDate
        )

        AND (
            u.leaving_date IS NULL
            OR u.leaving_date >=
                dr.attendanceDate
        )

        /*
         * PENDING_APPROVAL and REJECTED users must
         * never create historical ABSENT rows.
         *
         * ACTIVE and INACTIVE are allowed here so that
         * an employee who later becomes inactive does
         * not lose historical attendance expectations
         * for dates inside their employment period.
         */
        AND u.account_status IN (
            'ACTIVE',
            'INACTIVE'
        )

    INNER JOIN branches b
        ON b.id = u.branch_id

    LEFT JOIN departments d
        ON d.id = u.department_id

    LEFT JOIN branch_weekly_offs bwo
        ON bwo.branch_id = u.branch_id

        AND bwo.weekday =
            UPPER(
                DAYNAME(
                    dr.attendanceDate
                )
            )

    WHERE
        dr.attendanceDate <
            CURDATE()

        AND bwo.id IS NULL
`;

        const absentParams = [];

        /*
         * Parameters used by recursive date range.
         */

        if (startDate) {
            absentParams.push(startDate);
        } else if (endDate) {
            absentParams.push(endDate);
        }

        if (endDate) {
            absentParams.push(endDate);
        }

        // ------------------------------------------------------
        // Branch isolation
        // ------------------------------------------------------

        if (
            currentUser.role === "ADMIN"
        ) {
            absentSql += `
        AND u.branch_id = ?

        AND (
            u.role = 'EMPLOYEE'
            OR u.id = ?
        )
    `;

            absentParams.push(
                currentUser.branchId,
                currentUser.id
            );
        } else if (parsedBranchId) {
            absentSql += `
        AND u.branch_id = ?
    `;

            absentParams.push(
                parsedBranchId
            );
        }

        // ------------------------------------------------------
        // Employee / user filter
        // ------------------------------------------------------

        if (parsedEmployeeId) {
            absentSql += `
        AND u.id = ?
    `;

            absentParams.push(
                parsedEmployeeId
            );
        }

        if (parsedDepartmentId) {
            absentSql += `
        AND u.department_id = ?
    `;

            absentParams.push(parsedDepartmentId);
        }

        absentSql += `
    ORDER BY
        dr.attendanceDate DESC,
        u.full_name ASC
`;

        let absentCandidateRows = [];

        /*
         * When no date range is supplied, the Attendance page
         * currently represents today only.
         *
         * Since today must not become ABSENT before the duty
         * period is complete, no ABSENT candidate is generated
         * for that default view.
         *
         * A historical range generates ABSENT candidates.
         */

        if (startDate || endDate) {
            const [rows] = await db.query(
                absentSql,
                absentParams
            );

            absentCandidateRows = rows;
        }

        // End Aditya

        // ======================================================
        // 4. NORMALIZE REAL ATTENDANCE
        // ======================================================

        // Start Aditya - Normalize attendance and derive INCOMPLETE status

        const [serverDateRows] = await db.query(`
    SELECT DATE_FORMAT(
        CURDATE(),
        '%Y-%m-%d'
    ) AS today
`);

        const serverToday =
            serverDateRows[0].today;

        const normalAttendanceRecords =
            attendanceRows.map((row) => {

                let effectiveAttendanceStatus =
                    row.attendanceStatus;

                /*
                 * If an older attendance record has check-in
                 * but no check-out, it is an incomplete attendance.
                 *
                 * Today's open attendance remains PENDING because
                 * the user may still check out later.
                 */
                if (
                    row.attendanceDate < serverToday &&
                    row.checkInTime &&
                    !row.checkOutTime
                ) {
                    effectiveAttendanceStatus =
                        "INCOMPLETE";
                }

                return {
                    ...row,

                    attendanceStatus:
                        effectiveAttendanceStatus,

                    isLate:
                        Boolean(
                            row.isLate
                        ),

                    isEarlyDeparture:
                        Boolean(
                            row.isEarlyDeparture
                        ),

                    workedMinutes:
                        row.workedMinutes !== null
                            ? Number(
                                row.workedMinutes
                            )
                            : null,

                    requiredMinutes:
                        row.requiredMinutes !== null
                            ? Number(
                                row.requiredMinutes
                            )
                            : null,

                    attendancePercentage:
                        row.attendancePercentage !== null
                            ? Number(
                                row.attendancePercentage
                            )
                            : null,

                    checkInDistanceMeters:
                        row.checkInDistanceMeters !== null
                            ? Number(
                                row.checkInDistanceMeters
                            )
                            : null,

                    checkOutDistanceMeters:
                        row.checkOutDistanceMeters !== null
                            ? Number(
                                row.checkOutDistanceMeters
                            )
                            : null,

                    leaveReason: null,
                    holidayPurpose: null,

                    recordType:
                        "ATTENDANCE",
                };
            });

        // End Aditya

        // ======================================================
        // 5. REAL ATTENDANCE KEYS
        // ======================================================

        const realAttendanceKeys =
            new Set(
                normalAttendanceRecords.map(
                    (record) =>
                        `${record.userId}-${record.attendanceDate}`
                )
            );

        // ======================================================
        // 6. BUILD VIRTUAL HOLIDAY ROWS
        // ======================================================

        /*
         * REAL ATTENDANCE wins over HOLIDAY.
         */

        const virtualHolidayRecords =
            holidayRows
                .filter(
                    (holiday) =>
                        !realAttendanceKeys.has(
                            `${holiday.userId}-${holiday.attendanceDate}`
                        )
                )
                .map((holiday) => ({
                    id:
                        `HOLIDAY-${holiday.holidayId}-${holiday.userId}-${holiday.attendanceDate}`,

                    userId:
                        holiday.userId,

                    employeeCode:
                        holiday.employeeCode,

                    fullName:
                        holiday.fullName,

                    role:
                        holiday.role,

                    designation:
                        holiday.designation,

                    dutyStartTime:
                        holiday.dutyStartTime,

                    dutyEndTime:
                        holiday.dutyEndTime,

                    branchId:
                        holiday.branchId,

                    branchName:
                        holiday.branchName,

                    branchCode:
                        holiday.branchCode,

                    departmentId:
                        holiday.departmentId,

                    departmentName:
                        holiday.departmentName,

                    attendanceDate:
                        holiday.attendanceDate,

                    checkInTime: null,
                    checkOutTime: null,

                    checkInPhotoPath: null,
                    checkOutPhotoPath: null,

                    checkInDistanceMeters: null,
                    checkOutDistanceMeters: null,

                    checkInRemarks: null,
                    checkOutRemarks: null,

                    workedMinutes: null,
                    requiredMinutes: null,
                    attendancePercentage: null,

                    isLate: false,
                    isEarlyDeparture: false,

                    attendanceStatus:
                        "HOLIDAY",

                    leaveReason: null,

                    holidayPurpose:
                        holiday.holidayPurpose,

                    createdAt: null,
                    updatedAt: null,

                    recordType:
                        "HOLIDAY",
                }));

        // ======================================================
        // 7. HOLIDAY KEYS
        // ======================================================

        /*
         * HOLIDAY wins over LEAVE.
         */

        const holidayKeys =
            new Set(
                virtualHolidayRecords.map(
                    (record) =>
                        `${record.userId}-${record.attendanceDate}`
                )
            );

        // ======================================================
        // 8. BUILD VIRTUAL LEAVE ROWS
        // ======================================================

        /*
         * LEAVE is only shown if:
         *
         * - no real attendance exists
         * - no organization holiday exists
         */

        const virtualLeaveRecords =
            leaveRows
                .filter((leave) => {
                    const key =
                        `${leave.userId}-${leave.attendanceDate}`;

                    return (
                        !realAttendanceKeys.has(
                            key
                        ) &&
                        !holidayKeys.has(
                            key
                        )
                    );
                })
                .map((leave) => ({
                    id:
                        `LEAVE-${leave.leaveId}-${leave.attendanceDate}`,

                    userId:
                        leave.userId,

                    employeeCode:
                        leave.employeeCode,

                    fullName:
                        leave.fullName,

                    role:
                        leave.role,

                    designation:
                        leave.designation,

                    dutyStartTime:
                        leave.dutyStartTime,

                    dutyEndTime:
                        leave.dutyEndTime,

                    branchId:
                        leave.branchId,

                    branchName:
                        leave.branchName,

                    branchCode:
                        leave.branchCode,

                    departmentId:
                        leave.departmentId,

                    departmentName:
                        leave.departmentName,

                    attendanceDate:
                        leave.attendanceDate,

                    checkInTime: null,
                    checkOutTime: null,

                    checkInPhotoPath: null,
                    checkOutPhotoPath: null,

                    checkInDistanceMeters: null,
                    checkOutDistanceMeters: null,

                    checkInRemarks: null,
                    checkOutRemarks: null,

                    workedMinutes: null,
                    requiredMinutes: null,
                    attendancePercentage: null,

                    isLate: false,
                    isEarlyDeparture: false,

                    attendanceStatus:
                        "LEAVE",

                    leaveReason:
                        leave.leaveReason,

                    holidayPurpose: null,

                    createdAt: null,
                    updatedAt: null,

                    recordType:
                        "LEAVE",
                }));
        
        // Start Aditya - Build virtual ABSENT rows

        // ======================================================
        // 9. LEAVE KEYS
        // ======================================================

        /*
         * Precedence:
         *
         * REAL ATTENDANCE > HOLIDAY > LEAVE > ABSENT
         */

        const leaveKeys =
            new Set(
                virtualLeaveRecords.map(
                    (record) =>
                        `${record.userId}-${record.attendanceDate}`
                )
            );

        // ======================================================
        // 10. BUILD VIRTUAL ABSENT ROWS
        // ======================================================

        const virtualAbsentRecords =
            absentCandidateRows
                .filter((candidate) => {
                    const key =
                        `${candidate.userId}-${candidate.attendanceDate}`;

                    return (
                        !realAttendanceKeys.has(key) &&
                        !holidayKeys.has(key) &&
                        !leaveKeys.has(key)
                    );
                })
                .map((candidate) => ({
                    id:
                        `ABSENT-${candidate.userId}-${candidate.attendanceDate}`,

                    userId:
                        candidate.userId,

                    employeeCode:
                        candidate.employeeCode,

                    fullName:
                        candidate.fullName,

                    role:
                        candidate.role,

                    designation:
                        candidate.designation,

                    dutyStartTime:
                        candidate.dutyStartTime,

                    dutyEndTime:
                        candidate.dutyEndTime,

                    branchId:
                        candidate.branchId,

                    branchName:
                        candidate.branchName,

                    branchCode:
                        candidate.branchCode,

                    departmentId:
                        candidate.departmentId,

                    departmentName:
                        candidate.departmentName,

                    attendanceDate:
                        candidate.attendanceDate,

                    checkInTime: null,
                    checkOutTime: null,

                    checkInPhotoPath: null,
                    checkOutPhotoPath: null,

                    checkInDistanceMeters: null,
                    checkOutDistanceMeters: null,

                    checkInRemarks: null,
                    checkOutRemarks: null,

                    workedMinutes: null,
                    requiredMinutes: null,
                    attendancePercentage: null,

                    isLate: false,
                    isEarlyDeparture: false,

                    attendanceStatus:
                        "ABSENT",

                    leaveReason: null,
                    holidayPurpose: null,

                    createdAt: null,
                    updatedAt: null,

                    recordType:
                        "ABSENT",
                }));

        // End Aditya

        // ======================================================
        // 9. MERGE
        // ======================================================

        // Start Aditya - Merge virtual absent attendance records

        let attendanceRecords = [
            ...normalAttendanceRecords,
            ...virtualHolidayRecords,
            ...virtualLeaveRecords,
            ...virtualAbsentRecords,
        ];

        // End Aditya

        // ======================================================
        // 10. FINAL STATUS FILTER
        // ======================================================

        if (status) {
            attendanceRecords =
                attendanceRecords.filter(
                    (record) =>
                        record.attendanceStatus ===
                        status
                );
        }

        // ======================================================
        // 11. FINAL SORT
        // ======================================================

        attendanceRecords.sort(
            (a, b) => {
                if (
                    a.attendanceDate !==
                    b.attendanceDate
                ) {
                    return b.attendanceDate.localeCompare(
                        a.attendanceDate
                    );
                }

                return (
                    a.fullName || ""
                ).localeCompare(
                    b.fullName || ""
                );
            }
        );

        // ======================================================
        // 12. SUMMARY
        // ======================================================

        const summary = {
            totalRecords:
                attendanceRecords.length,

            fullDay:
                attendanceRecords.filter(
                    (record) =>
                        record.attendanceStatus ===
                        "FULL_DAY"
                ).length,

            partialDay:
                attendanceRecords.filter(
                    (record) =>
                        record.attendanceStatus ===
                        "PARTIAL_DAY"
                ).length,

            insufficientAttendance:
                attendanceRecords.filter(
                    (record) =>
                        record.attendanceStatus ===
                        "INSUFFICIENT_ATTENDANCE"
                ).length,

            pending:
                attendanceRecords.filter(
                    (record) =>
                        record.attendanceStatus ===
                        "PENDING"
                ).length,

            incomplete:
                attendanceRecords.filter(
                    (record) =>
                        record.attendanceStatus ===
                        "INCOMPLETE"
                ).length,

            absent:
                attendanceRecords.filter(
                    (record) =>
                        record.attendanceStatus ===
                        "ABSENT"
                ).length,

            leave:
                attendanceRecords.filter(
                    (record) =>
                        record.attendanceStatus ===
                        "LEAVE"
                ).length,

            holiday:
                attendanceRecords.filter(
                    (record) =>
                        record.attendanceStatus ===
                        "HOLIDAY"
                ).length,

            late:
                attendanceRecords.filter(
                    (record) =>
                        record.isLate
                ).length,

            earlyDeparture:
                attendanceRecords.filter(
                    (record) =>
                        record.isEarlyDeparture
                ).length,
        };

        // ======================================================
        // RESPONSE
        // ======================================================

        return res.status(200).json({
            success: true,

            filters: {
                startDate:
                    startDate || null,

                endDate:
                    endDate || null,

                employeeId:
                    parsedEmployeeId,

                status:
                    status || null,

                branchId:
                    currentUser.role ===
                        "ADMIN"
                        ? currentUser.branchId
                        : parsedBranchId,

                departmentId:
                    parsedDepartmentId,
            },

            summary,

            attendanceRecords,
        });
    } catch (error) {
        console.error(
            "Get management attendance error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};

// End Aditya - Management Attendance

module.exports = {
    attendanceLogin,
    validateLocation,
    checkIn,
    checkOut,
    getManagementAttendance,
};

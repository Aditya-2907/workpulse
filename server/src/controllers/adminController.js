const bcrypt = require("bcryptjs");
const db = require("../config/db");
const generateEmployeeCode = require("../utils/generateEmployeeCode");
const { writeAuditLog } = require("../services/auditService");


// ======================================================
// SUPER ADMIN: CREATE ADMIN DIRECTLY
// ======================================================

const createAdmin = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            fullName,
            dateOfBirth,
            gender,
            phone,
            email,
            password,
            branchId,
            departmentId,
            designation,
            address,
            pincode,
            qualification,
            computerSkill,
            aadhaarNumber,
            panNumber,
            dutyStartTime,
            dutyEndTime,
            joiningDate,
        } = req.body;

        if (
            !fullName ||
            !phone ||
            !password ||
            !branchId ||
            !departmentId ||
            !designation ||
            !aadhaarNumber ||
            !dutyStartTime ||
            !dutyEndTime ||
            !joiningDate
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Required admin fields are missing",
            });
        }

        if (password.length < 8) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 8 characters",
            });
        }

        // --------------------------------------------------
        // Validate Branch
        // --------------------------------------------------

        const [branch] = await connection.query(
            `SELECT id
             FROM branches
             WHERE id = ?
               AND status = 'ACTIVE'
             LIMIT 1`,
            [branchId]
        );

        if (branch.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Invalid or inactive branch",
            });
        }

        // --------------------------------------------------
        // Validate Department
        // --------------------------------------------------

        const [department] = await connection.query(
            `SELECT id
             FROM departments
             WHERE id = ?
               AND status = 'ACTIVE'
             LIMIT 1`,
            [departmentId]
        );

        if (department.length === 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Invalid or inactive department",
            });
        }

        // --------------------------------------------------
        // Duplicate Check
        // Employee Code is NOT checked here because
        // WorkPulse generates it automatically.
        // --------------------------------------------------

        const [existingUser] = await connection.query(
            `SELECT id
             FROM users
             WHERE phone = ?
                OR (? IS NOT NULL AND email = ?)
                OR aadhaar_number = ?
             LIMIT 1`,
            [
                phone,
                email || null,
                email || null,
                aadhaarNumber,
            ]
        );

        if (existingUser.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "Phone, email or Aadhaar already exists",
            });
        }

        // --------------------------------------------------
        // Generate ADM001 / ADM002 / ADM003...
        // --------------------------------------------------

        const employeeCode =
            await generateEmployeeCode(
                connection,
                "ADMIN"
            );

        const passwordHash =
            await bcrypt.hash(password, 10);

        // --------------------------------------------------
        // Create Admin
        // --------------------------------------------------

        const [result] = await connection.query(
            `INSERT INTO users (
                employee_code,
                full_name,
                date_of_birth,
                gender,
                phone,
                email,
                password_hash,
                must_change_password,
                role,
                account_status,
                branch_id,
                department_id,
                designation,
                address,
                pincode,
                qualification,
                computer_skill,
                aadhaar_number,
                pan_number,
                duty_start_time,
                duty_end_time,
                joining_date,
                created_by
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, TRUE,
                'ADMIN',
                'ACTIVE',
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
                employeeCode,
                fullName.trim(),
                dateOfBirth || null,
                gender || null,
                phone.trim(),
                email?.trim() || null,
                passwordHash,
                branchId,
                departmentId,
                designation.trim(),
                address?.trim() || null,
                pincode?.trim() || null,
                qualification?.trim() || null,
                Boolean(computerSkill),
                aadhaarNumber.trim(),
                panNumber?.trim() || null,
                dutyStartTime,
                dutyEndTime,
                joiningDate,
                req.user.id,
            ]
        );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "ADMIN_CREATED",
            entityType: "USER",
            entityId: result.insertId,
            newData: { employeeCode, role: "ADMIN", branchId, departmentId, mustChangePassword: true },
            req,
        });

        await connection.commit();

        return res.status(201).json({
            success: true,
            message:
                "Admin created. They must set a private password at first sign-in.",
            adminId: result.insertId,
            employeeCode,
        });
    } catch (error) {
        await connection.rollback();

        console.error(
            "Create admin error:",
            error
        );

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "A duplicate admin record already exists",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    } finally {
        connection.release();
    }
};


// ======================================================
// SUPER ADMIN: GET ALL ADMINS
// ======================================================

const getAdmins = async (req, res) => {
    try {
        const [admins] = await db.query(
            `SELECT
                u.id,
                u.employee_code AS employeeCode,
                u.full_name AS fullName,
                DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
                u.gender AS gender,
                u.phone,
                u.email,
                u.designation,
                u.account_status AS accountStatus,
                u.duty_start_time AS dutyStartTime,
                u.duty_end_time AS dutyEndTime,
                DATE_FORMAT(u.joining_date, '%Y-%m-%d') AS joiningDate,
                DATE_FORMAT(u.leaving_date, '%Y-%m-%d') AS leavingDate,

                b.id AS branchId,
                b.branch_name AS branchName,

                d.id AS departmentId,
                d.department_name AS departmentName,

                u.created_at AS createdAt

            FROM users u

            LEFT JOIN branches b
                ON b.id = u.branch_id

            LEFT JOIN departments d
                ON d.id = u.department_id

            WHERE u.role = 'ADMIN'

            ORDER BY u.id DESC`
        );

        return res.status(200).json({
            success: true,
            admins,
        });
    } catch (error) {
        console.error(
            "Get admins error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ======================================================
// SUPER ADMIN: GET ONE ADMIN
// ======================================================

const getAdminById = async (req, res) => {
    try {
        const { id } = req.params;

        const [admins] = await db.query(
            `SELECT
                u.id,
                u.employee_code AS employeeCode,
                u.full_name AS fullName,
                DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
                u.gender,
                u.phone,
                u.email,
                u.branch_id AS branchId,
                u.department_id AS departmentId,
                u.designation,
                u.address,
                u.pincode,
                u.qualification,
                u.computer_skill AS computerSkill,
                u.aadhaar_number AS aadhaarNumber,
                u.pan_number AS panNumber,
                u.duty_start_time AS dutyStartTime,
                u.duty_end_time AS dutyEndTime,
                DATE_FORMAT(u.joining_date, '%Y-%m-%d') AS joiningDate,
                DATE_FORMAT(u.leaving_date, '%Y-%m-%d') AS leavingDate,
                u.account_status AS accountStatus

            FROM users u

            WHERE u.id = ?
              AND u.role = 'ADMIN'

            LIMIT 1`,
            [id]
        );

        if (admins.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admin not found",
            });
        }

        const admin = admins[0];

        const maskAadhaar = (value) => {
            if (!value) return null;

            const text = String(value);
            const last4 = text.slice(-4);

            return `********${last4}`;
        };

        const maskPan = (value) => {
            if (!value) return null;

            const text = String(value);

            if (text.length <= 4) {
                return "****";
            }

            return `${text.slice(
                0,
                2
            )}******${text.slice(-2)}`;
        };

        return res.status(200).json({
            success: true,

            admin: {
                id: admin.id,
                employeeCode:
                    admin.employeeCode,
                fullName:
                    admin.fullName,
                dateOfBirth: admin.dateOfBirth,
                gender: admin.gender,
                phone:
                    admin.phone,
                email:
                    admin.email,
                branchId:
                    admin.branchId,
                departmentId:
                    admin.departmentId,
                designation:
                    admin.designation,
                address:
                    admin.address,
                pincode:
                    admin.pincode,
                qualification:
                    admin.qualification,
                computerSkill:
                    Boolean(
                        admin.computerSkill
                    ),
                dutyStartTime:
                    admin.dutyStartTime,
                dutyEndTime:
                    admin.dutyEndTime,
                joiningDate:
                    admin.joiningDate,
                leavingDate:
                    admin.leavingDate,
                accountStatus:
                    admin.accountStatus,

                aadhaarMasked:
                    maskAadhaar(
                        admin.aadhaarNumber
                    ),

                panMasked:
                    maskPan(
                        admin.panNumber
                    ),

                hasAadhaar:
                    Boolean(
                        admin.aadhaarNumber
                    ),

                hasPan:
                    Boolean(
                        admin.panNumber
                    ),
            },
        });
    } catch (error) {
        console.error(
            "Get admin by ID error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


// ======================================================
// SUPER ADMIN: UPDATE ADMIN
// Employee Code can NEVER be changed.
// ======================================================

const updateAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            fullName,
            dateOfBirth,
            gender,
            phone,
            email,
            branchId,
            departmentId,
            designation,
            address,
            pincode,
            qualification,
            computerSkill,
            aadhaarNumber,
            panNumber,
            dutyStartTime,
            dutyEndTime,
            joiningDate,
        } = req.body;

        const [admins] = await db.query(
            `SELECT
                id,
                employee_code,
                aadhaar_number,
                pan_number
             FROM users
             WHERE id = ?
               AND role = 'ADMIN'
             LIMIT 1`,
            [id]
        );

        if (admins.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admin not found",
            });
        }

        if (
            !fullName ||
            !phone ||
            !branchId ||
            !departmentId ||
            !designation ||
            !dutyStartTime ||
            !dutyEndTime ||
            !joiningDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Required admin fields are missing",
            });
        }

        // --------------------------------------------------
        // Validate Branch
        // --------------------------------------------------

        const [branch] = await db.query(
            `SELECT id
             FROM branches
             WHERE id = ?
               AND status = 'ACTIVE'
             LIMIT 1`,
            [branchId]
        );

        if (branch.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid or inactive branch",
            });
        }

        // --------------------------------------------------
        // Validate Department
        // --------------------------------------------------

        const [department] = await db.query(
            `SELECT id
             FROM departments
             WHERE id = ?
               AND status = 'ACTIVE'
             LIMIT 1`,
            [departmentId]
        );

        if (department.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid or inactive department",
            });
        }

        // --------------------------------------------------
        // Preserve Aadhaar and PAN when blank
        // --------------------------------------------------

        const finalAadhaar =
            aadhaarNumber &&
                String(aadhaarNumber).trim()
                ? String(
                    aadhaarNumber
                ).trim()
                : admins[0]
                    .aadhaar_number;

        const finalPan =
            panNumber !== undefined &&
                panNumber !== null &&
                String(panNumber).trim()
                ? String(
                    panNumber
                ).trim()
                : admins[0]
                    .pan_number;

        // --------------------------------------------------
        // Duplicate Check
        // Employee code is intentionally NOT editable.
        // --------------------------------------------------

        const [duplicate] = await db.query(
            `SELECT id
             FROM users
             WHERE id <> ?
               AND (
                    phone = ?
                    OR (
                        ? IS NOT NULL
                        AND email = ?
                    )
                    OR (
                        ? IS NOT NULL
                        AND aadhaar_number = ?
                    )
               )
             LIMIT 1`,
            [
                id,
                phone,
                email?.trim() || null,
                email?.trim() || null,
                finalAadhaar || null,
                finalAadhaar || null,
            ]
        );

        if (duplicate.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Phone, email or Aadhaar already exists",
            });
        }

        // --------------------------------------------------
        // Update
        // employee_code is intentionally NOT updated
        // --------------------------------------------------

        await db.query(
            `UPDATE users
             SET
                full_name = ?,
                date_of_birth = ?,
                gender = ?,
                phone = ?,
                email = ?,
                branch_id = ?,
                department_id = ?,
                designation = ?,
                address = ?,
                pincode = ?,
                qualification = ?,
                computer_skill = ?,
                aadhaar_number = ?,
                pan_number = ?,
                duty_start_time = ?,
                duty_end_time = ?,
                joining_date = ?

             WHERE id = ?
               AND role = 'ADMIN'`,
            [
                fullName.trim(),
                dateOfBirth || null,
                gender || null,
                phone.trim(),
                email?.trim() || null,
                branchId,
                departmentId,
                designation.trim(),
                address?.trim() || null,
                pincode?.trim() || null,
                qualification?.trim() ||
                null,
                Boolean(computerSkill),
                finalAadhaar || null,
                finalPan || null,
                dutyStartTime,
                dutyEndTime,
                joiningDate,
                id,
            ]
        );

        await writeAuditLog(db, {
            actorId: req.user.id,
            action: "ADMIN_UPDATED",
            entityType: "USER",
            entityId: id,
            newData: { branchId, departmentId, designation: designation.trim() },
            req,
        });

        return res.status(200).json({
            success: true,
            message:
                "Admin updated successfully",
        });
    } catch (error) {
        console.error(
            "Update admin error:",
            error
        );

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "Phone, email or Aadhaar already exists",
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};


// ======================================================
// SUPER ADMIN: ACTIVE / INACTIVE
// Pending/Rejected Admin must use approval workflow.
// ======================================================

const updateAdminStatus = async (
    req,
    res
) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (
            ![
                "ACTIVE",
                "INACTIVE",
            ].includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Status must be ACTIVE or INACTIVE",
            });
        }

        const [admins] = await db.query(
            `SELECT
                id,
                account_status
             FROM users
             WHERE id = ?
               AND role = 'ADMIN'
             LIMIT 1`,
            [id]
        );

        if (admins.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Admin not found",
            });
        }

        const currentStatus =
            admins[0].account_status;

        if (
            currentStatus ===
            "PENDING_APPROVAL" ||
            currentStatus === "REJECTED"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Pending or rejected Admins must be handled through the approval workflow",
            });
        }

        await db.query(
            `UPDATE users
             SET
                account_status = ?,

                leaving_date =
                    CASE
                        WHEN ? = 'INACTIVE'
                            THEN COALESCE(
                                leaving_date,
                                CURDATE()
                            )
                        ELSE NULL
                    END

             WHERE id = ?
               AND role = 'ADMIN'`,
            [
                status,
                status,
                id,
            ]
        );

        await writeAuditLog(db, {
            actorId: req.user.id,
            action: "ADMIN_STATUS_CHANGED",
            entityType: "USER",
            entityId: id,
            oldData: { accountStatus: currentStatus },
            newData: { accountStatus: status },
            req,
        });

        return res.status(200).json({
            success: true,
            message:
                `Admin marked as ${status}`,
        });
    } catch (error) {
        console.error(
            "Update admin status error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};

// ======================================================
// SUPER ADMIN: RESET AN ADMIN PASSWORD
// Passwords are one-way bcrypt hashes and cannot be viewed.
// ======================================================

const resetAdminPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword, confirmPassword } = req.body;

        if (
            typeof newPassword !== "string" ||
            typeof confirmPassword !== "string" ||
            !newPassword ||
            !confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password are required",
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

        const [admins] = await db.query(
            `SELECT id
             FROM users
             WHERE id = ?
               AND role = 'ADMIN'
             LIMIT 1`,
            [id]
        );

        if (admins.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admin not found",
            });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await db.query(
            `UPDATE users
             SET password_hash = ?,
                 must_change_password = TRUE,
                 token_version = token_version + 1
             WHERE id = ?
               AND role = 'ADMIN'`,
            [passwordHash, id]
        );

        await writeAuditLog(db, {
            actorId: req.user.id,
            action: "ADMIN_TEMPORARY_PASSWORD_RESET",
            entityType: "USER",
            entityId: id,
            newData: { mustChangePassword: true },
            req,
        });

        return res.status(200).json({
            success: true,
            message: "Temporary password set. The Admin must change it at next sign-in.",
        });
    } catch (error) {
        console.error("Reset admin password error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};


module.exports = {
    createAdmin,
    getAdmins,
    getAdminById,
    updateAdmin,
    updateAdminStatus,
    resetAdminPassword,
};

const bcrypt = require("bcryptjs");
const db = require("../config/db");

const createAdmin = async (req, res) => {
    try {
        const {
            employeeCode,
            fullName,
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
            !employeeCode ||
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
            return res.status(400).json({
                success: false,
                message: "Required admin fields are missing",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters",
            });
        }

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
                message: "Invalid or inactive branch",
            });
        }

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
                message: "Invalid or inactive department",
            });
        }

        const [existingUser] = await db.query(
            `SELECT id, employee_code, phone, email, aadhaar_number
       FROM users
       WHERE employee_code = ?
          OR phone = ?
          OR (? IS NOT NULL AND email = ?)
          OR aadhaar_number = ?
       LIMIT 1`,
            [
                employeeCode,
                phone,
                email || null,
                email || null,
                aadhaarNumber,
            ]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Employee code, phone, email or Aadhaar already exists",
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            `INSERT INTO users (
        employee_code,
        full_name,
        phone,
        email,
        password_hash,
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
        ?, ?, ?, ?, ?,
        'ADMIN',
        'ACTIVE',
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
            [
                employeeCode,
                fullName,
                phone,
                email || null,
                passwordHash,
                branchId,
                departmentId,
                designation,
                address || null,
                pincode || null,
                qualification || null,
                Boolean(computerSkill),
                aadhaarNumber,
                panNumber || null,
                dutyStartTime,
                dutyEndTime,
                joiningDate,
                req.user.id,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Admin created successfully",
            adminId: result.insertId,
        });
    } catch (error) {
        console.error("Create admin error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const getAdmins = async (req, res) => {
    try {
        const [admins] = await db.query(
            `SELECT
        u.id,
        u.employee_code AS employeeCode,
        u.full_name AS fullName,
        u.phone,
        u.email,
        u.designation,
        u.account_status AS accountStatus,
        u.duty_start_time AS dutyStartTime,
        u.duty_end_time AS dutyEndTime,
        u.joining_date AS joiningDate,
        u.leaving_date AS leavingDate,
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
        console.error("Get admins error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const updateAdminStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be ACTIVE or INACTIVE",
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

        await db.query(
            `UPDATE users
       SET
         account_status = ?,
         leaving_date =
           CASE
             WHEN ? = 'INACTIVE'
             THEN COALESCE(leaving_date, CURDATE())
             ELSE NULL
           END
       WHERE id = ?
       AND role = 'ADMIN'`,
            [status, status, id]
        );

        return res.status(200).json({
            success: true,
            message: `Admin marked as ${status}`,
        });
    } catch (error) {
        console.error("Update admin status error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = {
    createAdmin,
    getAdmins,
    updateAdminStatus,
};
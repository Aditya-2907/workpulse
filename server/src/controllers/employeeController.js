const db = require("../config/db");
const generateEmployeeCode = require("../utils/generateEmployeeCode");
const { writeAuditLog } = require("../services/auditService");


// ======================================================
// CREATE EMPLOYEE
// ADMIN     -> only own branch
// SUPER_ADMIN -> selected branch
// Employee Code -> automatically generated
// ======================================================

const createEmployee = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

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

        if (
            !fullName ||
            !phone ||
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
                message:
                    "Required employee fields are missing",
            });
        }

        // --------------------------------------------------
        // Determine Branch
        // ADMIN cannot choose another branch.
        // SUPER_ADMIN can choose branch.
        // --------------------------------------------------

        let finalBranchId;

        if (req.user.role === "ADMIN") {
            finalBranchId = req.user.branchId;

            if (!finalBranchId) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "Admin has no assigned branch",
                });
            }
        } else {
            if (!branchId) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "Branch is required",
                });
            }

            finalBranchId = branchId;
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
            [finalBranchId]
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
        // employee_code is NOT checked because it is
        // generated automatically by WorkPulse.
        // --------------------------------------------------

        const [existingUser] = await connection.query(
            `SELECT id
             FROM users
             WHERE phone = ?
                OR (
                    ? IS NOT NULL
                    AND email = ?
                )
                OR aadhaar_number = ?
             LIMIT 1`,
            [
                String(phone).trim(),
                email?.trim() || null,
                email?.trim() || null,
                String(aadhaarNumber).trim(),
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
        // Generate Employee Code
        // EMP001 -> EMP002 -> EMP003...
        // --------------------------------------------------

        const employeeCode =
            await generateEmployeeCode(
                connection,
                "EMPLOYEE"
            );

        // --------------------------------------------------
        // Create Employee
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
                ?, ?, ?, ?, ?, ?, NULL,
                'EMPLOYEE',
                'ACTIVE',
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
                employeeCode,
                fullName.trim(),
                dateOfBirth || null,
                gender || null,
                String(phone).trim(),
                email?.trim() || null,
                finalBranchId,
                departmentId,
                designation.trim(),
                address?.trim() || null,
                pincode?.trim() || null,
                qualification?.trim() || null,
                Boolean(computerSkill),
                String(aadhaarNumber).trim(),
                panNumber?.trim() || null,
                dutyStartTime,
                dutyEndTime,
                joiningDate,
                req.user.id,
            ]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message:
                "Employee created successfully",
            employeeId:
                result.insertId,
            employeeCode,
        });
    } catch (error) {
        await connection.rollback();

        console.error(
            "Create employee error:",
            error
        );

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "A duplicate employee record already exists",
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    } finally {
        connection.release();
    }
};


// ======================================================
// GET EMPLOYEES
// ADMIN -> own branch only
// SUPER_ADMIN -> all branches
// ======================================================

const getEmployees = async (req, res) => {
    try {
        let query = `
            SELECT
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

            WHERE u.role = 'EMPLOYEE'
        `;

        const params = [];

        if (req.user.role === "ADMIN") {
            query += `
                AND u.branch_id = ?
            `;

            params.push(
                req.user.branchId
            );
        }

        query += `
            ORDER BY u.id DESC
        `;

        const [employees] =
            await db.query(
                query,
                params
            );

        return res.status(200).json({
            success: true,
            employees,
        });
    } catch (error) {
        console.error(
            "Get employees error:",
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
// GET EMPLOYEE BY ID
// ADMIN -> own branch only
// ======================================================

const getEmployeeById = async (
    req,
    res
) => {
    try {
        const { id } = req.params;

        let query = `
            SELECT
                u.id,
                u.employee_code AS employeeCode,
                u.full_name AS fullName,
                DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
                u.gender AS gender,
                u.phone,
                u.email,
                u.designation,
                u.address,
                u.pincode,
                u.qualification,
                u.computer_skill AS computerSkill,

                CONCAT(
                    'XXXX XXXX ',
                    RIGHT(
                        u.aadhaar_number,
                        4
                    )
                ) AS aadhaarNumber,

                u.pan_number AS panNumber,

                u.duty_start_time AS dutyStartTime,
                u.duty_end_time AS dutyEndTime,

                DATE_FORMAT(u.joining_date, '%Y-%m-%d') AS joiningDate,
                DATE_FORMAT(u.leaving_date, '%Y-%m-%d') AS leavingDate,

                u.account_status AS accountStatus,

                b.id AS branchId,
                b.branch_name AS branchName,

                d.id AS departmentId,
                d.department_name AS departmentName

            FROM users u

            LEFT JOIN branches b
                ON b.id = u.branch_id

            LEFT JOIN departments d
                ON d.id = u.department_id

            WHERE u.id = ?
              AND u.role = 'EMPLOYEE'
        `;

        const params = [id];

        if (req.user.role === "ADMIN") {
            query += `
                AND u.branch_id = ?
            `;

            params.push(
                req.user.branchId
            );
        }

        query += `
            LIMIT 1
        `;

        const [employees] =
            await db.query(
                query,
                params
            );

        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Employee not found or access denied",
            });
        }

        return res.status(200).json({
            success: true,
            employee:
                employees[0],
        });
    } catch (error) {
        console.error(
            "Get employee error:",
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
// UPDATE EMPLOYEE
// Employee Code is intentionally NOT accepted/updated.
// ======================================================

const updateEmployee = async (
    req,
    res
) => {
    try {
        const { id } = req.params;

        const {
            fullName,
            dateOfBirth,
            gender,
            phone,
            email,
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

        // --------------------------------------------------
        // Find Employee
        // --------------------------------------------------

        let employeeQuery = `
            SELECT
                id,
                employee_code,
                branch_id,
                aadhaar_number,
                pan_number

            FROM users

            WHERE id = ?
              AND role = 'EMPLOYEE'
        `;

        const employeeParams = [id];

        if (req.user.role === "ADMIN") {
            employeeQuery += `
                AND branch_id = ?
            `;

            employeeParams.push(
                req.user.branchId
            );
        }

        employeeQuery += `
            LIMIT 1
        `;

        const [employees] =
            await db.query(
                employeeQuery,
                employeeParams
            );

        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Employee not found or access denied",
            });
        }

        if (
            !fullName ||
            !phone ||
            !departmentId ||
            !designation ||
            !dutyStartTime ||
            !dutyEndTime ||
            !joiningDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Required employee fields are missing",
            });
        }

        // --------------------------------------------------
        // Validate Department
        // --------------------------------------------------

        const [department] =
            await db.query(
                `SELECT id
                 FROM departments
                 WHERE id = ?
                   AND status = 'ACTIVE'
                 LIMIT 1`,
                [departmentId]
            );

        if (
            department.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid or inactive department",
            });
        }

        // --------------------------------------------------
        // Preserve Aadhaar/PAN if edit form sends blank.
        // This also prevents masked Aadhaar being stored.
        // --------------------------------------------------

        const finalAadhaar =
            aadhaarNumber &&
                !String(
                    aadhaarNumber
                ).includes("X") &&
                String(
                    aadhaarNumber
                ).trim()
                ? String(
                    aadhaarNumber
                ).trim()
                : employees[0]
                    .aadhaar_number;

        const finalPan =
            panNumber !== undefined &&
                panNumber !== null &&
                String(panNumber).trim()
                ? String(
                    panNumber
                ).trim()
                : employees[0]
                    .pan_number;

        if (!finalAadhaar) {
            return res.status(400).json({
                success: false,
                message:
                    "Aadhaar number is required",
            });
        }

        // --------------------------------------------------
        // Duplicate Check
        // Employee Code is intentionally NOT included.
        // --------------------------------------------------

        const [duplicate] =
            await db.query(
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
                    String(
                        phone
                    ).trim(),
                    email?.trim() ||
                    null,
                    email?.trim() ||
                    null,
                    finalAadhaar,
                    finalAadhaar,
                ]
            );

        if (
            duplicate.length > 0
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Phone, email or Aadhaar already exists",
            });
        }

        // --------------------------------------------------
        // Update Employee
        // employee_code is NOT updated.
        // branch_id is NOT changed here.
        // --------------------------------------------------

        await db.query(
            `UPDATE users
             SET
                full_name = ?,
                date_of_birth = ?,
                gender = ?,
                phone = ?,
                email = ?,
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
               AND role = 'EMPLOYEE'`,
            [
                fullName.trim(),
                dateOfBirth || null,
                gender || null,
                String(
                    phone
                ).trim(),
                email?.trim() ||
                null,
                departmentId,
                designation.trim(),
                address?.trim() ||
                null,
                pincode?.trim() ||
                null,
                qualification?.trim() ||
                null,
                Boolean(
                    computerSkill
                ),
                finalAadhaar,
                finalPan || null,
                dutyStartTime,
                dutyEndTime,
                joiningDate,
                id,
            ]
        );

        await writeAuditLog(db, { actorId: req.user.id, action: "EMPLOYEE_UPDATED", entityType: "USER", entityId: id, newData: { departmentId, designation: designation.trim() }, req });
        return res.status(200).json({
            success: true,
            message:
                "Employee updated successfully",
        });
    } catch (error) {
        console.error(
            "Update employee error:",
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
// UPDATE EMPLOYEE STATUS
// ======================================================

const updateEmployeeStatus = async (
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

        let query = `
            SELECT id
            FROM users
            WHERE id = ?
              AND role = 'EMPLOYEE'
        `;

        const params = [id];

        if (req.user.role === "ADMIN") {
            query += `
                AND branch_id = ?
            `;

            params.push(
                req.user.branchId
            );
        }

        query += `
            LIMIT 1
        `;

        const [employees] =
            await db.query(
                query,
                params
            );

        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Employee not found or access denied",
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
               AND role = 'EMPLOYEE'`,
            [
                status,
                status,
                id,
            ]
        );

        await writeAuditLog(db, { actorId: req.user.id, action: "EMPLOYEE_STATUS_CHANGED", entityType: "USER", entityId: id, newData: { accountStatus: status }, req });
        return res.status(200).json({
            success: true,
            message:
                `Employee marked as ${status}`,
        });
    } catch (error) {
        console.error(
            "Update employee status error:",
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
// SUPER ADMIN: TRANSFER EMPLOYEE BRANCH
// ======================================================

const transferEmployeeBranch = async (
    req,
    res
) => {
    let connection;

    try {
        const { id } = req.params;
        const { branchId } = req.body;

        if (
            !Number.isInteger(Number(branchId)) ||
            Number(branchId) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "New branch is required",
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [employees] =
            await connection.query(
                `SELECT
                    u.id,
                    u.employee_code AS employeeCode,
                    u.full_name AS fullName,
                    u.branch_id AS branchId,
                    previous_branch.branch_code AS previousBranchCode,
                    previous_branch.branch_name AS previousBranchName
                 FROM users u
                 LEFT JOIN branches previous_branch
                    ON previous_branch.id = u.branch_id
                 WHERE u.id = ?
                   AND u.role = 'EMPLOYEE'
                 LIMIT 1 FOR UPDATE`,
                [id]
            );

        if (
            employees.length === 0
        ) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Employee not found",
            });
        }

        const [branches] =
            await connection.query(
                `SELECT
                    id,
                    branch_code AS branchCode,
                    branch_name AS branchName
                 FROM branches
                 WHERE id = ?
                   AND status = 'ACTIVE'
                 LIMIT 1`,
                [branchId]
            );

        if (
            branches.length === 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Invalid or inactive branch",
            });
        }

        if (
            Number(
                employees[0].branchId
            ) ===
            Number(branchId)
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Employee is already assigned to this branch",
            });
        }

        const employee = employees[0];
        const destinationBranch = branches[0];

        await connection.query(
            `UPDATE users
             SET branch_id = ?
             WHERE id = ?
               AND role = 'EMPLOYEE'`,
            [
                branchId,
                id,
            ]
        );

        await connection.query(
            `INSERT INTO audit_logs (
                performed_by,
                action,
                entity_type,
                entity_id,
                old_data,
                new_data,
                ip_address,
                user_agent
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                "EMPLOYEE_BRANCH_TRANSFER",
                "EMPLOYEE",
                employee.id,
                JSON.stringify({
                    employeeCode: employee.employeeCode,
                    fullName: employee.fullName,
                    branchId: employee.branchId,
                    branchCode: employee.previousBranchCode,
                    branchName: employee.previousBranchName,
                }),
                JSON.stringify({
                    employeeCode: employee.employeeCode,
                    fullName: employee.fullName,
                    branchId: destinationBranch.id,
                    branchCode: destinationBranch.branchCode,
                    branchName: destinationBranch.branchName,
                }),
                req.ip || null,
                req.get("user-agent") || null,
            ]
        );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "EMPLOYEE_CREATED",
            entityType: "USER",
            entityId: result.insertId,
            newData: { employeeCode, branchId: finalBranchId, departmentId, designation: designation.trim() },
            req,
        });

        await connection.commit();

        return res.status(200).json({
            success: true,
            message:
                "Employee transferred successfully",
            transfer: {
                employeeId: employee.id,
                previousBranch: {
                    id: employee.branchId,
                    code: employee.previousBranchCode,
                    name: employee.previousBranchName,
                },
                newBranch: {
                    id: destinationBranch.id,
                    code: destinationBranch.branchCode,
                    name: destinationBranch.branchName,
                },
            },
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(
            "Employee branch transfer error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};


module.exports = {
    createEmployee,
    getEmployees,
    getEmployeeById,
    updateEmployee,
    updateEmployeeStatus,
    transferEmployeeBranch,
};

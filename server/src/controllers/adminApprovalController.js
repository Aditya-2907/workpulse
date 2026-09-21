const bcrypt = require("bcryptjs");
const db = require("../config/db");
const generateEmployeeCode = require("../utils/generateEmployeeCode");
const { writeAuditLog } = require("../services/auditService");


// ======================================================
// ADMIN: REQUEST ACCESS FOR AN ADMIN CANDIDATE.
// This intake accepts only candidate-owned information. Organization access is
// assigned by a Super Admin during approval; no permanent password is accepted.
// ======================================================

const requestAdminCreation = async (
    req,
    res
) => {
    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            fullName,
            phone,
            email,
            dateOfBirth,
            gender,
            address,
            pincode,
            aadhaarNumber,
            panNumber,
        } = req.body;

        if (
            !fullName ||
            !phone ||
            !aadhaarNumber
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Required admin fields are missing",
            });
        }

        if (
            dateOfBirth &&
            !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
        ) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Date of birth must use YYYY-MM-DD format" });
        }

        if (
            gender &&
            !["FEMALE", "MALE", "NON_BINARY", "PREFER_NOT_TO_SAY"].includes(gender)
        ) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Invalid gender value" });
        }

        // --------------------------------------------------
        // Find logged-in requesting Admin
        // --------------------------------------------------

        const [requesters] =
            await connection.query(
                `SELECT
                    id,
                    account_status

                 FROM users

                 WHERE id = ?
                   AND role = 'ADMIN'

                 LIMIT 1`,
                [req.user.id]
            );

        if (
            requesters.length === 0 ||
            requesters[0].account_status !==
            "ACTIVE"
        ) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message:
                    "Active Admin account required",
            });
        }

        // --------------------------------------------------
        // Duplicate Check
        // No employeeCode check because WorkPulse
        // generates ADMxxx automatically.
        // --------------------------------------------------

        const [duplicates] =
            await connection.query(
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
                    phone,
                    email?.trim() || null,
                    email?.trim() || null,
                    aadhaarNumber,
                ]
            );

        if (
            duplicates.length > 0
        ) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "Phone, email or Aadhaar already exists",
            });
        }

        // --------------------------------------------------
        // Automatically generate ADM001 / ADM002...
        // --------------------------------------------------

        const employeeCode =
            await generateEmployeeCode(
                connection,
                "ADMIN"
            );

        // --------------------------------------------------
        // Create a passwordless pending Admin. The Super Admin supplies a
        // temporary password only when approving the request.
        // --------------------------------------------------

        const [userResult] =
            await connection.query(
                `INSERT INTO users (
                    employee_code,
                    full_name,
                    phone,
                    email,
                    date_of_birth,
                    gender,
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
                    ?, ?, ?, ?, ?, ?, NULL, TRUE,
                    'ADMIN',
                    'PENDING_APPROVAL',
                    NULL, NULL, NULL, ?, ?, NULL, FALSE, ?, ?, NULL, NULL, NULL, ?
                )`,
                [
                    employeeCode,
                    fullName.trim(),
                    phone.trim(),
                    email?.trim() ||
                    null,
                    dateOfBirth || null,
                    gender || null,
                    address?.trim() ||
                    null,
                    pincode?.trim() ||
                    null,
                    aadhaarNumber.trim(),
                    panNumber?.trim() ||
                    null,
                    req.user.id,
                ]
            );

        // --------------------------------------------------
        // Create approval request
        // --------------------------------------------------

        const [requestResult] =
            await connection.query(
                `INSERT INTO admin_approval_requests (
                    admin_user_id,
                    requested_by,
                    status
                )
                VALUES (
                    ?,
                    ?,
                    'PENDING'
                )`,
                [
                    userResult.insertId,
                    req.user.id,
                ]
            );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "ADMIN_REQUEST_CREATED",
            entityType: "ADMIN_APPROVAL_REQUEST",
            entityId: requestResult.insertId,
            newData: { candidateUserId: userResult.insertId, employeeCode, status: "PENDING" },
            req,
        });

        await connection.commit();

        return res.status(201).json({
            success: true,

            message:
                "Admin approval request submitted successfully",

            requestId:
                requestResult.insertId,

            employeeCode,
        });
    } catch (error) {
        await connection.rollback();

        console.error(
            "Admin approval request error:",
            error
        );

        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "A duplicate admin record already exists",
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
// SUPER ADMIN: GET APPROVAL REQUESTS
// ======================================================

const getAdminApprovalRequests =
    async (req, res) => {
        try {
            const [requests] =
                await db.query(
                    `SELECT
                        ar.id,
                        ar.status,
                        ar.review_note
                            AS reviewNote,
                        ar.requested_at
                            AS requestedAt,
                        ar.reviewed_at
                            AS reviewedAt,

                        u.id
                            AS adminUserId,
                        u.employee_code
                            AS employeeCode,
                        u.full_name
                            AS fullName,
                        u.phone,
                        u.email,
                        u.designation,
                        u.account_status
                            AS accountStatus,
                        u.duty_start_time
                            AS dutyStartTime,
                        u.duty_end_time
                            AS dutyEndTime,
                        u.joining_date
                            AS joiningDate,

                        b.id
                            AS branchId,
                        b.branch_name
                            AS branchName,

                        d.id
                            AS departmentId,
                        d.department_name
                            AS departmentName,

                        requester.id
                            AS requestedById,
                        requester.full_name
                            AS requestedByName,

                        reviewer.id
                            AS reviewedById,
                        reviewer.full_name
                            AS reviewedByName

                    FROM admin_approval_requests ar

                    INNER JOIN users u
                        ON u.id =
                           ar.admin_user_id

                    LEFT JOIN branches b
                        ON b.id =
                           u.branch_id

                    LEFT JOIN departments d
                        ON d.id =
                           u.department_id

                    INNER JOIN users requester
                        ON requester.id =
                           ar.requested_by

                    LEFT JOIN users reviewer
                        ON reviewer.id =
                           ar.reviewed_by

                    ORDER BY
                        CASE
                            WHEN ar.status =
                                 'PENDING'
                            THEN 0
                            ELSE 1
                        END,

                        ar.requested_at DESC`
                );

            return res
                .status(200)
                .json({
                    success: true,
                    requests,
                });
        } catch (error) {
            console.error(
                "Get admin approval requests error:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Internal server error",
                });
        }
    };


// ======================================================
// SUPER ADMIN: APPROVE / REJECT REQUEST
// ======================================================

const reviewAdminApprovalRequest =
    async (req, res) => {
        const connection =
            await db.getConnection();

        try {
            await connection.beginTransaction();

            const { id } =
                req.params;

            const {
                action,
                reviewNote,
                temporaryPassword,
                branchId,
                departmentId,
                designation,
                joiningDate,
            } = req.body;

            if (
                ![
                    "APPROVE",
                    "REJECT",
                ].includes(action)
            ) {
                await connection.rollback();

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Action must be APPROVE or REJECT",
                    });
            }

            if (
                action === "APPROVE" &&
                (typeof temporaryPassword !== "string" || temporaryPassword.length < 8)
            ) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "A temporary password of at least 8 characters is required to approve this request",
                });
            }

            if (
                action === "APPROVE" &&
                (!branchId || !departmentId || !designation?.trim() || !joiningDate)
            ) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Branch, department, designation and joining date are required to approve this request",
                });
            }

            if (action === "APPROVE") {
                const [[branch]] = await connection.query(
                    "SELECT id FROM branches WHERE id = ? AND status = 'ACTIVE' LIMIT 1",
                    [branchId]
                );
                const [[department]] = await connection.query(
                    "SELECT id FROM departments WHERE id = ? AND status = 'ACTIVE' LIMIT 1",
                    [departmentId]
                );
                if (!branch || !department) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: "Choose active branch and department assignments" });
                }
            }

            // --------------------------------------------------
            // Lock request row to prevent double approval
            // --------------------------------------------------

            const [requests] =
                await connection.query(
                    `SELECT
                        id,
                        admin_user_id,
                        status

                     FROM admin_approval_requests

                     WHERE id = ?

                     FOR UPDATE`,
                    [id]
                );

            if (
                requests.length === 0
            ) {
                await connection.rollback();

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Approval request not found",
                    });
            }

            const request =
                requests[0];

            if (
                request.status !==
                "PENDING"
            ) {
                await connection.rollback();

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "This request has already been reviewed",
                    });
            }

            // --------------------------------------------------
            // Verify pending Admin still exists
            // --------------------------------------------------

            const [admins] =
                await connection.query(
                    `SELECT
                        id,
                        account_status

                     FROM users

                     WHERE id = ?
                       AND role = 'ADMIN'

                     FOR UPDATE`,
                    [
                        request.admin_user_id,
                    ]
                );

            if (
                admins.length === 0
            ) {
                await connection.rollback();

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Requested Admin account not found",
                    });
            }

            if (
                admins[0]
                    .account_status !==
                "PENDING_APPROVAL"
            ) {
                await connection.rollback();

                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            "Requested Admin is no longer pending approval",
                    });
            }

            const requestStatus =
                action === "APPROVE"
                    ? "APPROVED"
                    : "REJECTED";

            const userStatus =
                action === "APPROVE"
                    ? "ACTIVE"
                    : "REJECTED";

            const temporaryPasswordHash =
                action === "APPROVE"
                    ? await bcrypt.hash(temporaryPassword, 10)
                    : null;

            // --------------------------------------------------
            // Update Approval Request
            // --------------------------------------------------

            await connection.query(
                `UPDATE admin_approval_requests

                 SET
                    status = ?,
                    reviewed_by = ?,
                    review_note = ?,
                    reviewed_at = NOW()

                 WHERE id = ?`,
                [
                    requestStatus,
                    req.user.id,
                    reviewNote?.trim() ||
                    null,
                    id,
                ]
            );

            // --------------------------------------------------
            // Update Admin Account
            // --------------------------------------------------

            await connection.query(
                `UPDATE users

                 SET
                    account_status = ?,

                    password_hash = CASE
                        WHEN ? = 'APPROVE' THEN ?
                        ELSE password_hash
                    END,

                    must_change_password = CASE
                        WHEN ? = 'APPROVE' THEN TRUE
                        ELSE must_change_password
                    END,

                    branch_id = CASE
                        WHEN ? = 'APPROVE' THEN ?
                        ELSE branch_id
                    END,

                    department_id = CASE
                        WHEN ? = 'APPROVE' THEN ?
                        ELSE department_id
                    END,

                    designation = CASE
                        WHEN ? = 'APPROVE' THEN ?
                        ELSE designation
                    END,

                    joining_date = CASE
                        WHEN ? = 'APPROVE' THEN ?
                        ELSE joining_date
                    END,

                    leaving_date =
                        CASE
                            WHEN ? =
                                 'REJECTED'
                            THEN CURDATE()
                            ELSE NULL
                        END

                 WHERE id = ?
                   AND role = 'ADMIN'`,
                [
                    userStatus,
                    action,
                    temporaryPasswordHash,
                    action,
                    action,
                    branchId || null,
                    action,
                    departmentId || null,
                    action,
                    designation?.trim() || null,
                    action,
                    joiningDate || null,
                    userStatus,
                    request.admin_user_id,
                ]
            );

            await writeAuditLog(connection, {
                actorId: req.user.id,
                action: action === "APPROVE" ? "ADMIN_REQUEST_APPROVED" : "ADMIN_REQUEST_REJECTED",
                entityType: "ADMIN_APPROVAL_REQUEST",
                entityId: id,
                oldData: { status: "PENDING" },
                newData: action === "APPROVE"
                    ? { status: requestStatus, candidateUserId: request.admin_user_id, branchId, departmentId, mustChangePassword: true }
                    : { status: requestStatus, candidateUserId: request.admin_user_id },
                req,
            });

            await connection.commit();

            return res
                .status(200)
                .json({
                    success: true,

                    message:
                        action ===
                            "APPROVE"
                            ? "Admin request approved successfully"
                            : "Admin request rejected successfully",
                });
        } catch (error) {
            await connection.rollback();

            console.error(
                "Review admin approval error:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Internal server error",
                });
        } finally {
            connection.release();
        }
    };


module.exports = {
    requestAdminCreation,
    getAdminApprovalRequests,
    reviewAdminApprovalRequest,
};

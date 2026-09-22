const db = require("../config/db");
const { writeAuditLog } = require("../services/auditService");

// ======================================================
// HELPER: Validate YYYY-MM-DD
// ======================================================
const isValidDate = (date) => {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
};

// ======================================================
// CREATE / APPROVE LEAVE
// ADMIN       -> own branch EMPLOYEE or self
// SUPER_ADMIN -> any EMPLOYEE / ADMIN
// ======================================================
const createLeave = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { userId, fromDate, toDate, reason } = req.body;

        // ------------------------------------------------------
        // Basic validation
        // ------------------------------------------------------
        if (!userId || !fromDate || !toDate || !reason?.trim()) {
            return res.status(400).json({
                success: false,
                message:
                    "Employee, from date, to date and reason are required",
            });
        }

        if (!isValidDate(fromDate) || !isValidDate(toDate)) {
            return res.status(400).json({
                success: false,
                message: "Dates must be in YYYY-MM-DD format",
            });
        }

        if (fromDate > toDate) {
            return res.status(400).json({
                success: false,
                message: "From date cannot be after to date",
            });
        }

        await connection.beginTransaction();

        // ------------------------------------------------------
        // Find target user
        // ------------------------------------------------------
        const [targetUsers] = await connection.query(
            `
            SELECT
                id,
                employee_code,
                full_name,
                role,
                account_status,
                branch_id
            FROM users
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [userId]
        );

        if (targetUsers.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Employee or Admin not found",
            });
        }

        const targetUser = targetUsers[0];

        // ------------------------------------------------------
        // Super Admin never gives attendance / leave
        // ------------------------------------------------------
        if (targetUser.role === "SUPER_ADMIN") {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Super Admin does not require attendance or leave",
            });
        }

        if (targetUser.account_status !== "ACTIVE") {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Leave can only be marked for an active user",
            });
        }

        // ------------------------------------------------------
        // ADMIN branch isolation
        // ------------------------------------------------------
        if (req.user.role === "ADMIN") {
            // Admin cannot touch another branch
            if (
                Number(targetUser.branch_id) !==
                Number(req.user.branchId)
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        "You cannot manage leave for another branch",
                });
            }

            // Admin can manage EMPLOYEE leave
            // OR own personal leave
            const isOwnLeave =
                Number(targetUser.id) === Number(req.user.id);

            if (
                targetUser.role === "ADMIN" &&
                !isOwnLeave
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        "Admin cannot manage another Admin's leave",
                });
            }
        }

        // ------------------------------------------------------
        // Check overlapping approved leave
        // ------------------------------------------------------
        const [overlappingLeaves] = await connection.query(
            `
            SELECT
                id,
                from_date,
                to_date
            FROM leaves
            WHERE user_id = ?
              AND status = 'APPROVED'
              AND from_date <= ?
              AND to_date >= ?
            LIMIT 1
            `,
            [userId, toDate, fromDate]
        );

        if (overlappingLeaves.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "An approved leave already exists within this date range",
            });
        }

        // ------------------------------------------------------
        // Do not allow leave where attendance activity exists
        //
        // PENDING with check-in counts as real attendance activity.
        // FULL_DAY / PARTIAL / INSUFFICIENT etc. also block leave.
        // ------------------------------------------------------
        const [attendanceRows] = await connection.query(
            `
            SELECT
                attendance_date,
                attendance_status,
                check_in_time,
                check_out_time
            FROM attendance_records
            WHERE user_id = ?
              AND attendance_date BETWEEN ? AND ?
              AND (
                    check_in_time IS NOT NULL
                    OR check_out_time IS NOT NULL
                    OR attendance_status IN (
                        'FULL_DAY',
                        'PARTIAL_DAY',
                        'INSUFFICIENT_ATTENDANCE',
                        'INCOMPLETE'
                    )
              )
            LIMIT 1
            `,
            [userId, fromDate, toDate]
        );

        if (attendanceRows.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "Leave cannot be marked because attendance already exists within this date range",
            });
        }

        // ------------------------------------------------------
        // Insert leave
        // ------------------------------------------------------
        const [result] = await connection.query(
            `
            INSERT INTO leaves (
                user_id,
                from_date,
                to_date,
                reason,
                approved_by,
                status
            )
            VALUES (?, ?, ?, ?, ?, 'APPROVED')
            `,
            [
                userId,
                fromDate,
                toDate,
                reason.trim(),
                req.user.id,
            ]
        );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "LEAVE_APPROVED",
            entityType: "LEAVE",
            entityId: result.insertId,
            newData: {
                userId: Number(userId),
                branchId: targetUser.branch_id,
                fromDate,
                toDate,
                status: "APPROVED",
            },
            req,
        });

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Leave approved successfully",
            leave: {
                id: result.insertId,
                userId: Number(userId),
                fromDate,
                toDate,
                reason: reason.trim(),
                status: "APPROVED",
            },
        });
    } catch (error) {
        await connection.rollback();

        console.error("CREATE LEAVE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to approve leave",
        });
    } finally {
        connection.release();
    }
};

// ======================================================
// GET LEAVES
// ADMIN       -> own branch only
// SUPER_ADMIN -> all branches
// ======================================================
const getLeaves = async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            employeeId,
            status,
            branchId,
        } = req.query;

        const conditions = [];
        const values = [];

        let query = `
            SELECT
                l.id,
                l.user_id AS userId,

                u.employee_code AS employeeCode,
                u.full_name AS fullName,
                u.role AS userRole,
                u.designation,

                u.branch_id AS branchId,
                b.branch_code AS branchCode,
                b.branch_name AS branchName,

                u.department_id AS departmentId,
                d.department_name AS departmentName,

                DATE_FORMAT(
                    l.from_date,
                    '%Y-%m-%d'
                ) AS fromDate,

                DATE_FORMAT(
                    l.to_date,
                    '%Y-%m-%d'
                ) AS toDate,

                l.reason,
                l.status,

                l.approved_by AS approvedBy,
                approver.full_name AS approvedByName,

                l.created_at AS createdAt,
                l.updated_at AS updatedAt

            FROM leaves l

            INNER JOIN users u
                ON u.id = l.user_id

            LEFT JOIN branches b
                ON b.id = u.branch_id

            LEFT JOIN departments d
                ON d.id = u.department_id

            INNER JOIN users approver
                ON approver.id = l.approved_by
        `;

        // ------------------------------------------------------
        // Role / branch isolation
        // ------------------------------------------------------
        if (req.user.role === "ADMIN") {
            conditions.push("u.branch_id = ?");
            values.push(req.user.branchId);

            // Admin must not see another Admin's leave
            conditions.push(`
                (
                    u.role = 'EMPLOYEE'
                    OR u.id = ?
                )
            `);

            values.push(req.user.id);
        }

        if (
            req.user.role === "SUPER_ADMIN" &&
            branchId
        ) {
            conditions.push("u.branch_id = ?");
            values.push(branchId);
        }

        // ------------------------------------------------------
        // Optional filters
        // ------------------------------------------------------
        if (employeeId) {
            conditions.push("u.id = ?");
            values.push(employeeId);
        }

        if (status) {
            if (!["APPROVED", "CANCELLED"].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid leave status",
                });
            }

            conditions.push("l.status = ?");
            values.push(status);
        }

        /*
            Date-overlap filtering:

            Leave:
                10 Sep -> 15 Sep

            Search:
                12 Sep -> 20 Sep

            This must still match.
        */
        if (startDate) {
            if (!isValidDate(startDate)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Start date must be YYYY-MM-DD",
                });
            }

            conditions.push("l.to_date >= ?");
            values.push(startDate);
        }

        if (endDate) {
            if (!isValidDate(endDate)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "End date must be YYYY-MM-DD",
                });
            }

            conditions.push("l.from_date <= ?");
            values.push(endDate);
        }

        if (
            startDate &&
            endDate &&
            startDate > endDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Start date cannot be after end date",
            });
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(" AND ")}`;
        }

        query += `
            ORDER BY
                l.from_date DESC,
                l.id DESC
        `;

        const [rows] = await db.query(query, values);

        return res.status(200).json({
            success: true,
            totalRecords: rows.length,
            leaves: rows,
        });
    } catch (error) {
        console.error("GET LEAVES ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load leaves",
        });
    }
};

// ======================================================
// CANCEL LEAVE
// ======================================================
const cancelLeave = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { id } = req.params;

        await connection.beginTransaction();

        const [leaveRows] = await connection.query(
            `
            SELECT
                l.id,
                l.user_id,
                l.from_date,
                l.to_date,
                l.status,

                u.role AS user_role,
                u.branch_id

            FROM leaves l

            INNER JOIN users u
                ON u.id = l.user_id

            WHERE l.id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [id]
        );

        if (leaveRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Leave record not found",
            });
        }

        const leave = leaveRows[0];

        // ------------------------------------------------------
        // ADMIN isolation
        // ------------------------------------------------------
        if (req.user.role === "ADMIN") {
            if (
                Number(leave.branch_id) !==
                Number(req.user.branchId)
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        "You cannot manage leave for another branch",
                });
            }

            const isOwnLeave =
                Number(leave.user_id) ===
                Number(req.user.id);

            if (
                leave.user_role === "ADMIN" &&
                !isOwnLeave
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        "Admin cannot manage another Admin's leave",
                });
            }
        }

        if (leave.status === "CANCELLED") {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Leave is already cancelled",
            });
        }

        await connection.query(
            `
            UPDATE leaves
            SET status = 'CANCELLED'
            WHERE id = ?
            `,
            [id]
        );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "LEAVE_CANCELLED",
            entityType: "LEAVE",
            entityId: Number(id),
            oldData: {
                userId: leave.user_id,
                branchId: leave.branch_id,
                fromDate: leave.from_date,
                toDate: leave.to_date,
                status: leave.status,
            },
            newData: {
                userId: leave.user_id,
                branchId: leave.branch_id,
                fromDate: leave.from_date,
                toDate: leave.to_date,
                status: "CANCELLED",
            },
            req,
        });

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: "Leave cancelled successfully",
        });
    } catch (error) {
        await connection.rollback();

        console.error("CANCEL LEAVE ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel leave",
        });
    } finally {
        connection.release();
    }
};

module.exports = {
    createLeave,
    getLeaves,
    cancelLeave,
};

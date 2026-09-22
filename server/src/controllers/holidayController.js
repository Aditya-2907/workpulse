const pool = require("../config/db");
const { writeAuditLog } = require("../services/auditService");

// ======================================================
// GET ALL HOLIDAYS
// SUPER ADMIN ONLY
// ======================================================
const getHolidays = async (req, res) => {
    try {
        const {
            startDate,
            endDate,
        } = req.query;

        let sql = `
            SELECT
                h.id,
                DATE_FORMAT(h.holiday_date, '%Y-%m-%d') AS holidayDate,
                h.purpose,
                h.created_by AS createdBy,
                u.full_name AS createdByName,
                h.created_at AS createdAt,
                h.updated_at AS updatedAt
            FROM holidays h
            INNER JOIN users u
                ON u.id = h.created_by
            WHERE 1 = 1
        `;

        const params = [];

        if (startDate) {
            sql += ` AND h.holiday_date >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND h.holiday_date <= ?`;
            params.push(endDate);
        }

        sql += ` ORDER BY h.holiday_date ASC`;

        const [holidays] = await pool.query(
            sql,
            params
        );

        return res.status(200).json({
            success: true,
            totalRecords: holidays.length,
            holidays,
        });
    } catch (error) {
        console.error(
            "GET HOLIDAYS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to load holidays",
        });
    }
};

// ======================================================
// CREATE HOLIDAY
// SUPER ADMIN ONLY
// ======================================================
const createHoliday = async (req, res) => {
    let connection;

    try {
        const {
            holidayDate,
            purpose,
        } = req.body;

        if (
            !holidayDate ||
            !purpose ||
            !String(purpose).trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Holiday date and purpose are required",
            });
        }

        const dateRegex =
            /^\d{4}-\d{2}-\d{2}$/;

        if (!dateRegex.test(holidayDate)) {
            return res.status(400).json({
                success: false,
                message:
                    "Holiday date must be in YYYY-MM-DD format",
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existing] = await connection.query(
            `
            SELECT id
            FROM holidays
            WHERE holiday_date = ?
            LIMIT 1
            `,
            [holidayDate]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message:
                    "A holiday already exists for this date",
            });
        }

        const [result] = await connection.query(
            `
            INSERT INTO holidays (
                holiday_date,
                purpose,
                created_by
            )
            VALUES (?, ?, ?)
            `,
            [
                holidayDate,
                String(purpose).trim(),
                req.user.id,
            ]
        );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "HOLIDAY_CREATED",
            entityType: "HOLIDAY",
            entityId: result.insertId,
            newData: { holidayDate, purpose: String(purpose).trim() },
            req,
        });

        const [rows] = await connection.query(
            `
            SELECT
                h.id,
                DATE_FORMAT(h.holiday_date, '%Y-%m-%d') AS holidayDate,
                h.purpose,
                h.created_by AS createdBy,
                u.full_name AS createdByName,
                h.created_at AS createdAt,
                h.updated_at AS updatedAt
            FROM holidays h
            INNER JOIN users u
                ON u.id = h.created_by
            WHERE h.id = ?
            LIMIT 1
            `,
            [result.insertId]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message:
                "Holiday created successfully",
            holiday: rows[0],
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(
            "CREATE HOLIDAY ERROR:",
            error
        );

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "A holiday already exists for this date",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create holiday",
        });
    } finally {
        if (connection) connection.release();
    }
};

// ======================================================
// UPDATE HOLIDAY
// SUPER ADMIN ONLY
// ======================================================
const updateHoliday = async (req, res) => {
    let connection;

    try {
        const holidayId =
            Number(req.params.id);

        const {
            holidayDate,
            purpose,
        } = req.body;

        if (
            !holidayId ||
            !holidayDate ||
            !purpose ||
            !String(purpose).trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Holiday ID, date and purpose are required",
            });
        }

        const dateRegex =
            /^\d{4}-\d{2}-\d{2}$/;

        if (!dateRegex.test(holidayDate)) {
            return res.status(400).json({
                success: false,
                message:
                    "Holiday date must be in YYYY-MM-DD format",
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [holidayRows] =
            await connection.query(
                `
                SELECT id,
                    DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holidayDate,
                    purpose
                FROM holidays
                WHERE id = ?
                LIMIT 1 FOR UPDATE
                `,
                [holidayId]
            );

        if (holidayRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Holiday not found",
            });
        }

        const [duplicateRows] =
            await connection.query(
                `
                SELECT id
                FROM holidays
                WHERE holiday_date = ?
                  AND id <> ?
                LIMIT 1
                `,
                [
                    holidayDate,
                    holidayId,
                ]
            );

        if (duplicateRows.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message:
                    "Another holiday already exists for this date",
            });
        }

        await connection.query(
            `
            UPDATE holidays
            SET
                holiday_date = ?,
                purpose = ?
            WHERE id = ?
            `,
            [
                holidayDate,
                String(purpose).trim(),
                holidayId,
            ]
        );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "HOLIDAY_UPDATED",
            entityType: "HOLIDAY",
            entityId: holidayId,
            oldData: holidayRows[0],
            newData: {
                ...holidayRows[0],
                holidayDate,
                purpose: String(purpose).trim(),
            },
            req,
        });

        const [rows] = await connection.query(
            `
            SELECT
                h.id,
                DATE_FORMAT(h.holiday_date, '%Y-%m-%d') AS holidayDate,
                h.purpose,
                h.created_by AS createdBy,
                u.full_name AS createdByName,
                h.created_at AS createdAt,
                h.updated_at AS updatedAt
            FROM holidays h
            INNER JOIN users u
                ON u.id = h.created_by
            WHERE h.id = ?
            LIMIT 1
            `,
            [holidayId]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message:
                "Holiday updated successfully",
            holiday: rows[0],
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(
            "UPDATE HOLIDAY ERROR:",
            error
        );

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message:
                    "Another holiday already exists for this date",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update holiday",
        });
    } finally {
        if (connection) connection.release();
    }
};

// ======================================================
// DELETE HOLIDAY
// SUPER ADMIN ONLY
// ======================================================
const deleteHoliday = async (req, res) => {
    let connection;

    try {
        const holidayId =
            Number(req.params.id);

        if (!holidayId) {
            return res.status(400).json({
                success: false,
                message:
                    "Valid holiday ID is required",
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `
            SELECT id,
                DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holidayDate,
                purpose
            FROM holidays
            WHERE id = ?
            LIMIT 1 FOR UPDATE
            `,
            [holidayId]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: "Holiday not found",
            });
        }

        await connection.query(
            `
            DELETE FROM holidays
            WHERE id = ?
            `,
            [holidayId]
        );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "HOLIDAY_DELETED",
            entityType: "HOLIDAY",
            entityId: holidayId,
            oldData: rows[0],
            req,
        });

        await connection.commit();

        return res.status(200).json({
            success: true,
            message:
                "Holiday deleted successfully",
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(
            "DELETE HOLIDAY ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to delete holiday",
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    getHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
};

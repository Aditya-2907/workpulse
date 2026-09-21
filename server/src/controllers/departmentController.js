const db = require("../config/db");

const DEPARTMENT_CODE_LOCK =
    "workpulse_department_code_generation";

const getNextDepartmentCode = async (connection) => {
    const [rows] = await connection.query(
        `SELECT
            COALESCE(
                MAX(CAST(SUBSTRING(department_code, 3) AS UNSIGNED)),
                0
            ) + 1 AS nextSequence
         FROM departments
         WHERE department_code REGEXP '^DP[0-9]+$'`
    );

    return `DP${String(Number(rows[0].nextSequence)).padStart(3, "0")}`;
};

const createDepartment = async (req, res) => {
    let connection;
    let departmentCodeLockAcquired = false;

    try {
        const { departmentName } = req.body;

        if (!departmentName || !departmentName.trim()) {
            return res.status(400).json({
                success: false,
                message: "Department name is required",
            });
        }

        const cleanName = departmentName.trim();

        const [existing] = await db.query(
            `SELECT id
       FROM departments
       WHERE department_name = ?
       LIMIT 1`,
            [cleanName]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Department already exists",
            });
        }

        connection = await db.getConnection();

        const [lockRows] = await connection.query(
            "SELECT GET_LOCK(?, 10) AS acquired",
            [DEPARTMENT_CODE_LOCK]
        );

        if (Number(lockRows[0].acquired) !== 1) {
            return res.status(503).json({
                success: false,
                message:
                    "Department creation is temporarily busy. Please try again.",
            });
        }

        departmentCodeLockAcquired = true;
        await connection.beginTransaction();

        const departmentCode =
            await getNextDepartmentCode(connection);

        const [result] = await connection.query(
            `INSERT INTO departments (
        department_code,
        department_name,
        status
      )
      VALUES (?, ?, 'ACTIVE')`,
            [departmentCode, cleanName]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Department created successfully",
            departmentId: result.insertId,
            departmentCode,
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Create department error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    } finally {
        if (departmentCodeLockAcquired) {
            await connection.query(
                "SELECT RELEASE_LOCK(?)",
                [DEPARTMENT_CODE_LOCK]
            );
        }

        if (connection) {
            connection.release();
        }
    }
};

const getDepartments = async (req, res) => {
    try {
        const [departments] = await db.query(
            `SELECT
        id,
        department_code AS departmentCode,
        department_name AS departmentName,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
       FROM departments
       ORDER BY
        CAST(SUBSTRING(department_code, 3) AS UNSIGNED) ASC,
        department_code ASC`
        );

        return res.status(200).json({
            success: true,
            departments,
        });
    } catch (error) {
        console.error("Get departments error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const [departments] = await db.query(
            `SELECT
        id,
        department_code AS departmentCode,
        department_name AS departmentName,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
       FROM departments
       WHERE id = ?
       LIMIT 1`,
            [id]
        );

        if (departments.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Department not found",
            });
        }

        return res.status(200).json({
            success: true,
            department: departments[0],
        });
    } catch (error) {
        console.error("Get department error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { departmentName } = req.body;

        if (!departmentName || !departmentName.trim()) {
            return res.status(400).json({
                success: false,
                message: "Department name is required",
            });
        }

        const cleanName = departmentName.trim();

        const [current] = await db.query(
            `SELECT id
       FROM departments
       WHERE id = ?
       LIMIT 1`,
            [id]
        );

        if (current.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Department not found",
            });
        }

        const [duplicate] = await db.query(
            `SELECT id
       FROM departments
       WHERE department_name = ?
       AND id <> ?
       LIMIT 1`,
            [cleanName, id]
        );

        if (duplicate.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Department already exists",
            });
        }

        await db.query(
            `UPDATE departments
       SET department_name = ?
       WHERE id = ?`,
            [cleanName, id]
        );

        return res.status(200).json({
            success: true,
            message: "Department updated successfully",
        });
    } catch (error) {
        console.error("Update department error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const updateDepartmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be ACTIVE or INACTIVE",
            });
        }

        const [departments] = await db.query(
            `SELECT id
       FROM departments
       WHERE id = ?
       LIMIT 1`,
            [id]
        );

        if (departments.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Department not found",
            });
        }

        await db.query(
            `UPDATE departments
       SET status = ?
       WHERE id = ?`,
            [status, id]
        );

        return res.status(200).json({
            success: true,
            message: `Department marked as ${status}`,
        });
    } catch (error) {
        console.error("Update department status error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = {
    createDepartment,
    getDepartments,
    getDepartmentById,
    updateDepartment,
    updateDepartmentStatus,
};

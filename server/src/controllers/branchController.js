const db = require("../config/db");
const { writeAuditLog } = require("../services/auditService");

// Start Aditya - Branch weekly off support

const ALLOWED_WEEKDAYS = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
];

const normalizeWeeklyOffs = (weeklyOffs) => {
    if (weeklyOffs === undefined) {
        return [];
    }

    if (!Array.isArray(weeklyOffs)) {
        return null;
    }

    const normalized = [
        ...new Set(
            weeklyOffs.map((day) =>
                String(day).trim().toUpperCase()
            )
        ),
    ];

    const invalidDay = normalized.find(
        (day) =>
            !ALLOWED_WEEKDAYS.includes(day)
    );

    if (invalidDay) {
        return null;
    }

    return normalized;
};

const attachWeeklyOffsToBranches = async (
    branches
) => {
    if (!branches.length) {
        return branches;
    }

    const branchIds = branches.map(
        (branch) => branch.id
    );

    const placeholders = branchIds
        .map(() => "?")
        .join(",");

    const [weeklyOffRows] =
        await db.query(
            `SELECT
                branch_id AS branchId,
                weekday
             FROM branch_weekly_offs
             WHERE branch_id IN (${placeholders})
             ORDER BY
                FIELD(
                    weekday,
                    'MONDAY',
                    'TUESDAY',
                    'WEDNESDAY',
                    'THURSDAY',
                    'FRIDAY',
                    'SATURDAY',
                    'SUNDAY'
                )`,
            branchIds
        );

    const weeklyOffMap = {};

    weeklyOffRows.forEach((row) => {
        if (!weeklyOffMap[row.branchId]) {
            weeklyOffMap[row.branchId] = [];
        }

        weeklyOffMap[row.branchId].push(
            row.weekday
        );
    });

    return branches.map((branch) => ({
        ...branch,

        weeklyOffs:
            weeklyOffMap[branch.id] || [],
    }));
};

const saveWeeklyOffs = async (
    branchId,
    weeklyOffs,
    connection = db
) => {
    if (!weeklyOffs.length) {
        return;
    }

    const values = weeklyOffs.map(
        (weekday) => [
            branchId,
            weekday,
        ]
    );

    await connection.query(
        `INSERT INTO branch_weekly_offs (
            branch_id,
            weekday
        )
        VALUES ?`,
        [values]
    );
};

const BRANCH_CODE_LOCK =
    "workpulse_branch_code_generation";

const getNextBranchCode = async (connection) => {
    const [rows] = await connection.query(
        `SELECT
            COALESCE(
                MAX(CAST(SUBSTRING(branch_code, 3) AS UNSIGNED)),
                0
            ) + 1 AS nextSequence
         FROM branches
         WHERE branch_code REGEXP '^BR[0-9]+$'`
    );

    return `BR${String(Number(rows[0].nextSequence)).padStart(3, "0")}`;
};

// End Aditya

const createBranch = async (req, res) => {
    let connection;
    let branchCodeLockAcquired = false;

    try {
        const {
            branchName,
            address,
            pincode,
            latitude,
            longitude,
            weeklyOffs,
        } = req.body;

        if (
            !branchName ||
            !address ||
            !pincode ||
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "All branch fields are required",
            });
        }

        // Start Aditya - Validate weekly offs

        const normalizedWeeklyOffs =
            normalizeWeeklyOffs(weeklyOffs);

        if (
            normalizedWeeklyOffs === null
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "weeklyOffs must be an array containing valid weekdays",
            });
        }

        // End Aditya

        connection = await db.getConnection();

        const [lockRows] = await connection.query(
            "SELECT GET_LOCK(?, 10) AS acquired",
            [BRANCH_CODE_LOCK]
        );

        if (Number(lockRows[0].acquired) !== 1) {
            return res.status(503).json({
                success: false,
                message:
                    "Branch creation is temporarily busy. Please try again.",
            });
        }

        branchCodeLockAcquired = true;
        await connection.beginTransaction();

        const branchCode =
            await getNextBranchCode(connection);

        const [result] = await connection.query(
            `INSERT INTO branches (
                branch_code,
                branch_name,
                address,
                pincode,
                latitude,
                longitude,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
            [
                branchCode,
                branchName,
                address,
                pincode,
                latitude,
                longitude,
            ]
        );

        // Start Aditya - Save branch weekly offs

        await saveWeeklyOffs(
            result.insertId,
            normalizedWeeklyOffs,
            connection
        );

        // End Aditya

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "BRANCH_CREATED",
            entityType: "BRANCH",
            entityId: result.insertId,
            newData: {
                branchCode,
                branchName: String(branchName).trim(),
                status: "ACTIVE",
                weeklyOffs: normalizedWeeklyOffs,
            },
            req,
        });

        await connection.commit();

        return res.status(201).json({
            success: true,
            message:
                "Branch created successfully",
            branchId: result.insertId,
            branchCode,

            // Start Aditya
            weeklyOffs:
                normalizedWeeklyOffs,
            // End Aditya
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(
            "Create branch error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    } finally {
        if (branchCodeLockAcquired) {
            await connection.query(
                "SELECT RELEASE_LOCK(?)",
                [BRANCH_CODE_LOCK]
            );
        }

        if (connection) {
            connection.release();
        }
    }
};

const getBranches = async (req, res) => {
    try {
        const [branches] = await db.query(
            `SELECT
                id,
                branch_code AS branchCode,
                branch_name AS branchName,
                address,
                pincode,
                latitude,
                longitude,
                status,
                created_at AS createdAt,
                updated_at AS updatedAt
             FROM branches
             ORDER BY id DESC`
        );

        // Start Aditya - Include weekly offs

        const branchesWithWeeklyOffs =
            await attachWeeklyOffsToBranches(
                branches
            );

        // End Aditya

        return res.status(200).json({
            success: true,

            // Start Aditya
            branches:
                branchesWithWeeklyOffs,
            // End Aditya
        });
    } catch (error) {
        console.error(
            "Get branches error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};

const getBranchById = async (
    req,
    res
) => {
    try {
        const { id } = req.params;

        const [branches] = await db.query(
            `SELECT
                id,
                branch_code AS branchCode,
                branch_name AS branchName,
                address,
                pincode,
                latitude,
                longitude,
                status,
                created_at AS createdAt,
                updated_at AS updatedAt
             FROM branches
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (branches.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Branch not found",
            });
        }

        // Start Aditya - Include weekly offs

        const branchesWithWeeklyOffs =
            await attachWeeklyOffsToBranches(
                branches
            );

        // End Aditya

        return res.status(200).json({
            success: true,
            branch:
                branchesWithWeeklyOffs[0],
        });
    } catch (error) {
        console.error(
            "Get branch error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};

const updateBranch = async (req, res) => {
    let connection;

    try {
        const { id } = req.params;

        const {
            branchName,
            address,
            pincode,
            latitude,
            longitude,
            weeklyOffs,
        } = req.body;

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [branches] = await connection.query(
            `SELECT id, branch_code AS branchCode, branch_name AS branchName,
                    address, pincode, latitude, longitude, status
             FROM branches
             WHERE id = ?
             LIMIT 1 FOR UPDATE`,
            [id]
        );

        if (branches.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message:
                    "Branch not found",
            });
        }

        if (
            !branchName ||
            !address ||
            !pincode ||
            latitude === undefined ||
            longitude === undefined
        ) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message:
                    "All branch fields are required",
            });
        }

        // Start Aditya - Validate weekly offs

        const normalizedWeeklyOffs =
            normalizeWeeklyOffs(weeklyOffs);

        if (
            normalizedWeeklyOffs === null
        ) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message:
                    "weeklyOffs must be an array containing valid weekdays",
            });
        }

        // End Aditya

        const [oldWeeklyOffs] = await connection.query(
            `SELECT weekday FROM branch_weekly_offs WHERE branch_id = ? ORDER BY weekday`,
            [id]
        );

        await connection.query(
            `UPDATE branches
             SET
                branch_name = ?,
                address = ?,
                pincode = ?,
                latitude = ?,
                longitude = ?
             WHERE id = ?`,
            [
                branchName,
                address,
                pincode,
                latitude,
                longitude,
                id,
            ]
        );

        // Start Aditya - Replace weekly offs

        await connection.query(
            `DELETE FROM branch_weekly_offs
             WHERE branch_id = ?`,
            [id]
        );

        await saveWeeklyOffs(
            id,
            normalizedWeeklyOffs,
            connection
        );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "BRANCH_UPDATED",
            entityType: "BRANCH",
            entityId: Number(id),
            oldData: {
                ...branches[0],
                weeklyOffs: oldWeeklyOffs.map((row) => row.weekday),
            },
            newData: {
                branchCode: branches[0].branchCode,
                branchName: String(branchName).trim(),
                address: String(address).trim(),
                pincode: String(pincode).trim(),
                latitude,
                longitude,
                status: branches[0].status,
                weeklyOffs: normalizedWeeklyOffs,
            },
            req,
        });

        // End Aditya

        await connection.commit();

        return res.status(200).json({
            success: true,
            message:
                "Branch updated successfully",

            // Start Aditya
            weeklyOffs:
                normalizedWeeklyOffs,
            // End Aditya
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(
            "Update branch error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    } finally {
        if (connection) connection.release();
    }
};

const updateBranchStatus = async (
    req,
    res
) => {
    let connection;

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

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [branches] = await connection.query(
            `SELECT id, branch_code AS branchCode, branch_name AS branchName, status
             FROM branches
             WHERE id = ?
             LIMIT 1 FOR UPDATE`,
            [id]
        );

        if (branches.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message:
                    "Branch not found",
            });
        }

        await connection.query(
            `UPDATE branches
             SET status = ?
             WHERE id = ?`,
            [status, id]
        );

        await writeAuditLog(connection, {
            actorId: req.user.id,
            action: "BRANCH_STATUS_CHANGED",
            entityType: "BRANCH",
            entityId: Number(id),
            oldData: { ...branches[0] },
            newData: { ...branches[0], status },
            req,
        });

        await connection.commit();

        return res.status(200).json({
            success: true,
            message:
                `Branch marked as ${status}`,
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(
            "Update branch status error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createBranch,
    getBranches,
    getBranchById,
    updateBranch,
    updateBranchStatus,
};

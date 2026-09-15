const db = require("../config/db");

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
    weeklyOffs
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

    await db.query(
        `INSERT INTO branch_weekly_offs (
            branch_id,
            weekday
        )
        VALUES ?`,
        [values]
    );
};

// End Aditya

const createBranch = async (req, res) => {
    try {
        const {
            branchCode,
            branchName,
            address,
            pincode,
            latitude,
            longitude,
            weeklyOffs,
        } = req.body;

        if (
            !branchCode ||
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

        const [existing] = await db.query(
            `SELECT id
             FROM branches
             WHERE branch_code = ?
             LIMIT 1`,
            [branchCode]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Branch code already exists",
            });
        }

        const [result] = await db.query(
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
            normalizedWeeklyOffs
        );

        // End Aditya

        return res.status(201).json({
            success: true,
            message:
                "Branch created successfully",
            branchId: result.insertId,

            // Start Aditya
            weeklyOffs:
                normalizedWeeklyOffs,
            // End Aditya
        });
    } catch (error) {
        console.error(
            "Create branch error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
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
    try {
        const { id } = req.params;

        const {
            branchCode,
            branchName,
            address,
            pincode,
            latitude,
            longitude,
            weeklyOffs,
        } = req.body;

        const [branches] = await db.query(
            `SELECT id
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

        if (
            !branchCode ||
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

        console.log(
            "UPDATE BRANCH WEEKLY OFFS:",
            id,
            normalizedWeeklyOffs
        );

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

        const [duplicate] = await db.query(
            `SELECT id
             FROM branches
             WHERE branch_code = ?
             AND id <> ?
             LIMIT 1`,
            [branchCode, id]
        );

        if (duplicate.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Branch code already exists",
            });
        }

        await db.query(
            `UPDATE branches
             SET
                branch_code = ?,
                branch_name = ?,
                address = ?,
                pincode = ?,
                latitude = ?,
                longitude = ?
             WHERE id = ?`,
            [
                branchCode,
                branchName,
                address,
                pincode,
                latitude,
                longitude,
                id,
            ]
        );

        // Start Aditya - Replace weekly offs

        await db.query(
            `DELETE FROM branch_weekly_offs
             WHERE branch_id = ?`,
            [id]
        );

        await saveWeeklyOffs(
            id,
            normalizedWeeklyOffs
        );

        const [debugWeeklyOffs] = await db.query(
            `SELECT
            id,
            branch_id AS branchId,
            weekday
            FROM branch_weekly_offs
            WHERE branch_id = ?
            ORDER BY id`,
            [id]
        );

        // End Aditya

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
        console.error(
            "Update branch error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};

const updateBranchStatus = async (
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

        const [branches] = await db.query(
            `SELECT id
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

        await db.query(
            `UPDATE branches
             SET status = ?
             WHERE id = ?`,
            [status, id]
        );

        return res.status(200).json({
            success: true,
            message:
                `Branch marked as ${status}`,
        });
    } catch (error) {
        console.error(
            "Update branch status error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error",
        });
    }
};

module.exports = {
    createBranch,
    getBranches,
    getBranchById,
    updateBranch,
    updateBranchStatus,
};
const db = require("../config/db");

const createBranch = async (req, res) => {
    try {
        const {
            branchCode,
            branchName,
            address,
            pincode,
            latitude,
            longitude,
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
                message: "All branch fields are required",
            });
        }

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
                message: "Branch code already exists",
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

        return res.status(201).json({
            success: true,
            message: "Branch created successfully",
            branchId: result.insertId,
        });
    } catch (error) {
        console.error("Create branch error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
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

        return res.status(200).json({
            success: true,
            branches,
        });
    } catch (error) {
        console.error("Get branches error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const getBranchById = async (req, res) => {
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
                message: "Branch not found",
            });
        }

        return res.status(200).json({
            success: true,
            branch: branches[0],
        });
    } catch (error) {
        console.error("Get branch error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
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
                message: "Branch not found",
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
                message: "All branch fields are required",
            });
        }

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
                message: "Branch code already exists",
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

        return res.status(200).json({
            success: true,
            message: "Branch updated successfully",
        });
    } catch (error) {
        console.error("Update branch error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

const updateBranchStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be ACTIVE or INACTIVE",
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
                message: "Branch not found",
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
            message: `Branch marked as ${status}`,
        });
    } catch (error) {
        console.error("Update branch status error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
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
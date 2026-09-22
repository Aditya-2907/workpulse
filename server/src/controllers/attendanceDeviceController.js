const crypto = require("crypto");
const db = require("../config/db");
const { writeAuditLog } = require("../services/auditService");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getDevices = async (_req, res) => {
    try {
        const [devices] = await db.query("SELECT id, display_name AS displayName, status, last_used_at AS lastUsedAt, created_at AS createdAt, revoked_at AS revokedAt FROM attendance_devices ORDER BY created_at DESC");
        return res.json({ success: true, devices });
    } catch (_error) { return res.status(500).json({ success: false, message: "Unable to load attendance devices" }); }
};

const createDevice = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const displayName = String(req.body.displayName || "").trim();
        if (!displayName || displayName.length > 120) return res.status(400).json({ success: false, message: "A device display name of up to 120 characters is required." });
        await connection.beginTransaction();
        const deviceToken = crypto.randomBytes(32).toString("base64url");
        const [result] = await connection.query("INSERT INTO attendance_devices (display_name, device_token_hash, created_by) VALUES (?, ?, ?)", [displayName, hashToken(deviceToken), req.user.id]);
        await writeAuditLog(connection, { actorId: req.user.id, action: "ATTENDANCE_DEVICE_CREATED", entityType: "ATTENDANCE_DEVICE", entityId: result.insertId, newData: { displayName, credentialIssued: true }, req });
        await connection.commit();
        return res.status(201).json({ success: true, device: { id: result.insertId, displayName }, deviceToken, message: "Copy the device credential now. WorkPulse does not store or show it again." });
    } catch (_error) { await connection.rollback(); return res.status(500).json({ success: false, message: "Unable to create attendance device" }); } finally { connection.release(); }
};

const revokeDevice = async (req, res) => {
    let connection;
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: "Invalid attendance device." });
        connection = await db.getConnection();
        await connection.beginTransaction();
        const [[device]] = await connection.query("SELECT id, display_name AS displayName, status FROM attendance_devices WHERE id = ? FOR UPDATE", [id]);
        if (!device || device.status !== "ACTIVE") { await connection.rollback(); return res.status(404).json({ success: false, message: "Active attendance device not found." }); }
        await connection.query("UPDATE attendance_devices SET status = 'REVOKED', revoked_at = NOW() WHERE id = ?", [id]);
        await writeAuditLog(connection, { actorId: req.user.id, action: "ATTENDANCE_DEVICE_REVOKED", entityType: "ATTENDANCE_DEVICE", entityId: id, oldData: device, newData: { ...device, status: "REVOKED" }, req });
        await connection.commit();
        return res.json({ success: true, message: "Attendance device revoked." });
    } catch (_error) { if (connection) await connection.rollback(); return res.status(500).json({ success: false, message: "Unable to revoke attendance device" }); } finally { if (connection) connection.release(); }
};
module.exports = { getDevices, createDevice, revokeDevice, hashToken };

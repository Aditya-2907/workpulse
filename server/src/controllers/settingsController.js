const db = require("../config/db");
const { writeAuditLog } = require("../services/auditService");

const defaults = {
    organizationName: "WorkPulse",
    organizationAddress: "",
    organizationPhone: "",
    organizationEmail: "",
    timezoneName: "Asia/Kolkata",
    attendanceAlertThreshold: 70,
    photoRetentionDays: 90,
    missingCheckoutGraceMinutes: 30,
    deviceEnforcementEnabled: false,
};

const getSettings = async (_req, res) => {
    try {
        const [[settings]] = await db.query(
            `SELECT organization_name AS organizationName, organization_address AS organizationAddress,
                organization_phone AS organizationPhone, organization_email AS organizationEmail,
                timezone_name AS timezoneName, attendance_alert_threshold AS attendanceAlertThreshold,
                photo_retention_days AS photoRetentionDays,
                missing_checkout_grace_minutes AS missingCheckoutGraceMinutes,
                device_enforcement_enabled AS deviceEnforcementEnabled
             FROM organization_settings WHERE id = 1`
        );
        return res.json({ success: true, settings: settings ? { ...defaults, ...settings, deviceEnforcementEnabled: Boolean(settings.deviceEnforcementEnabled) } : defaults });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to load organization settings" });
    }
};

const updateSettings = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const values = { ...defaults, ...req.body };
        const threshold = Number(values.attendanceAlertThreshold);
        const retention = Number(values.photoRetentionDays);
        const grace = Number(values.missingCheckoutGraceMinutes);
        if (!String(values.organizationName || "").trim() || !Number.isFinite(threshold) || threshold < 0 || threshold > 100 || !Number.isInteger(retention) || retention < 1 || retention > 3650 || !Number.isInteger(grace) || grace < 0 || grace > 1440) {
            return res.status(400).json({ success: false, message: "Use a name, a 0–100 attendance threshold, 1–3650 retention days, and a 0–1440 minute checkout grace." });
        }
        if (values.timezoneName !== "Asia/Kolkata") return res.status(400).json({ success: false, message: "WorkPulse currently supports Asia/Kolkata attendance semantics only." });
        if (values.organizationEmail && !/^\S+@\S+\.\S+$/.test(String(values.organizationEmail))) return res.status(400).json({ success: false, message: "Use a valid organization email address." });

        await connection.beginTransaction();
        const [[current]] = await connection.query("SELECT * FROM organization_settings WHERE id = 1 FOR UPDATE");
        if (!current) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Complete first-install setup before configuring organization settings." });
        }
        await connection.query(
            `UPDATE organization_settings SET organization_name = ?, organization_address = ?, organization_phone = ?, organization_email = ?, timezone_name = ?, attendance_alert_threshold = ?, photo_retention_days = ?, missing_checkout_grace_minutes = ?, device_enforcement_enabled = ? WHERE id = 1`,
            [String(values.organizationName).trim(), String(values.organizationAddress || "").trim() || null, String(values.organizationPhone || "").trim() || null, String(values.organizationEmail || "").trim().toLowerCase() || null, values.timezoneName, threshold, retention, grace, Boolean(values.deviceEnforcementEnabled)]
        );
        await writeAuditLog(connection, { actorId: req.user.id, action: "ORGANIZATION_SETTINGS_UPDATED", entityType: "ORGANIZATION_SETTINGS", entityId: 1, oldData: current, newData: { organizationName: values.organizationName, timezoneName: values.timezoneName, attendanceAlertThreshold: threshold, photoRetentionDays: retention, missingCheckoutGraceMinutes: grace, deviceEnforcementEnabled: Boolean(values.deviceEnforcementEnabled) }, req });
        await connection.commit();
        return res.json({ success: true, message: "Organization settings updated. Historical attendance was not changed." });
    } catch (error) {
        await connection.rollback();
        return res.status(500).json({ success: false, message: "Unable to update organization settings" });
    } finally { connection.release(); }
};

module.exports = { getSettings, updateSettings };

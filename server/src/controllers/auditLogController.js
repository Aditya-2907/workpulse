const db = require("../config/db");
const { redactAuditData } = require("../services/auditService");

const getAuditLogs = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
        const pageSize = Math.min(200, Math.max(10, Number.parseInt(req.query.pageSize || "50", 10) || 50));
        const offset = (page - 1) * pageSize;
        const conditions = [];
        const params = [];
        if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "")) { conditions.push("DATE(al.created_at) = ?"); params.push(req.query.date); }
        if (String(req.query.action || "").trim()) { conditions.push("al.action = ?"); params.push(String(req.query.action).trim()); }
        if (String(req.query.entityType || "").trim()) { conditions.push("al.entity_type = ?"); params.push(String(req.query.entityType).trim()); }
        if (String(req.query.actor || "").trim()) { conditions.push("(actor.full_name LIKE ? OR actor.employee_code LIKE ?)"); const q = `%${String(req.query.actor).trim()}%`; params.push(q, q); }
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const [rows] = await db.query(
            `SELECT al.id, al.action, al.entity_type AS entityType, al.entity_id AS entityId,
                    al.old_data AS oldData, al.new_data AS newData, al.created_at AS createdAt,
                    actor.id AS actorId, actor.full_name AS actorName, actor.employee_code AS actorCode
             FROM audit_logs al LEFT JOIN users actor ON actor.id = al.performed_by
             ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );
        const [[count]] = await db.query(`SELECT COUNT(*) AS total FROM audit_logs al LEFT JOIN users actor ON actor.id = al.performed_by ${where}`, params);
        return res.json({ success: true, page, pageSize, total: Number(count.total), logs: rows.map((row) => ({ ...row, oldData: row.oldData ? redactAuditData(typeof row.oldData === "string" ? JSON.parse(row.oldData) : row.oldData) : null, newData: row.newData ? redactAuditData(typeof row.newData === "string" ? JSON.parse(row.newData) : row.newData) : null })) });
    } catch (_error) {
        return res.status(500).json({ success: false, message: "Unable to load audit logs" });
    }
};
module.exports = { getAuditLogs };

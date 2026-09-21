const SENSITIVE_KEY = /password|token|secret|aadhaar|pan|photo.*(path|url|id)/i;

const redactAuditData = (value) => {
    if (Array.isArray(value)) return value.map(redactAuditData);
    if (!value || typeof value !== "object") return value;

    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
            key,
            SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactAuditData(entry),
        ])
    );
};

const getRequestContext = (req) => ({
    ipAddress: req?.ip || null,
    userAgent: typeof req?.get === "function" ? req.get("user-agent")?.slice(0, 1000) || null : null,
});

const writeAuditLog = async (executor, {
    actorId = null,
    action,
    entityType,
    entityId = null,
    oldData = null,
    newData = null,
    req = null,
}) => {
    if (!executor || !action || !entityType) {
        throw new Error("Audit event requires an executor, action, and entity type");
    }

    const context = getRequestContext(req);
    await executor.query(
        `INSERT INTO audit_logs (
            performed_by, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            actorId,
            action,
            entityType,
            entityId,
            oldData ? JSON.stringify(redactAuditData(oldData)) : null,
            newData ? JSON.stringify(redactAuditData(newData)) : null,
            context.ipAddress,
            context.userAgent,
        ]
    );
};

module.exports = { redactAuditData, writeAuditLog };

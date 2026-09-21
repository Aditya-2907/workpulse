const { getManagementAlerts } = require("../services/managementAlertService");

const getAlerts = async (req, res) => {
    try {
        const isSuperAdmin = req.user.role === "SUPER_ADMIN";
        if (!isSuperAdmin && !req.user.branchId) return res.status(400).json({ success: false, message: "Admin is not assigned to a branch" });
        const alerts = await getManagementAlerts(isSuperAdmin ? null : req.user.branchId, isSuperAdmin);
        return res.json({ success: true, alerts });
    } catch (_error) {
        return res.status(500).json({ success: false, message: "Unable to load management alerts" });
    }
};

module.exports = { getAlerts };

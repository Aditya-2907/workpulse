const getMyProfile = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Authenticated user",
        user: req.user,
    });
};

const superAdminOnly = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Super Admin access granted",
        user: req.user,
    });
};

const managementOnly = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Admin/Super Admin access granted",
        user: req.user,
    });
};

module.exports = {
    getMyProfile,
    superAdminOnly,
    managementOnly,
};
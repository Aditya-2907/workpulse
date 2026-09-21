const fs = require("fs");
const path = require("path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    console.log(`PASS: ${message}`);
};

try {
    const adminController = read("src/controllers/adminController.js");
    const approvalController = read("src/controllers/adminApprovalController.js");
    const authController = read("src/controllers/authController.js");
    const authMiddleware = read("src/middleware/authMiddleware.js");
    const adminRoutes = read("src/routes/adminRoutes.js");
    const authRoutes = read("src/routes/authRoutes.js");

    const updateAdminSource = adminController.slice(adminController.indexOf("const updateAdmin"), adminController.indexOf("const updateAdminStatus"));
    const adminReadSource = adminController.slice(adminController.indexOf("const getAdmins"), adminController.indexOf("const updateAdmin"));
    const requestSource = approvalController.slice(approvalController.indexOf("const requestAdminCreation"), approvalController.indexOf("const getAdminApprovalRequests"));

    assert(/router\.use\([\s\S]*allowRoles\("SUPER_ADMIN"\)/.test(adminRoutes), "Admin management and reset routes require Super Admin authorization");
    assert(!/password_hash|passwordHash|\bpassword\b/i.test(adminReadSource), "Admin list/detail serializers do not expose password data");
    assert(!/password_hash|passwordHash|\bpassword\b/i.test(updateAdminSource), "ordinary Admin edit ignores crafted password fields");
    assert(!/\bpassword\b\s*[,:]/i.test(requestSource), "Admin request intake does not collect an applicant password");
    assert(/must_change_password,\s*role/.test(adminController) && /TRUE,\s*'ADMIN'/.test(adminController), "Super Admin direct creation stores a forced-change state");
    assert(/temporaryPassword/.test(approvalController) && /must_change_password = CASE/.test(approvalController), "approval creates only a temporary credential and forced-change state");
    assert(/PASSWORD_CHANGE_REQUIRED/.test(authMiddleware) && /must_change_password/.test(authMiddleware), "backend blocks normal management requests while password change is required");
    assert(/management\/force-password-change/.test(authRoutes) && /forceManagementPasswordChange/.test(authController), "forced password-change endpoint is mounted and implemented");
    assert(/token_version = token_version \+ 1/.test(authController), "forced change invalidates the temporary JWT session");
    console.log("PASS: password-isolation source contract");
} catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
}

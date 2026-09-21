const express = require("express");

const {
    createEmployee,
    getEmployees,
    getEmployeeById,
    updateEmployeeStatus,
    updateEmployee,
    transferEmployeeBranch,
} = require("../controllers/employeeController");
const { downloadTemplate, previewImport, confirmImport } = require("../controllers/employeeImportController");
const { uploadEmployeeImport } = require("../middleware/importUploadMiddleware");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const {
    allowRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(
    authenticate,
    allowRoles("ADMIN", "SUPER_ADMIN")
);

router.post("/", createEmployee);

router.get("/import-template", allowRoles("SUPER_ADMIN"), downloadTemplate);
router.post("/import/preview", allowRoles("SUPER_ADMIN"), uploadEmployeeImport.single("file"), previewImport);
router.post("/import/confirm", allowRoles("SUPER_ADMIN"), confirmImport);

router.get("/", getEmployees);

router.get("/:id", getEmployeeById);

router.put("/:id", updateEmployee);

router.patch("/:id/status", updateEmployeeStatus);

router.patch(
    "/:id/transfer-branch",
    allowRoles("SUPER_ADMIN"),
    transferEmployeeBranch
);

module.exports = router;

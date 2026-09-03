const express = require("express");

const {
    createEmployee,
    getEmployees,
    getEmployeeById,
    updateEmployeeStatus,
    updateEmployee,
    transferEmployeeBranch,
} = require("../controllers/employeeController");

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

router.get("/", getEmployees);

router.get("/:id", getEmployeeById);

router.put("/:id", updateEmployee);

router.patch("/:id/status", updateEmployeeStatus);

router.patch(
    "/:id/status",
    updateEmployeeStatus
);

router.patch(
    "/:id/transfer-branch",
    allowRoles("SUPER_ADMIN"),
    transferEmployeeBranch
);

module.exports = router;
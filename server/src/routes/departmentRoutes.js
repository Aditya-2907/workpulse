const express = require("express");

const {
    createDepartment,
    getDepartments,
    getDepartmentById,
    updateDepartment,
    updateDepartmentStatus,
} = require("../controllers/departmentController");

const {
    authenticate,
} = require("../middleware/authMiddleware");

const {
    allowRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Department List
|--------------------------------------------------------------------------
| SUPER_ADMIN and ADMIN can view departments.
| ADMIN needs this list while assigning an employee/admin.
|--------------------------------------------------------------------------
*/

router.get(
    "/",
    authenticate,
    allowRoles("SUPER_ADMIN", "ADMIN"),
    getDepartments
);

/*
|--------------------------------------------------------------------------
| Super Admin Only
|--------------------------------------------------------------------------
| Only SUPER_ADMIN can create, edit, or change department status.
|--------------------------------------------------------------------------
*/

router.post(
    "/",
    authenticate,
    allowRoles("SUPER_ADMIN"),
    createDepartment
);

router.get(
    "/:id",
    authenticate,
    allowRoles("SUPER_ADMIN"),
    getDepartmentById
);

router.put(
    "/:id",
    authenticate,
    allowRoles("SUPER_ADMIN"),
    updateDepartment
);

router.patch(
    "/:id/status",
    authenticate,
    allowRoles("SUPER_ADMIN"),
    updateDepartmentStatus
);

module.exports = router;
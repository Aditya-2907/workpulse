const db = require("../config/db");

const getSuperAdminDashboard = async (req, res) => {
    try {
        const [
            [branchResult],
            [adminResult],
            [employeeResult],
            [presentResult],
            [lateResult],
            [leaveResult],
            [totalActiveEmployeeResult],
        ] = await Promise.all([
            db.query(`
                SELECT COUNT(*) AS total
                FROM branches
                WHERE status = 'ACTIVE'
            `),

            db.query(`
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'ADMIN'
                AND account_status = 'ACTIVE'
            `),

            db.query(`
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'EMPLOYEE'
                AND account_status = 'ACTIVE'
            `),

            db.query(`
                SELECT COUNT(DISTINCT user_id) AS total
                FROM attendance_records
                WHERE attendance_date = CURDATE()
                AND check_in_time IS NOT NULL
            `),

            db.query(`
                SELECT COUNT(DISTINCT user_id) AS total
                FROM attendance_records
                WHERE attendance_date = CURDATE()
                AND is_late = 1
            `),

            db.query(`
                SELECT COUNT(DISTINCT user_id) AS total
                FROM leaves
                WHERE CURDATE() BETWEEN from_date AND to_date
                AND status = 'APPROVED'
            `),

            db.query(`
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'EMPLOYEE'
                AND account_status = 'ACTIVE'
            `),
        ]);

        const totalBranches = Number(branchResult[0]?.total || 0);
        const totalAdmins = Number(adminResult[0]?.total || 0);
        const totalEmployees = Number(employeeResult[0]?.total || 0);
        const presentToday = Number(presentResult[0]?.total || 0);
        const lateToday = Number(lateResult[0]?.total || 0);
        const leaveToday = Number(leaveResult[0]?.total || 0);
        const totalActiveEmployees = Number(
            totalActiveEmployeeResult[0]?.total || 0
        );

        const absentToday = Math.max(
            totalActiveEmployees - presentToday - leaveToday,
            0
        );

        return res.status(200).json({
            success: true,
            data: {
                totals: {
                    branches: totalBranches,
                    admins: totalAdmins,
                    employees: totalEmployees,
                    presentToday,
                },

                attendance: {
                    present: presentToday,
                    late: lateToday,
                    leave: leaveToday,
                    absent: absentToday,
                },
            },
        });
    } catch (error) {
        console.error("Super Admin dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard data",
        });
    }
};

const getAdminDashboard = async (req, res) => {
    try {
        const branchId = req.user.branchId;

        if (!branchId) {
            return res.status(400).json({
                success: false,
                message: "Admin is not assigned to a branch",
            });
        }

        const [
            [branchResult],
            [employeeResult],
            [presentResult],
            [lateResult],
            [leaveResult],
        ] = await Promise.all([
            db.query(
                `
                    SELECT
                        id,
                        branch_name AS name,
                        branch_code AS code
                    FROM branches
                    WHERE id = ?
                    LIMIT 1
                `,
                [branchId]
            ),

            db.query(
                `
                    SELECT COUNT(*) AS total
                    FROM users
                    WHERE role = 'EMPLOYEE'
                    AND account_status = 'ACTIVE'
                    AND branch_id = ?
                `,
                [branchId]
            ),

            db.query(
                `
                    SELECT COUNT(DISTINCT ar.user_id) AS total
                    FROM attendance_records ar
                    INNER JOIN users u
                        ON u.id = ar.user_id
                    WHERE ar.attendance_date = CURDATE()
                    AND ar.check_in_time IS NOT NULL
                    AND u.role = 'EMPLOYEE'
                    AND u.branch_id = ?
                `,
                [branchId]
            ),

            db.query(
                `
                    SELECT COUNT(DISTINCT ar.user_id) AS total
                    FROM attendance_records ar
                    INNER JOIN users u
                        ON u.id = ar.user_id
                    WHERE ar.attendance_date = CURDATE()
                    AND ar.is_late = 1
                    AND u.role = 'EMPLOYEE'
                    AND u.branch_id = ?
                `,
                [branchId]
            ),

            db.query(
                `
                    SELECT COUNT(DISTINCT l.user_id) AS total
                    FROM leaves l
                    INNER JOIN users u
                        ON u.id = l.user_id
                    WHERE CURDATE() BETWEEN l.from_date AND l.to_date
                    AND l.status = 'APPROVED'
                    AND u.role = 'EMPLOYEE'
                    AND u.branch_id = ?
                `,
                [branchId]
            ),
        ]);

        const branch = branchResult[0] || null;

        const totalEmployees = Number(
            employeeResult[0]?.total || 0
        );

        const presentToday = Number(
            presentResult[0]?.total || 0
        );

        const lateToday = Number(
            lateResult[0]?.total || 0
        );

        const leaveToday = Number(
            leaveResult[0]?.total || 0
        );

        const [[weeklyOffResult]] = await db.query(
            `
        SELECT EXISTS(
            SELECT 1
            FROM branch_weekly_offs
            WHERE branch_id = ?
            AND weekday = UPPER(DAYNAME(CURDATE()))
        ) AS isWeeklyOff
    `,
            [branchId]
        );

        const [[holidayResult]] = await db.query(
            `
        SELECT EXISTS(
            SELECT 1
            FROM holidays
            WHERE holiday_date = CURDATE()
        ) AS isHoliday
    `
        );

        const isNonWorkingDay =
            Number(weeklyOffResult?.isWeeklyOff || 0) === 1 ||
            Number(holidayResult?.isHoliday || 0) === 1;

        const absentToday = isNonWorkingDay
            ? 0
            : Math.max(
                totalEmployees - presentToday - leaveToday,
                0
            );

        return res.status(200).json({
            success: true,
            data: {
                branch: branch
                    ? {
                        id: branch.id,
                        name: branch.name,
                        code: branch.code,
                    }
                    : null,

                totals: {
                    employees: totalEmployees,
                    presentToday,
                },

                attendance: {
                    present: presentToday,
                    late: lateToday,
                    leave: leaveToday,
                    absent: absentToday,
                },
            },
        });
    } catch (error) {
        console.error("Admin dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard data",
        });
    }
};

module.exports = {
    getSuperAdminDashboard,
    getAdminDashboard,
};
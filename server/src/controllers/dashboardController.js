const db = require("../config/db");

const DASHBOARD_DRILLDOWN_TYPES = [
    "PRESENT",
    "LATE",
    "LEAVE",
    "ABSENT",
];

const getDashboardAnalytics = async (branchId = null) => {
    const branchScope = branchId ? "AND u.branch_id = ?" : "";
    const params = branchId ? [branchId] : [];
    const [trendResult, departmentResult] = await Promise.all([
        db.query(
            `SELECT
                DATE_FORMAT(calendar.attendance_date, '%d %b') AS label,
                DATE_FORMAT(calendar.attendance_date, '%Y-%m-%d') AS attendanceDate,
                COUNT(DISTINCT u.id) AS present
             FROM (
                SELECT CURDATE() AS attendance_date
                UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 2 DAY)
                UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 3 DAY)
                UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 4 DAY)
                UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 5 DAY)
                UNION ALL SELECT DATE_SUB(CURDATE(), INTERVAL 6 DAY)
             ) calendar
             LEFT JOIN attendance_records ar
                ON ar.attendance_date = calendar.attendance_date
                AND ar.check_in_time IS NOT NULL
             LEFT JOIN users u
                ON u.id = ar.user_id
                AND u.role = 'EMPLOYEE'
                AND u.account_status = 'ACTIVE'
                ${branchScope}
             GROUP BY calendar.attendance_date
             ORDER BY calendar.attendance_date ASC`,
            params
        ),
        db.query(
            `SELECT
                d.department_name AS name,
                COUNT(DISTINCT u.id) AS present
             FROM departments d
             LEFT JOIN users u
                ON u.department_id = d.id
                AND u.role = 'EMPLOYEE'
                AND u.account_status = 'ACTIVE'
                ${branchScope}
             LEFT JOIN attendance_records ar
                ON ar.user_id = u.id
                AND ar.attendance_date = CURDATE()
                AND ar.check_in_time IS NOT NULL
             WHERE d.status = 'ACTIVE'
             AND ar.id IS NOT NULL
             GROUP BY d.id, d.department_name
             ORDER BY present DESC, d.department_name ASC
             LIMIT 8`,
            params
        ),
    ]);

    return {
        trend: trendResult[0].map((row) => ({
            label: row.label,
            attendanceDate: row.attendanceDate,
            present: Number(row.present || 0),
        })),
        departments: departmentResult[0].map((row) => ({
            name: row.name,
            present: Number(row.present || 0),
        })),
    };
};

const getDashboardDrilldown = async (req, res) => {
    try {
        const type = String(req.query.type || "").toUpperCase();

        if (!DASHBOARD_DRILLDOWN_TYPES.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "A valid dashboard drill-down type is required",
            });
        }

        const isAdmin = req.user.role === "ADMIN";
        const branchId = isAdmin ? req.user.branchId : null;

        if (isAdmin && !branchId) {
            return res.status(400).json({
                success: false,
                message: "Admin is not assigned to a branch",
            });
        }

        if (type === "ABSENT" && isAdmin) {
            const [[nonWorkingDay]] = await db.query(
                `SELECT
                    (
                        EXISTS(
                            SELECT 1 FROM branch_weekly_offs
                            WHERE branch_id = ?
                            AND weekday = UPPER(DAYNAME(CURDATE()))
                        )
                        OR EXISTS(
                            SELECT 1 FROM holidays
                            WHERE holiday_date = CURDATE()
                        )
                    ) AS isNonWorkingDay`,
                [branchId]
            );

            if (Number(nonWorkingDay?.isNonWorkingDay || 0) === 1) {
                return res.status(200).json({
                    success: true,
                    data: { type, records: [] },
                });
            }
        }

        const predicates = {
            PRESENT: `EXISTS (
                SELECT 1 FROM attendance_records ar
                WHERE ar.user_id = u.id
                AND ar.attendance_date = CURDATE()
                AND ar.check_in_time IS NOT NULL
            )`,
            LATE: `EXISTS (
                SELECT 1 FROM attendance_records ar
                WHERE ar.user_id = u.id
                AND ar.attendance_date = CURDATE()
                AND ar.is_late = 1
            )`,
            LEAVE: `EXISTS (
                SELECT 1 FROM leaves l
                WHERE l.user_id = u.id
                AND CURDATE() BETWEEN l.from_date AND l.to_date
                AND l.status = 'APPROVED'
            )`,
            ABSENT: `NOT EXISTS (
                SELECT 1 FROM attendance_records ar
                WHERE ar.user_id = u.id
                AND ar.attendance_date = CURDATE()
                AND ar.check_in_time IS NOT NULL
            ) AND NOT EXISTS (
                SELECT 1 FROM leaves l
                WHERE l.user_id = u.id
                AND CURDATE() BETWEEN l.from_date AND l.to_date
                AND l.status = 'APPROVED'
            )`,
        };

        const params = isAdmin ? [branchId] : [];
        const [records] = await db.query(
            `SELECT
                u.id,
                u.employee_code AS employeeCode,
                u.full_name AS fullName,
                u.designation,
                b.branch_code AS branchCode,
                b.branch_name AS branchName,
                d.department_name AS departmentName
             FROM users u
             LEFT JOIN branches b ON b.id = u.branch_id
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.role = 'EMPLOYEE'
             AND u.account_status = 'ACTIVE'
             ${isAdmin ? "AND u.branch_id = ?" : ""}
             AND ${predicates[type]}
             ORDER BY u.full_name ASC`,
            params
        );

        return res.status(200).json({
            success: true,
            data: { type, records },
        });
    } catch (error) {
        console.error("Dashboard drill-down error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard drill-down",
        });
    }
};

const getSuperAdminDashboard = async (req, res) => {
    try {
        const [
            [branchResult],
            [adminResult],
            [employeeResult],
            [presentResult],
            [lateResult],
            [leaveResult],
            [absentResult],
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
                SELECT COUNT(DISTINCT ar.user_id) AS total
                FROM attendance_records ar
                INNER JOIN users u ON u.id = ar.user_id
                WHERE ar.attendance_date = CURDATE()
                AND ar.check_in_time IS NOT NULL
                AND u.role = 'EMPLOYEE'
                AND u.account_status = 'ACTIVE'
            `),

            db.query(`
                SELECT COUNT(DISTINCT ar.user_id) AS total
                FROM attendance_records ar
                INNER JOIN users u ON u.id = ar.user_id
                WHERE ar.attendance_date = CURDATE()
                AND ar.is_late = 1
                AND u.role = 'EMPLOYEE'
                AND u.account_status = 'ACTIVE'
            `),

            db.query(`
                SELECT COUNT(DISTINCT l.user_id) AS total
                FROM leaves l
                INNER JOIN users u ON u.id = l.user_id
                WHERE CURDATE() BETWEEN l.from_date AND l.to_date
                AND l.status = 'APPROVED'
                AND u.role = 'EMPLOYEE'
                AND u.account_status = 'ACTIVE'
            `),

            db.query(`
                SELECT COUNT(*) AS total
                FROM users u
                WHERE u.role = 'EMPLOYEE'
                AND u.account_status = 'ACTIVE'
                AND NOT EXISTS (
                    SELECT 1
                    FROM attendance_records ar
                    WHERE ar.user_id = u.id
                    AND ar.attendance_date = CURDATE()
                    AND ar.check_in_time IS NOT NULL
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM leaves l
                    WHERE l.user_id = u.id
                    AND CURDATE() BETWEEN l.from_date AND l.to_date
                    AND l.status = 'APPROVED'
                )
            `),
        ]);

        const totalBranches = Number(branchResult[0]?.total || 0);
        const totalAdmins = Number(adminResult[0]?.total || 0);
        const totalEmployees = Number(employeeResult[0]?.total || 0);
        const presentToday = Number(presentResult[0]?.total || 0);
        const lateToday = Number(lateResult[0]?.total || 0);
        const leaveToday = Number(leaveResult[0]?.total || 0);
        const absentToday = Number(absentResult[0]?.total || 0);
        const analytics = await getDashboardAnalytics();

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
                analytics,
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
            [absentResult],
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

            db.query(
                `
                    SELECT COUNT(*) AS total
                    FROM users u
                    WHERE u.role = 'EMPLOYEE'
                    AND u.account_status = 'ACTIVE'
                    AND u.branch_id = ?
                    AND NOT EXISTS (
                        SELECT 1
                        FROM attendance_records ar
                        WHERE ar.user_id = u.id
                        AND ar.attendance_date = CURDATE()
                        AND ar.check_in_time IS NOT NULL
                    )
                    AND NOT EXISTS (
                        SELECT 1
                        FROM leaves l
                        WHERE l.user_id = u.id
                        AND CURDATE() BETWEEN l.from_date AND l.to_date
                        AND l.status = 'APPROVED'
                    )
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
            : Number(absentResult[0]?.total || 0);
        const analytics = await getDashboardAnalytics(branchId);

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
                analytics,
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
    getDashboardDrilldown,
};

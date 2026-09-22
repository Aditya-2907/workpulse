const path = require("path");

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    console.log(`PASS: ${message}`);
};

const responseCapture = () => {
    const response = { statusCode: 200, body: null };
    response.status = (statusCode) => { response.statusCode = statusCode; return response; };
    response.json = (body) => { response.body = body; return response; };
    return response;
};

const run = async () => {
    const dbPath = require.resolve("../src/config/db");
    const queries = [];
    let committed = false;
    const connection = {
        beginTransaction: async () => {},
        rollback: async () => {},
        commit: async () => { committed = true; },
        release: () => {},
        query: async (sql, params = []) => {
            queries.push({ sql, params });
            if (sql.includes("SELECT id FROM branches")) return [[{ id: 1 }]];
            if (sql.includes("SELECT id FROM departments")) return [[{ id: 2 }]];
            if (sql.includes("FROM admin_approval_requests") && sql.includes("FOR UPDATE")) return [[{ id: 7, admin_user_id: 42, status: "PENDING" }]];
            if (sql.includes("WHERE id = ?") && sql.includes("role = 'ADMIN'")) return [[{ id: 42, account_status: "PENDING_APPROVAL" }]];
            if (sql.includes("FROM users WHERE id = ?")) return [[{
                id: 42,
                employeeCode: "ADM042",
                fullName: "Approval Test",
                qualification: "Graduate",
                computerSkill: 1,
                dutyStartTime: "09:00:00",
                dutyEndTime: "18:00:00",
            }]];
            return [[]];
        },
    };

    require.cache[dbPath] = {
        id: dbPath,
        filename: path.join(__dirname, "..", "src", "config", "db.js"),
        loaded: true,
        exports: { getConnection: async () => connection },
    };

    const { reviewAdminApprovalRequest } = require("../src/controllers/adminApprovalController");

    const invalidResponse = responseCapture();
    await reviewAdminApprovalRequest({ params: { id: "7" }, body: { action: "APPROVE", temporaryPassword: "temporary-password" }, user: { id: 1 } }, invalidResponse);
    assert(invalidResponse.statusCode === 400, "approval rejects missing assignment fields before mutation");

    const response = responseCapture();
    await reviewAdminApprovalRequest({
        params: { id: "7" },
        user: { id: 1 },
        body: {
            action: "APPROVE",
            temporaryPassword: "temporary-password",
            branchId: 1,
            departmentId: 2,
            designation: "Manager",
            qualification: "Graduate",
            dutyStartTime: "09:00",
            dutyEndTime: "18:00",
            computerSkill: true,
            joiningDate: "2026-09-23",
        },
    }, response);

    const userUpdate = queries.find((query) => query.sql.includes("UPDATE users"));
    assert(userUpdate?.sql.includes("qualification = CASE") && userUpdate.sql.includes("computer_skill = CASE") && userUpdate.sql.includes("duty_start_time = CASE") && userUpdate.sql.includes("duty_end_time = CASE"), "approval update persists all four assignment fields");
    assert(userUpdate.params.includes("Graduate") && userUpdate.params.includes(true) && userUpdate.params.includes("09:00") && userUpdate.params.includes("18:00"), "approval update receives the expected field values");
    assert(committed && response.statusCode === 200 && response.body?.admin?.qualification === "Graduate", "approved Admin response returns persisted assignment data after commit");
};

run().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
});

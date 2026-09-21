require("dotenv").config({ quiet: true });
const db = require("../src/config/db");

const run = async () => {
    try {
        const [rows] = await db.query(
            `SELECT 'BRANCH' AS recordType, id, branch_code AS code, branch_name AS label FROM branches WHERE branch_code LIKE 'QA%' OR branch_name LIKE '%test%'
             UNION ALL SELECT 'DEPARTMENT', id, department_code, department_name FROM departments WHERE department_code LIKE 'QA%' OR department_name LIKE '%test%'
             UNION ALL SELECT 'USER', id, employee_code, full_name FROM users WHERE employee_code LIKE 'QA%' OR full_name LIKE '%test%' OR email LIKE '%@example.%'
             ORDER BY recordType, id`
        );
        console.log("DRY RUN ONLY: candidate data requires human review; this script never deletes records.");
        console.log(JSON.stringify(rows.map((row) => ({ recordType: row.recordType, id: row.id, code: row.code, label: row.label })), null, 2));
    } finally { await db.end(); }
};
run().catch((error) => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });

const ExcelJS = require("exceljs");

const apiBase = process.env.REPORT_TEST_API_BASE || "http://localhost:5000/api";
const token = process.env.REPORT_TEST_TOKEN || "";
const startDate = process.env.REPORT_TEST_START_DATE || "2026-09-12";
const endDate = process.env.REPORT_TEST_END_DATE || "2026-09-13";
const results = [];

const record = (id, expected, actual, passed, detail = "") => {
    const result = passed ? "PASS" : expected === "NOT RUN" ? "NOT RUN" : "FAIL";
    results.push({ id, result, expected, actual, detail });
};

const request = async (path, authenticated = true) => {
    const headers = authenticated && token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${apiBase}${path}`, { headers });
    let data = null;
    if ((response.headers.get("content-type") || "").includes("json")) data = await response.json();
    return { response, data };
};

const query = (filters = {}) => {
    const params = new URLSearchParams({ startDate, endDate });
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") params.set(key, value);
    });
    return `?${params.toString()}`;
};

(async () => {
    try {
        const unauthJson = await request(`/reports/attendance${query()}`, false);
        record("AUTH-JSON", 401, unauthJson.response.status, unauthJson.response.status === 401);
        const unauthExcel = await request(`/reports/attendance/excel${query()}`, false);
        record("AUTH-EXCEL", 401, unauthExcel.response.status, unauthExcel.response.status === 401);
        const unauthPdf = await request(`/reports/attendance/pdf${query()}`, false);
        record("AUTH-PDF", 401, unauthPdf.response.status, unauthPdf.response.status === 401);

        if (!token) {
            ["BASE", "STATUS", "ADVANCED", "COMBINATIONS", "EXPORTS", "ADMIN-SECURITY"].forEach((id) => record(id, "NOT RUN", "REPORT_TEST_TOKEN not supplied", false));
        } else {
            const base = await request(`/reports/attendance${query()}`);
            const baseRows = base.data?.attendanceRecords || [];
            record("BASE", 200, base.response.status, base.response.status === 200 && base.data?.summary?.totalRecords === baseRows.length);

            for (const status of ["FULL_DAY", "PARTIAL_DAY", "INSUFFICIENT_ATTENDANCE", "ABSENT", "LEAVE", "HOLIDAY", "INCOMPLETE", "PENDING"]) {
                const result = await request(`/reports/attendance${query({ status })}`);
                const rows = result.data?.attendanceRecords || [];
                if (result.response.status !== 200) record(`STATUS-${status}`, 200, result.response.status, false);
                else if (!rows.length) record(`STATUS-${status}`, "NOT RUN", "No matching fixture", false);
                else record(`STATUS-${status}`, "all rows match status", `${rows.length} row(s)`, rows.every((row) => row.attendanceStatus === status) && result.data.summary.totalRecords === rows.length);
            }

            const advancedResult = await request(`/reports/attendance${query({ role: "EMPLOYEE", late: "LATE", minAttendancePercent: 0, maxAttendancePercent: 100, minWorkedMinutes: 0, checkInFrom: "00:00", checkInTo: "23:59" })}`);
            const advancedRows = advancedResult.data?.attendanceRecords || [];
            record("ADVANCED", 200, advancedResult.response.status, advancedResult.response.status === 200 && advancedResult.data.summary.totalRecords === advancedRows.length);

            const combinedResult = await request(`/reports/attendance${query({ status: "INSUFFICIENT_ATTENDANCE", late: "LATE", early: "EARLY" })}`);
            const combinedRows = combinedResult.data?.attendanceRecords || [];
            record("COMBINED", 200, combinedResult.response.status, combinedResult.response.status === 200 && combinedResult.data.summary.totalRecords === combinedRows.length && combinedRows.every((row) => row.attendanceStatus === "INSUFFICIENT_ATTENDANCE" && row.isLate === true && row.isEarlyDeparture === true));

            for (const [id, filters] of [["INVALID-PERCENT", { minAttendancePercent: 90, maxAttendancePercent: 10 }], ["INVALID-WORKED", { minWorkedMinutes: 10, maxWorkedMinutes: 1 }], ["INVALID-TIME", { checkInFrom: "25:00" }], ["INVALID-ROLE", { role: "SUPER_ADMIN" }]]) {
                const invalid = await request(`/reports/attendance${query(filters)}`);
                record(id, 400, invalid.response.status, invalid.response.status === 400);
            }

            for (const [id, filters] of [["INVALID-STATUS", { status: "NOT_A_STATUS" }], ["INVALID-BRANCH", { branchId: "abc" }], ["INVALID-DEPARTMENT", { departmentId: "abc" }], ["INVALID-EMPLOYEE", { employeeId: "abc" }]]) {
                const invalid = await request(`/reports/attendance${query(filters)}`);
                record(id, 400, invalid.response.status, invalid.response.status === 400);
            }

            const excelResponse = await fetch(`${apiBase}/reports/attendance/excel${query({ late: "LATE" })}`, { headers: { Authorization: `Bearer ${token}` } });
            const excelBuffer = Buffer.from(await excelResponse.arrayBuffer());
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(excelBuffer);
            const dataSheet = workbook.getWorksheet("Attendance Data");
            record("EXCEL", 200, excelResponse.status, excelResponse.status === 200 && Boolean(dataSheet) && dataSheet.views?.[0]?.ySplit === 1);

            const pdfResponse = await fetch(`${apiBase}/reports/attendance/pdf${query({ late: "LATE" })}`, { headers: { Authorization: `Bearer ${token}` } });
            const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
            record("PDF", 200, pdfResponse.status, pdfResponse.status === 200 && (pdfResponse.headers.get("content-type") || "").includes("application/pdf") && pdfBuffer.subarray(0, 5).toString() === "%PDF-");
            record("ADMIN-SECURITY", "NOT RUN", "Requires REPORT_TEST_ADMIN_TOKEN run", false);
        }
    } catch (error) {
        record("RUNNER", "no uncaught error", error.message, false);
    }

    results.forEach((result) => console.log(`${result.result.padEnd(7)} ${result.id} ${result.detail || ""}`));
    if (results.some((result) => result.result === "FAIL")) process.exitCode = 1;
})();

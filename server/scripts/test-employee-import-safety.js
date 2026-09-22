require("dotenv").config({ quiet: true });

const ExcelJS = require("exceljs");
const fs = require("fs");
const db = require("../src/config/db");
const { previewImport, confirmImport } = require("../src/controllers/employeeImportController");

const HEADERS = ["Name", "Employee Code", "Phone", "Email", "Branch Code", "Department Code", "Designation", "Duty Start", "Duty End", "Joining Date", "DOB", "Gender", "Address", "Pincode", "Qualification", "Computer Skill", "Aadhaar", "PAN", "Status"];

const responseCapture = () => {
    const response = { statusCode: 200, body: null };
    response.status = (statusCode) => { response.statusCode = statusCode; return response; };
    response.json = (body) => { response.body = body; return response; };
    return response;
};

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    console.log(`PASS: ${message}`);
};

const main = async () => {
    const uploadMiddleware = fs.readFileSync(require.resolve("../src/middleware/importUploadMiddleware"), "utf8");
    assert(/\\\.xlsx\$\/i/.test(uploadMiddleware) && !/xlsx\|xls/.test(uploadMiddleware), "upload middleware intentionally accepts only .xlsx workbooks");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Employees");
    sheet.addRow(HEADERS);
    sheet.addRow([
        "Validation Only", "", "9000000009", "", "BR001", "DP001", "Associate",
        "25:99", "18:00", "2026-02-30", "", "PREFER_NOT_TO_SAY", "", "", "", "No",
        "123456789012", "", "ACTIVE",
    ]);

    const previewResponse = responseCapture();
    await previewImport({ file: { buffer: Buffer.from(await workbook.xlsx.writeBuffer()) } }, previewResponse);
    assert(previewResponse.statusCode === 200 && previewResponse.body?.success, "invalid workbook produces a safe preview response");
    assert(previewResponse.body.canImport === false, "invalid workbook cannot be imported");
    assert(previewResponse.body.invalidRows?.[0]?.errors?.some((error) => /valid HH:MM|valid YYYY-MM-DD/.test(error)), "invalid time and calendar date are reported");

    const confirmResponse = responseCapture();
    await confirmImport({ body: { previewToken: previewResponse.body.previewToken }, user: { id: 1 } }, confirmResponse);
    assert(confirmResponse.statusCode === 409, "crafted confirmation cannot import a partially valid preview");
};

main()
    .catch((error) => {
        console.error(`FAIL: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.end();
    });

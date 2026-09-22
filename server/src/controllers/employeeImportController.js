const crypto = require("crypto");
const ExcelJS = require("exceljs");
const db = require("../config/db");
const generateEmployeeCode = require("../utils/generateEmployeeCode");
const { writeAuditLog } = require("../services/auditService");

const previews = new Map();
const HEADERS = ["Name", "Employee Code", "Phone", "Email", "Branch Code", "Department Code", "Designation", "Duty Start", "Duty End", "Joining Date", "DOB", "Gender", "Address", "Pincode", "Qualification", "Computer Skill", "Aadhaar", "PAN", "Status"];
const INVALID_DATE = "__INVALID_DATE__";
const dateText = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const text = String(value || "").trim();
    if (!text) return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return INVALID_DATE;
    const [year, month, day] = text.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? text : INVALID_DATE;
};
const cellText = (row, index) => String(row.getCell(index).text || row.getCell(index).value || "").trim();
const mask = (value) => value ? `••••${String(value).slice(-4)}` : "";

const downloadTemplate = async (_req, res) => {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Employees");
    sheet.addRow(HEADERS); sheet.addRow(["Example Employee", "", "9000000000", "employee@example.com", "BR001", "DP001", "Associate", "09:00", "18:00", "2026-09-22", "1995-01-01", "PREFER_NOT_TO_SAY", "Address", "110001", "Graduate", "Yes", "123456789012", "ABCDE1234F", "ACTIVE"]);
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.columns.forEach((column) => { column.width = 20; });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition", "attachment; filename=WorkPulse_Employee_Import_Template.xlsx");
    await workbook.xlsx.write(res); res.end();
};

const previewImport = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Upload an Excel .xlsx file." });
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(req.file.buffer); const sheet = workbook.worksheets[0];
        if (!sheet || sheet.rowCount < 2) return res.status(400).json({ success: false, message: "The workbook has no employee rows." });
        const actualHeaders = sheet.getRow(1).values.slice(1).map((item) => String(item || "").trim());
        if (HEADERS.some((header, index) => actualHeaders[index] !== header)) return res.status(400).json({ success: false, message: "Use the current WorkPulse employee import template headers." });
        const [branches] = await db.query("SELECT id, branch_code AS branchCode FROM branches WHERE status = 'ACTIVE'");
        const [departments] = await db.query("SELECT id, department_code AS departmentCode FROM departments WHERE status = 'ACTIVE'");
        const branchMap = new Map(branches.map((item) => [item.branchCode.toUpperCase(), item.id])); const departmentMap = new Map(departments.map((item) => [item.departmentCode.toUpperCase(), item.id]));
        const sourceRows = []; const phones = new Set(); const emails = new Set(); const aadhaars = new Set();
        for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
            const row = sheet.getRow(rowIndex); if (!row.values.some((value) => value !== null && value !== undefined && String(value).trim())) continue;
            const raw = Object.fromEntries(HEADERS.map((header, index) => [header, index === 9 || index === 10 ? dateText(row.getCell(index + 1).value) : cellText(row, index + 1)]));
            const rowErrors = [];
            ["Name", "Phone", "Branch Code", "Department Code", "Designation", "Duty Start", "Duty End", "Joining Date", "Aadhaar"].forEach((field) => { if (!raw[field]) rowErrors.push(`${field} is required`); });
            if (raw["Employee Code"]) rowErrors.push("Employee Code must be blank; WorkPulse generates it safely.");
            if (!/^\d{10,20}$/.test(raw.Phone || "")) rowErrors.push("Phone must contain 10–20 digits");
            if (raw.Email && !/^\S+@\S+\.\S+$/.test(raw.Email)) rowErrors.push("Email is invalid");
            if (!branchMap.has(raw["Branch Code"].toUpperCase())) rowErrors.push("Unknown active Branch Code");
            if (!departmentMap.has(raw["Department Code"].toUpperCase())) rowErrors.push("Unknown active Department Code");
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw["Duty Start"] || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw["Duty End"] || "")) rowErrors.push("Duty time must use valid HH:MM values");
            if (!raw["Joining Date"] || raw["Joining Date"] === INVALID_DATE || raw.DOB === INVALID_DATE) rowErrors.push("Dates must use valid YYYY-MM-DD values");
            if (raw.Gender && !["FEMALE", "MALE", "NON_BINARY", "PREFER_NOT_TO_SAY"].includes(raw.Gender)) rowErrors.push("Gender is invalid");
            if (raw.Status && raw.Status !== "ACTIVE") rowErrors.push("Only ACTIVE imports are supported");
            if (phones.has(raw.Phone)) rowErrors.push("Duplicate phone inside file"); phones.add(raw.Phone);
            if (raw.Email && emails.has(raw.Email.toLowerCase())) rowErrors.push("Duplicate email inside file"); if (raw.Email) emails.add(raw.Email.toLowerCase());
            if (aadhaars.has(raw.Aadhaar)) rowErrors.push("Duplicate Aadhaar inside file"); aadhaars.add(raw.Aadhaar);
            sourceRows.push({ rowIndex, raw, errors: rowErrors });
        }
        const uniquePhones = sourceRows.map((item) => item.raw.Phone).filter(Boolean); const uniqueEmails = sourceRows.map((item) => item.raw.Email).filter(Boolean); const uniqueAadhaars = sourceRows.map((item) => item.raw.Aadhaar).filter(Boolean);
        if (uniquePhones.length || uniqueEmails.length || uniqueAadhaars.length) { const [existing] = await db.query(`SELECT phone, email, aadhaar_number AS aadhaarNumber FROM users WHERE phone IN (${uniquePhones.map(() => "?").join(",") || "NULL"}) OR email IN (${uniqueEmails.map(() => "?").join(",") || "NULL"}) OR aadhaar_number IN (${uniqueAadhaars.map(() => "?").join(",") || "NULL"})`, [...uniquePhones, ...uniqueEmails, ...uniqueAadhaars]); const existingPhones = new Set(existing.map((item) => item.phone)); const existingEmails = new Set(existing.map((item) => String(item.email || "").toLowerCase())); const existingAadhaar = new Set(existing.map((item) => item.aadhaarNumber)); sourceRows.forEach((item) => { if (existingPhones.has(item.raw.Phone)) item.errors.push("Phone already exists"); if (item.raw.Email && existingEmails.has(item.raw.Email.toLowerCase())) item.errors.push("Email already exists"); if (existingAadhaar.has(item.raw.Aadhaar)) item.errors.push("Aadhaar already exists"); }); }
        const validRows = sourceRows.filter((item) => !item.errors.length); const canImport = sourceRows.length > 0 && validRows.length === sourceRows.length; const token = crypto.randomBytes(24).toString("base64url"); previews.set(token, { expiresAt: Date.now() + 15 * 60 * 1000, canImport, rows: validRows.map((item) => ({ ...item.raw, dateOfBirth: item.raw.DOB || null, branchId: branchMap.get(item.raw["Branch Code"].toUpperCase()), departmentId: departmentMap.get(item.raw["Department Code"].toUpperCase()) })) });
        return res.json({ success: true, previewToken: token, validRows: validRows.map((item) => ({ row: item.rowIndex, name: item.raw.Name, phone: item.raw.Phone, email: item.raw.Email, branchCode: item.raw["Branch Code"], departmentCode: item.raw["Department Code"], aadhaar: mask(item.raw.Aadhaar), pan: mask(item.raw.PAN) })), invalidRows: sourceRows.filter((item) => item.errors.length).map((item) => ({ row: item.rowIndex, name: item.raw.Name, errors: item.errors })), canImport });
    } catch (error) {
        console.error("EMPLOYEE IMPORT PREVIEW ERROR:", error);
        return res.status(400).json({
            success: false,
            message: "Unable to parse the employee import workbook.",
            debugError: error.message,
            debugCode: error.code || null
        });
    }
};

const confirmImport = async (req, res) => {
    const preview = previews.get(String(req.body.previewToken || ""));
    if (!preview || preview.expiresAt < Date.now()) return res.status(409).json({ success: false, message: "Import preview expired. Upload and validate the workbook again." });
    if (!preview.canImport) return res.status(409).json({ success: false, message: "Fix every invalid row and generate a fully valid preview before importing." });
    const connection = await db.getConnection();
    try { await connection.beginTransaction(); for (const row of preview.rows) { const employeeCode = await generateEmployeeCode(connection, "EMPLOYEE"); await connection.query(`INSERT INTO users (employee_code, full_name, date_of_birth, gender, phone, email, password_hash, role, account_status, branch_id, department_id, designation, address, pincode, qualification, computer_skill, aadhaar_number, pan_number, duty_start_time, duty_end_time, joining_date, created_by) VALUES (?, ?, ?, ?, ?, ?, NULL, 'EMPLOYEE', 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [employeeCode, row.Name, row.dateOfBirth, row.Gender || null, row.Phone, row.Email || null, row.branchId, row.departmentId, row.Designation, row.Address || null, row.Pincode || null, row.Qualification || null, /^(yes|true|1)$/i.test(row["Computer Skill"]), row.Aadhaar, row.PAN || null, row["Duty Start"], row["Duty End"], row["Joining Date"], req.user.id]); }
        await writeAuditLog(connection, { actorId: req.user.id, action: "EMPLOYEE_BULK_IMPORT_COMPLETED", entityType: "EMPLOYEE_IMPORT", newData: { importedCount: preview.rows.length }, req }); await connection.commit(); previews.delete(String(req.body.previewToken)); return res.status(201).json({ success: true, message: `${preview.rows.length} employee records imported.`, importedCount: preview.rows.length });
    } catch (error) { await connection.rollback(); return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ success: false, message: error.code === "ER_DUP_ENTRY" ? "Import stopped because a duplicate was detected. Re-preview the workbook." : "Employee import failed; no rows were added." }); } finally { connection.release(); }
};
module.exports = { downloadTemplate, previewImport, confirmImport };

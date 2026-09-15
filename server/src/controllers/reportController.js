const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const { getManagementAttendance } = require("./attendanceController");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ALLOWED_ROLES = ["EMPLOYEE", "ADMIN"];
const ALLOWED_LATE = ["LATE", "NOT_LATE"];
const ALLOWED_EARLY = ["EARLY", "NOT_EARLY"];

const isValidDate = (value) => {
    if (!DATE_PATTERN.test(value || "")) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const optionalNumber = (value) => {
    if (value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
};

const validateAdvancedFilters = (req, res, next) => {
    const { role, late, early, minAttendancePercent, maxAttendancePercent, minWorkedMinutes, maxWorkedMinutes, checkInFrom, checkInTo } = req.query;
    if (role && !ALLOWED_ROLES.includes(role)) return res.status(400).json({ success: false, message: "Invalid report role filter" });
    if (late && !ALLOWED_LATE.includes(late)) return res.status(400).json({ success: false, message: "Invalid late filter" });
    if (early && !ALLOWED_EARLY.includes(early)) return res.status(400).json({ success: false, message: "Invalid early-departure filter" });

    const minPercent = optionalNumber(minAttendancePercent);
    const maxPercent = optionalNumber(maxAttendancePercent);
    if (Number.isNaN(minPercent) || Number.isNaN(maxPercent) || (minPercent !== null && (minPercent < 0 || minPercent > 100)) || (maxPercent !== null && (maxPercent < 0 || maxPercent > 100)) || (minPercent !== null && maxPercent !== null && minPercent > maxPercent)) {
        return res.status(400).json({ success: false, message: "Attendance percentage range must be between 0 and 100, with minimum no greater than maximum" });
    }

    const minWorked = optionalNumber(minWorkedMinutes);
    const maxWorked = optionalNumber(maxWorkedMinutes);
    if (Number.isNaN(minWorked) || Number.isNaN(maxWorked) || (minWorked !== null && (!Number.isInteger(minWorked) || minWorked < 0)) || (maxWorked !== null && (!Number.isInteger(maxWorked) || maxWorked < 0)) || (minWorked !== null && maxWorked !== null && minWorked > maxWorked)) {
        return res.status(400).json({ success: false, message: "Worked-minute range must be non-negative, with minimum no greater than maximum" });
    }

    if ((checkInFrom && !TIME_PATTERN.test(checkInFrom)) || (checkInTo && !TIME_PATTERN.test(checkInTo))) return res.status(400).json({ success: false, message: "Check-in time filters must use HH:mm format" });
    if (checkInFrom && checkInTo && checkInFrom > checkInTo) return res.status(400).json({ success: false, message: "Check-in start time cannot be after end time" });
    if (req.query.searchEmployee && String(req.query.searchEmployee).length > 100) return res.status(400).json({ success: false, message: "Employee search is too long" });
    return next();
};

const requireReportDates = (req, res, next) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ success: false, message: "startDate and endDate are required for reports" });
    if (!isValidDate(startDate) || !isValidDate(endDate)) return res.status(400).json({ success: false, message: "startDate and endDate must be valid YYYY-MM-DD dates" });
    if (startDate > endDate) return res.status(400).json({ success: false, message: "startDate cannot be after endDate" });
    return validateAdvancedFilters(req, res, next);
};

const normalizeTimeOnly = (value) => {
    if (!value) return null;
    if (typeof value === "string") {
        const match = value.match(/(?:^|[T\s])(\d{2}:\d{2})(?::\d{2})?/);
        return match ? match[1] : null;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
    return null;
};

const timeToMinutes = (value) => {
    const normalized = normalizeTimeOnly(value);
    if (!normalized) return null;
    const [hours, minutes] = normalized.split(":").map(Number);
    return hours * 60 + minutes;
};

const buildSummary = (records) => ({
    totalRecords: records.length,
    fullDay: records.filter((record) => record.attendanceStatus === "FULL_DAY").length,
    partialDay: records.filter((record) => record.attendanceStatus === "PARTIAL_DAY").length,
    insufficientAttendance: records.filter((record) => record.attendanceStatus === "INSUFFICIENT_ATTENDANCE").length,
    pending: records.filter((record) => record.attendanceStatus === "PENDING").length,
    incomplete: records.filter((record) => record.attendanceStatus === "INCOMPLETE").length,
    absent: records.filter((record) => record.attendanceStatus === "ABSENT").length,
    leave: records.filter((record) => record.attendanceStatus === "LEAVE").length,
    holiday: records.filter((record) => record.attendanceStatus === "HOLIDAY").length,
    late: records.filter((record) => record.isLate === true).length,
    earlyDeparture: records.filter((record) => record.isEarlyDeparture === true).length,
});

const normalizeReportResponse = (body) => {
    if (!body?.success) return body;
    return {
        ...body,
        attendanceRecords: (body.attendanceRecords || []).map((record) => {
            const { checkInTimeLocal, checkOutTimeLocal, ...safeRecord } = record;
            return { ...safeRecord, checkInTime: normalizeTimeOnly(checkInTimeLocal || record.checkInTime), checkOutTime: normalizeTimeOnly(checkOutTimeLocal || record.checkOutTime) };
        }),
    };
};

const applyAdvancedFilters = (body, query) => {
    if (!body?.success) return body;
    const { role, late, early, minAttendancePercent, maxAttendancePercent, minWorkedMinutes, maxWorkedMinutes, checkInFrom, checkInTo, searchEmployee } = query;
    const minPercent = optionalNumber(minAttendancePercent);
    const maxPercent = optionalNumber(maxAttendancePercent);
    const minWorked = optionalNumber(minWorkedMinutes);
    const maxWorked = optionalNumber(maxWorkedMinutes);
    const fromMinutes = timeToMinutes(checkInFrom);
    const toMinutes = timeToMinutes(checkInTo);
    const search = String(searchEmployee || "").trim().toLowerCase();

    const records = (body.attendanceRecords || []).filter((record) => {
        if (role && record.role !== role) return false;
        if (late === "LATE" && record.isLate !== true) return false;
        if (late === "NOT_LATE" && record.isLate === true) return false;
        if (early === "EARLY" && record.isEarlyDeparture !== true) return false;
        if (early === "NOT_EARLY" && record.isEarlyDeparture === true) return false;
        const percentage = record.attendancePercentage === null || record.attendancePercentage === undefined ? null : Number(record.attendancePercentage);
        if (minPercent !== null && (percentage === null || percentage < minPercent)) return false;
        if (maxPercent !== null && (percentage === null || percentage > maxPercent)) return false;
        const worked = record.workedMinutes === null || record.workedMinutes === undefined ? null : Number(record.workedMinutes);
        if (minWorked !== null && (worked === null || worked < minWorked)) return false;
        if (maxWorked !== null && (worked === null || worked > maxWorked)) return false;
        const checkInMinutes = timeToMinutes(record.checkInTime);
        if (fromMinutes !== null && (checkInMinutes === null || checkInMinutes < fromMinutes)) return false;
        if (toMinutes !== null && (checkInMinutes === null || checkInMinutes > toMinutes)) return false;
        if (search) {
            const code = String(record.employeeCode || "").toLowerCase();
            const name = String(record.fullName || "").toLowerCase();
            if (!code.includes(search) && !name.includes(search)) return false;
        }
        return true;
    });

    return {
        ...body,
        filters: {
            ...(body.filters || {}), role: role || null, late: late || null, early: early || null,
            minAttendancePercent: minPercent, maxAttendancePercent: maxPercent,
            minWorkedMinutes: minWorked, maxWorkedMinutes: maxWorked,
            checkInFrom: checkInFrom || null, checkInTo: checkInTo || null, searchEmployee: searchEmployee || null,
        },
        summary: buildSummary(records),
        attendanceRecords: records,
    };
};

const captureManagementResponse = async (req) => {
    let statusCode = 200;
    let body = null;
    const captureResponse = {
        status(code) { statusCode = code; return this; },
        json(value) { body = value; return this; },
    };
    await getManagementAttendance(req, captureResponse);
    return { statusCode, body };
};

const getAttendanceReport = async (req, res) => {
    const { statusCode, body } = await captureManagementResponse(req);
    return res.status(statusCode).json(applyAdvancedFilters(normalizeReportResponse(body), req.query));
};

const captureAttendanceReport = async (req) => {
    const { statusCode, body } = await captureManagementResponse(req);
    return { statusCode, body: applyAdvancedFilters(normalizeReportResponse(body), req.query) };
};

const asDisplayValue = (value, fallback = "--") => value === null || value === undefined || value === "" ? fallback : value;
const formatMinutes = (minutes) => {
    if (minutes === null || minutes === undefined || minutes === "") return "--";
    const numericMinutes = Number(minutes);
    return Number.isFinite(numericMinutes) ? `${Math.floor(numericMinutes / 60)}h ${numericMinutes % 60}m` : "--";
};
const formatTime = (value) => normalizeTimeOnly(value) || "--";

const formatGeneratedAt = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-IN", { timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).formatToParts(value).reduce((result, part) => { result[part.type] = part.value; return result; }, {});
    return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute} ${String(parts.dayPeriod || "").toUpperCase()}`;
};

const sanitizeFilenamePart = (value) => String(value || "").replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 50);
const buildReportFilename = (filters, records, extension) => {
    const branchPart = filters.branchId ? records.find((record) => record.branchCode)?.branchCode : "";
    const branchSuffix = branchPart ? `_${sanitizeFilenamePart(branchPart)}` : "";
    return `WorkPulse_Attendance_Report${branchSuffix}_${filters.startDate}_to_${filters.endDate}.${extension}`;
};

const REPORT_HEADERS = ["Date", "Employee Code", "Employee Name", "Role", "Branch", "Department", "Designation", "Duty Start", "Duty End", "Check In", "Check Out", "Worked Time", "Attendance %", "Status", "Late", "Early Departure", "Remarks"];
const reportRows = (records) => records.map((record) => [
    asDisplayValue(record.attendanceDate), asDisplayValue(record.employeeCode), asDisplayValue(record.fullName), asDisplayValue(record.role), asDisplayValue(record.branchName), asDisplayValue(record.departmentName), asDisplayValue(record.designation), formatTime(record.dutyStartTime), formatTime(record.dutyEndTime), formatTime(record.checkInTime), formatTime(record.checkOutTime), formatMinutes(record.workedMinutes), record.attendancePercentage === null || record.attendancePercentage === undefined ? "--" : `${Number(record.attendancePercentage).toFixed(2)}%`, asDisplayValue(record.attendanceStatus), record.isLate ? "Yes" : "No", record.isEarlyDeparture ? "Yes" : "No", asDisplayValue(record.checkOutRemarks || record.checkInRemarks || record.leaveReason || record.holidayPurpose),
]);

const metadataRows = (filters) => [
    ["Generated At", formatGeneratedAt()], ["Date Range", `${filters.startDate} to ${filters.endDate}`], ["Branch", filters.branchId || "All Branches"], ["Department", filters.departmentId || "All Departments"], ["Employee", filters.employeeId || "All Employees"], ["Status", filters.status || "All Statuses"], ["Role", filters.role || "All Roles"], ["Late", filters.late || "All"], ["Early Departure", filters.early || "All"], ["Attendance %", filters.minAttendancePercent === null && filters.maxAttendancePercent === null ? "All" : `${filters.minAttendancePercent ?? 0} - ${filters.maxAttendancePercent ?? 100}`], ["Worked Minutes", filters.minWorkedMinutes === null && filters.maxWorkedMinutes === null ? "All" : `${filters.minWorkedMinutes ?? 0} - ${filters.maxWorkedMinutes ?? ""}`], ["Check-In Time", filters.checkInFrom || filters.checkInTo ? `${filters.checkInFrom || "00:00"} - ${filters.checkInTo || "23:59"}` : "All"], ["Employee Search", filters.searchEmployee || "All"],
];
const summaryRows = (summary) => [["Total Records", summary.totalRecords || 0], ["Full Day", summary.fullDay || 0], ["Partial Day", summary.partialDay || 0], ["Insufficient Attendance", summary.insufficientAttendance || 0], ["Absent", summary.absent || 0], ["Leave", summary.leave || 0], ["Holiday", summary.holiday || 0], ["Incomplete", summary.incomplete || 0], ["Pending", summary.pending || 0], ["Late", summary.late || 0], ["Early Departure", summary.earlyDeparture || 0]];
const styleExcelHeader = (row) => row.eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3157D5" } }; cell.alignment = { horizontal: "center", vertical: "middle" }; });

const exportAttendanceReportExcel = async (req, res) => {
    try {
        const { statusCode, body } = await captureAttendanceReport(req);
        if (!body?.success) return res.status(statusCode).json(body || { success: false, message: "Failed to generate attendance report" });
        const records = body.attendanceRecords || [];
        const filters = body.filters || {};
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "WorkPulse";
        workbook.created = new Date();
        workbook.modified = new Date();

        const summarySheet = workbook.addWorksheet("Report Summary");
        summarySheet.mergeCells("A1:D1");
        summarySheet.getCell("A1").value = "WorkPulse";
        summarySheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
        summarySheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3157D5" } };
        summarySheet.mergeCells("A2:D2");
        summarySheet.getCell("A2").value = "Attendance Report";
        summarySheet.getCell("A2").font = { bold: true, size: 14 };
        metadataRows(filters).forEach(([label, value], index) => { summarySheet.getCell(`A${4 + index}`).value = label; summarySheet.getCell(`A${4 + index}`).font = { bold: true }; summarySheet.getCell(`B${4 + index}`).value = value; });
        const summaryStart = 19;
        summarySheet.getCell(`A${summaryStart}`).value = "Summary";
        summarySheet.getCell(`A${summaryStart}`).font = { bold: true, size: 12 };
        summaryRows(body.summary || {}).forEach(([label, value], index) => { summarySheet.getCell(`A${summaryStart + 1 + index}`).value = label; summarySheet.getCell(`B${summaryStart + 1 + index}`).value = value; });
        summarySheet.getColumn(1).width = 28;
        summarySheet.getColumn(2).width = 34;
        summarySheet.getColumn(3).width = 18;
        summarySheet.getColumn(4).width = 18;

        const dataSheet = workbook.addWorksheet("Attendance Data");
        dataSheet.views = [{ state: "frozen", ySplit: 1 }];
        dataSheet.addRow(REPORT_HEADERS);
        styleExcelHeader(dataSheet.getRow(1));
        reportRows(records).forEach((row) => dataSheet.addRow(row));
        dataSheet.autoFilter = { from: "A1", to: `Q${Math.max(1, dataSheet.rowCount)}` };
        [14, 16, 24, 14, 22, 20, 20, 12, 12, 12, 12, 16, 15, 24, 10, 18, 28].forEach((width, index) => { dataSheet.getColumn(index + 1).width = width; });
        dataSheet.getRow(1).height = 24;

        const filename = buildReportFilename(filters, records, "xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error("Export attendance report error:", error);
        return res.status(500).json({ success: false, message: "Failed to export attendance report" });
    }
};

const PDF_PAGE_MARGIN = 28;
const PDF_FOOTER_HEIGHT = 24;
const PDF_CONTENT_BOTTOM = (pageHeight) => pageHeight - PDF_PAGE_MARGIN - PDF_FOOTER_HEIGHT;
const PDF_COLORS = { ink: "#192033", muted: "#667085", line: "#d9e0ea", soft: "#f5f7fb", blue: "#3157d5", blueSoft: "#eef2ff" };
const pdfColumns = [
    ["Date", 52, (r) => formatPdfDate(r.attendanceDate)],
    ["Employee", 112, (r) => `${asDisplayValue(r.fullName)}\n${asDisplayValue(r.employeeCode)}${r.designation ? ` • ${r.designation}` : ""}`],
    ["Role", 46, (r) => humanizeReportStatus(r.role)],
    ["Branch", 66, (r) => asDisplayValue(r.branchName)],
    ["Department", 78, (r) => asDisplayValue(r.departmentName)],
    ["Duty", 55, (r) => `${formatTime(r.dutyStartTime)} - ${formatTime(r.dutyEndTime)}`],
    ["Check In", 48, (r) => formatTime(r.checkInTime)],
    ["Check Out", 48, (r) => formatTime(r.checkOutTime)],
    ["Worked", 52, (r) => formatMinutes(r.workedMinutes)],
    ["Attendance", 56, (r) => r.attendancePercentage === null || r.attendancePercentage === undefined ? "--" : `${Number(r.attendancePercentage).toFixed(2)}%`],
    ["Status", 70, (r) => humanizeReportStatus(r.attendanceStatus)],
    ["Late", 34, (r) => r.isLate ? "Yes" : "No"],
    ["Early", 34, (r) => r.isEarlyDeparture ? "Yes" : "No"],
];

const humanizeReportStatus = (value) => {
    const labels = { FULL_DAY: "Full Day", PARTIAL_DAY: "Partial Day", INSUFFICIENT_ATTENDANCE: "Insufficient", INCOMPLETE: "Incomplete", ABSENT: "Absent", LEAVE: "Leave", HOLIDAY: "Holiday", PENDING: "Pending", EMPLOYEE: "Employee", ADMIN: "Admin" };
    return labels[value] || asDisplayValue(value);
};

const formatPdfDate = (value) => {
    if (!value || !DATE_PATTERN.test(String(value))) return "--";
    const [year, month, day] = String(value).split("-");
    const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
    return monthName ? `${day} ${monthName} ${year}` : String(value);
};

const formatPdfGeneratedAt = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-IN", { timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).formatToParts(value).reduce((result, part) => { result[part.type] = part.value; return result; }, {});
    return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ${String(parts.dayPeriod || "").toUpperCase()}`;
};

const pdfFilterRows = (filters, records) => {
    const first = records[0] || {};
    const rows = [["Date Range", `${formatPdfDate(filters.startDate)} - ${formatPdfDate(filters.endDate)}`]];
    if (filters.branchId) rows.push(["Branch", first.branchName || `Branch #${filters.branchId}`]);
    if (filters.departmentId) rows.push(["Department", first.departmentName || `Department #${filters.departmentId}`]);
    if (filters.employeeId) rows.push(["Employee", first.fullName || `Employee #${filters.employeeId}`]);
    if (filters.status) rows.push(["Status", humanizeReportStatus(filters.status)]);
    if (filters.role) rows.push(["Role", humanizeReportStatus(filters.role)]);
    if (filters.late) rows.push(["Late Status", filters.late === "LATE" ? "Late Only" : "Not Late"]);
    if (filters.early) rows.push(["Early Departure", filters.early === "EARLY" ? "Early Only" : "Not Early"]);
    if (filters.minAttendancePercent !== null || filters.maxAttendancePercent !== null) rows.push(["Attendance %", `${filters.minAttendancePercent ?? 0} - ${filters.maxAttendancePercent ?? 100}`]);
    if (filters.minWorkedMinutes !== null || filters.maxWorkedMinutes !== null) rows.push(["Worked Minutes", `${filters.minWorkedMinutes ?? 0} - ${filters.maxWorkedMinutes ?? ""}`]);
    if (filters.checkInFrom || filters.checkInTo) rows.push(["Check-In Time", `${filters.checkInFrom || "00:00"} - ${filters.checkInTo || "23:59"}`]);
    if (filters.searchEmployee) rows.push(["Employee Search", String(filters.searchEmployee).trim()]);
    if (rows.length === 1) rows.push(["Scope", "All branches / departments / employees"]);
    return rows;
};

const drawPdfTableHeader = (doc, y) => {
    let x = PDF_PAGE_MARGIN;
    doc.font("Helvetica-Bold").fontSize(6.4).fillColor("#ffffff");
    pdfColumns.forEach(([title, width]) => { doc.rect(x, y, width, 22).fillAndStroke(PDF_COLORS.blue, PDF_COLORS.blue); doc.fillColor("#ffffff").text(title, x + 3, y + 7, { width: width - 6, height: 9, lineBreak: false }); x += width; });
    return y + 22;
};

const drawPdfFooterSafe = (doc, pageNumber, pageCount, generatedAt) => {
    const y = doc.page.height - PDF_PAGE_MARGIN - PDF_FOOTER_HEIGHT + 5;
    doc.save();
    doc.strokeColor(PDF_COLORS.line).lineWidth(0.7).moveTo(PDF_PAGE_MARGIN, y - 6).lineTo(doc.page.width - PDF_PAGE_MARGIN, y - 6).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(PDF_COLORS.muted).text("WorkPulse  |  Attendance Report", PDF_PAGE_MARGIN, y, { width: 220, lineBreak: false });
    doc.text(`Generated ${generatedAt}`, (doc.page.width - 260) / 2, y, { width: 260, align: "center", lineBreak: false });
    doc.text(`Page ${pageNumber} of ${pageCount}`, doc.page.width - PDF_PAGE_MARGIN - 120, y, { width: 120, align: "right", lineBreak: false });
    doc.restore();
};

const drawPdfContinuationHeaderSafe = (doc) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF_COLORS.ink).text("WorkPulse  |  Attendance Report", PDF_PAGE_MARGIN, PDF_PAGE_MARGIN - 2, { lineBreak: false });
    doc.font("Helvetica").fontSize(7).fillColor(PDF_COLORS.muted).text("Report continuation", PDF_PAGE_MARGIN, PDF_PAGE_MARGIN + 11, { lineBreak: false });
    return drawPdfTableHeader(doc, PDF_PAGE_MARGIN + 28);
};

const drawPdfFirstPage = (doc, filters, summary, records, generatedAt) => {
    const width = doc.page.width - PDF_PAGE_MARGIN * 2;
    doc.fillColor(PDF_COLORS.ink).font("Helvetica-Bold").fontSize(19).text("WorkPulse", PDF_PAGE_MARGIN, PDF_PAGE_MARGIN);
    doc.font("Helvetica").fontSize(8.5).fillColor(PDF_COLORS.muted).text("Employee Attendance & Workforce Management", PDF_PAGE_MARGIN, PDF_PAGE_MARGIN + 24);
    doc.font("Helvetica-Bold").fontSize(15).fillColor(PDF_COLORS.ink).text("ATTENDANCE REPORT", PDF_PAGE_MARGIN, PDF_PAGE_MARGIN + 44);
    const rightX = doc.page.width - PDF_PAGE_MARGIN - 225;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PDF_COLORS.muted).text("REPORT PERIOD", rightX, PDF_PAGE_MARGIN + 4, { width: 225, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.ink).text(`${formatPdfDate(filters.startDate)} - ${formatPdfDate(filters.endDate)}`, rightX, PDF_PAGE_MARGIN + 15, { width: 225, align: "right", lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(PDF_COLORS.muted).text("GENERATED", rightX, PDF_PAGE_MARGIN + 38, { width: 225, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.ink).text(generatedAt, rightX, PDF_PAGE_MARGIN + 49, { width: 225, align: "right", lineBreak: false });
    doc.strokeColor(PDF_COLORS.line).lineWidth(0.8).moveTo(PDF_PAGE_MARGIN, PDF_PAGE_MARGIN + 68).lineTo(doc.page.width - PDF_PAGE_MARGIN, PDF_PAGE_MARGIN + 68).stroke();

    let y = PDF_PAGE_MARGIN + 80;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(PDF_COLORS.ink).text("REPORT FILTERS", PDF_PAGE_MARGIN, y);
    y += 15;
    const filterRows = pdfFilterRows(filters, records);
    const filterColumnWidth = width / 2;
    filterRows.forEach(([label, value], index) => { const column = index % 2; const row = Math.floor(index / 2); const x = PDF_PAGE_MARGIN + column * filterColumnWidth; const rowY = y + row * 14; doc.font("Helvetica-Bold").fontSize(7).fillColor(PDF_COLORS.muted).text(`${label}`, x, rowY, { width: 76, lineBreak: false }); doc.font("Helvetica").fontSize(7.2).fillColor(PDF_COLORS.ink).text(String(value), x + 80, rowY, { width: filterColumnWidth - 84, lineBreak: false }); });
    y += Math.ceil(filterRows.length / 2) * 14 + 13;

    doc.font("Helvetica-Bold").fontSize(8).fillColor(PDF_COLORS.ink).text("SUMMARY", PDF_PAGE_MARGIN, y);
    y += 12;
    const primary = [["Total Records", summary.totalRecords || 0], ["Full Day", summary.fullDay || 0], ["Partial Day", summary.partialDay || 0], ["Insufficient", summary.insufficientAttendance || 0], ["Absent", summary.absent || 0], ["Leave", summary.leave || 0], ["Holiday", summary.holiday || 0], ["Incomplete", summary.incomplete || 0]];
    const gap = 6;
    const cardWidth = (width - gap * (primary.length - 1)) / primary.length;
    primary.forEach(([label, value], index) => { const x = PDF_PAGE_MARGIN + index * (cardWidth + gap); doc.roundedRect(x, y, cardWidth, 38, 4).fillAndStroke(index === 0 ? PDF_COLORS.blueSoft : PDF_COLORS.soft, PDF_COLORS.line); doc.font("Helvetica-Bold").fontSize(15).fillColor(PDF_COLORS.ink).text(String(value), x + 6, y + 6, { width: cardWidth - 12, align: "center", lineBreak: false }); doc.font("Helvetica").fontSize(6.4).fillColor(PDF_COLORS.muted).text(label, x + 4, y + 25, { width: cardWidth - 8, align: "center", lineBreak: false }); });
    y += 48;
    const secondary = [["Late", summary.late || 0], ["Early Departure", summary.earlyDeparture || 0], ["Pending", summary.pending || 0]];
    secondary.forEach(([label, value], index) => { const x = PDF_PAGE_MARGIN + index * 112; doc.font("Helvetica-Bold").fontSize(7).fillColor(PDF_COLORS.muted).text(`${label}:`, x, y, { continued: true, lineBreak: false }); doc.font("Helvetica-Bold").fillColor(PDF_COLORS.ink).text(` ${value}`, { lineBreak: false }); });
    y += 18;
    return drawPdfTableHeader(doc, y);
};

const normalizePdfText = (value) => String(value ?? "--").replace(/\u2022/g, "-");

const exportAttendanceReportPdf = async (req, res) => {
    try {
        const { statusCode, body } = await captureAttendanceReport(req);
        if (!body?.success) return res.status(statusCode).json(body || { success: false, message: "Failed to generate attendance report" });
        const filters = body.filters || {};
        const records = body.attendanceRecords || [];
        const generatedAt = formatPdfGeneratedAt();
        const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: PDF_PAGE_MARGIN, bufferPages: true, info: { Title: "WorkPulse Attendance Report", Author: "WorkPulse" } });
        const filename = buildReportFilename(filters, records, "pdf");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        doc.pipe(res);
        let y = drawPdfFirstPage(doc, filters, body.summary || {}, records, generatedAt);
        if (!records.length) {
            doc.roundedRect(PDF_PAGE_MARGIN, y + 14, doc.page.width - PDF_PAGE_MARGIN * 2, 44, 5).fillAndStroke(PDF_COLORS.soft, PDF_COLORS.line);
            doc.font("Helvetica-Bold").fontSize(10).fillColor(PDF_COLORS.ink).text("No attendance records found", PDF_PAGE_MARGIN + 14, y + 27, { lineBreak: false });
        } else {
            records.forEach((record, index) => {
                const values = pdfColumns.map(([, , valueGetter]) => normalizePdfText(valueGetter(record)));
                doc.font("Helvetica").fontSize(6.7);
                const cellHeights = values.map((value, cellIndex) => doc.heightOfString(value, { width: pdfColumns[cellIndex][1] - 8, font: "Helvetica", fontSize: 6.7, lineGap: 1 }));
                const rowHeight = Math.max(24, Math.ceil(Math.max(...cellHeights)) + 9);
                if (y + rowHeight > PDF_CONTENT_BOTTOM(doc.page.height)) { doc.addPage(); y = drawPdfContinuationHeaderSafe(doc); }
                let x = PDF_PAGE_MARGIN;
                values.forEach((value, cellIndex) => { const [, cellWidth] = pdfColumns[cellIndex]; doc.rect(x, y, cellWidth, rowHeight).fillAndStroke(index % 2 === 0 ? "#ffffff" : PDF_COLORS.soft, PDF_COLORS.line); doc.font("Helvetica").fontSize(6.7).fillColor(PDF_COLORS.ink).text(value, x + 4, y + 5, { width: cellWidth - 8, height: rowHeight - 8, lineGap: 1, lineBreak: true }); x += cellWidth; });
                y += rowHeight;
            });
        }
        const pageRange = doc.bufferedPageRange();
        for (let index = 0; index < pageRange.count; index += 1) { doc.switchToPage(index); drawPdfFooterSafe(doc, index + 1, pageRange.count, generatedAt); }
        doc.flushPages();
        return doc.end();
    } catch (error) {
        console.error("Export attendance PDF error:", error);
        return res.status(500).json({ success: false, message: "Failed to export attendance PDF" });
    }
};

module.exports = { requireReportDates, getAttendanceReport, exportAttendanceReportExcel, exportAttendanceReportPdf };

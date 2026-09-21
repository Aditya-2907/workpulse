import React, { useEffect, useMemo, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";
import {
    getManagementAttendance,
    getBranches,
    getEmployees,
    correctManagementAttendance,
    getAuthorizedAttendancePhoto,
} from "../services/api";
import {
    formatAttendanceTime,
    formatWorkedDuration,
} from "../utils/attendanceDisplay";

const Attendance = () => {
    const managementUser = JSON.parse(
        sessionStorage.getItem("managementUser") || "{}"
    );

    const role = managementUser?.role;

    const isSuperAdmin = role === "SUPER_ADMIN";

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [attendanceData, setAttendanceData] = useState({
        summary: {},
        attendanceRecords: [],
    });

    const [branches, setBranches] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [photoUnavailable, setPhotoUnavailable] = useState(false);
    const [correction, setCorrection] = useState(null);
    const [correcting, setCorrecting] = useState(false);

    const [filters, setFilters] = useState({
        startDate: "",
        endDate: "",
        employeeId: "",
        status: "",
        branchId: "",
    });

    const attendanceStatuses = [
        "PENDING",
        "FULL_DAY",
        "PARTIAL_DAY",
        "INSUFFICIENT_ATTENDANCE",
        "INCOMPLETE",
        "ABSENT",
        "LEAVE",
        "HOLIDAY",
    ];

    const loadInitialData = async () => {
        try {
            setLoading(true);
            setError("");

            const requests = [
                getManagementAttendance(),
                getEmployees(),
            ];

            if (isSuperAdmin) {
                requests.push(getBranches());
            }

            const results = await Promise.all(requests);

            const attendanceResponse = results[0];
            const employeeResponse = results[1];

            setAttendanceData({
                summary: attendanceResponse.summary || {},
                attendanceRecords:
                    attendanceResponse.attendanceRecords || [],
            });
            setCurrentPage(1);

            setEmployees(
                employeeResponse.employees ||
                employeeResponse.data ||
                employeeResponse ||
                []
            );

            if (isSuperAdmin) {
                const branchResponse = results[2];

                setBranches(
                    branchResponse.branches ||
                    branchResponse.data ||
                    branchResponse ||
                    []
                );
            }
        } catch (err) {
            console.error(err);
            setError(
                err.message || "Failed to load attendance data"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === "Escape") setSelectedPhoto(null);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const handleFilterChange = (event) => {
        const { name, value } = event.target;

        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleApplyFilters = async (event) => {
        event.preventDefault();

        try {
            setLoading(true);
            setError("");

            const response =
                await getManagementAttendance(filters);

            setAttendanceData({
                summary: response.summary || {},
                attendanceRecords:
                    response.attendanceRecords || [],
            });
            setCurrentPage(1);
        } catch (err) {
            console.error(err);
            setError(
                err.message ||
                "Failed to filter attendance records"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleResetFilters = async () => {
        const resetFilters = {
            startDate: "",
            endDate: "",
            employeeId: "",
            status: "",
            branchId: "",
        };

        setFilters(resetFilters);

        try {
            setLoading(true);
            setError("");

            const response =
                await getManagementAttendance();

            setAttendanceData({
                summary: response.summary || {},
                attendanceRecords:
                    response.attendanceRecords || [],
            });
            setCurrentPage(1);
        } catch (err) {
            console.error(err);
            setError(
                err.message ||
                "Failed to reset attendance records"
            );
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "-";
        }

        const dateString =
            typeof dateValue === "string"
                ? dateValue.substring(0, 10)
                : "";

        if (!dateString) {
            return "-";
        }

        const [year, month, day] =
            dateString.split("-");

        if (!year || !month || !day) {
            return "-";
        }

        return `${day}-${month}-${year}`;
    };

    const formatStatus = (status) => {
        if (!status) {
            return "-";
        }

        return status
            .replaceAll("_", " ")
            .toLowerCase()
            .replace(/\b\w/g, (char) =>
                char.toUpperCase()
            );
    };

    const openPhoto = async (record, type) => {
        const available = type === "CHECK_IN" ? record.checkInPhotoAvailable : record.checkOutPhotoAvailable;
        if (!available) return;
        try {
            setPhotoUnavailable(false);
            const photo = await getAuthorizedAttendancePhoto(record.id, type === "CHECK_IN" ? "check-in" : "check-out");
            setSelectedPhoto({
            url: URL.createObjectURL(photo),
            label: type === "CHECK_IN" ? "Check-In Photo" : "Check-Out Photo",
            fullName: record.fullName,
            employeeCode: record.employeeCode,
            attendanceDate: record.attendanceDate,
            time: type === "CHECK_IN" ? record.checkInTimeLocal || record.checkInTime : record.checkOutTimeLocal || record.checkOutTime,
            });
        } catch (photoError) { setError(photoError.message || "Photo unavailable"); }
    };

    const toInputTime = (value) => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const pad = (item) => String(item).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const submitCorrection = async (event) => {
        event.preventDefault();
        try {
            setCorrecting(true); setError("");
            await correctManagementAttendance(correction.id, correction);
            setCorrection(null);
            await handleApplyFilters({ preventDefault() {} });
        } catch (correctionError) { setError(correctionError.message || "Unable to correct attendance"); }
        finally { setCorrecting(false); }
    };

    const summary = attendanceData.summary || {};
    const attendanceRecords = attendanceData.attendanceRecords || [];
    const totalPages = Math.max(1, Math.ceil(attendanceRecords.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const pageStart = (safeCurrentPage - 1) * pageSize;
    const visibleAttendanceRecords = attendanceRecords.slice(pageStart, pageStart + pageSize);

    const summaryCards = useMemo(
        () => [
            {
                label: "Total Records",
                value: summary.totalRecords || 0,
            },
            {
                label: "Full Day",
                value: summary.fullDay || 0,
            },
            {
                label: "Partial Day",
                value: summary.partialDay || 0,
            },
            {
                label: "Insufficient",
                value:
                    summary.insufficientAttendance || 0,
            },
            {
                label: "Pending",
                value: summary.pending || 0,
            },
            {
                label: "Incomplete",
                value: summary.incomplete || 0,
            },
            {
                label: "Absent",
                value: summary.absent || 0,
            },
            {
                label: "Leave",
                value: summary.leave || 0,
            },
            {
                label: "Holiday",
                value: summary.holiday || 0,
            },
            {
                label: "Late",
                value: summary.late || 0,
            },
            {
                label: "Early Departure",
                value:
                    summary.earlyDeparture || 0,
            },
        ],
        [summary]
    );

    return (
        <ManagementLayout>
            <div className="management-page">
                <div className="management-page-header">
                    <div>
                        <h1>Attendance Management</h1>

                        <p>
                            View and filter employee attendance
                            records.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="management-error">
                        {error}
                    </div>
                )}

                <form
                    className="management-form-card"
                    onSubmit={handleApplyFilters}
                >
                    <h3>Attendance Filters</h3>

                    <div className="management-form-grid">
                        <div className="management-form-group">
                            <label>Start Date</label>

                            <input
                                type="date"
                                name="startDate"
                                value={filters.startDate}
                                onChange={handleFilterChange}
                            />
                        </div>

                        <div className="management-form-group">
                            <label>End Date</label>

                            <input
                                type="date"
                                name="endDate"
                                value={filters.endDate}
                                onChange={handleFilterChange}
                            />
                        </div>

                        <div className="management-form-group">
                            <label>Employee</label>

                            <select
                                name="employeeId"
                                value={filters.employeeId}
                                onChange={handleFilterChange}
                            >
                                <option value="">
                                    All Employees
                                </option>

                                {employees.map((employee) => (
                                    <option
                                        key={employee.id}
                                        value={employee.id}
                                    >
                                        {employee.employeeCode ||
                                            employee.employee_code ||
                                            "N/A"}{" "}
                                        -{" "}
                                        {employee.fullName ||
                                            employee.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="management-form-group">
                            <label>Status</label>

                            <select
                                name="status"
                                value={filters.status}
                                onChange={handleFilterChange}
                            >
                                <option value="">
                                    All Statuses
                                </option>

                                {attendanceStatuses.map(
                                    (status) => (
                                        <option
                                            key={status}
                                            value={status}
                                        >
                                            {formatStatus(
                                                status
                                            )}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>

                        {isSuperAdmin && (
                            <div className="management-form-group">
                                <label>Branch</label>

                                <select
                                    name="branchId"
                                    value={filters.branchId}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">
                                        All Branches
                                    </option>

                                    {branches.map((branch) => (
                                        <option
                                            key={branch.id}
                                            value={branch.id}
                                        >
                                            {branch.branchCode ||
                                                branch.branch_code ||
                                                ""}{" "}
                                            {branch.branchName ||
                                                branch.branch_name ||
                                                branch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="management-form-actions">
                        <button
                            type="submit"
                            className="management-primary-button"
                        >
                            Apply Filters
                        </button>

                        <button
                            type="button"
                            className="management-secondary-button"
                            onClick={handleResetFilters}
                        >
                            Reset
                        </button>
                    </div>
                </form>

                <div className="attendance-summary-grid attendance-management-summary-grid">
                    {summaryCards.map((card) => (
                        <div
                            className="attendance-summary-card"
                            key={card.label}
                        >
                            <span>
                                {card.label}
                            </span>

                            <strong>
                                {card.value}
                            </strong>
                        </div>
                    ))}
                </div>

                <div className="management-table-card">
                    <div className="management-table-header">
                        <div>
                            <h3>
                                Attendance Records
                            </h3>

                            <p>
                                {
                                    attendanceRecords.length
                                }{" "}
                                record(s) found
                            </p>
                        </div>
                        <label className="management-page-size-control attendance-page-size-control">
                            <span>Rows per page</span>
                            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }}>
                                {[50, 100, 150, 200].map((size) => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </label>
                    </div>

                    {loading ? (
                        <div className="management-loading">
                            Loading attendance...
                        </div>
                    ) : attendanceRecords.length === 0 ? (
                        <div className="management-empty-state">
                            No attendance records found.
                        </div>
                    ) : (
                        <>
                        <div className="management-table-wrapper">
                            <table className="management-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Employee</th>
                                        <th>Branch</th>
                                        <th>Department</th>
                                        <th>Check In</th>
                                        <th>Check Out</th>
                                        <th>
                                            Worked
                                        </th>
                                        <th>
                                            Attendance %
                                        </th>
                                        <th>Late</th>
                                        <th>
                                            Early Departure
                                        </th>
                                        <th>Status</th>
                                        <th>Check-In Photo</th>
                                        <th>Check-Out Photo</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {visibleAttendanceRecords.map(
                                        (record) => (
                                            <tr
                                                key={
                                                    record.id
                                                }
                                            >
                                                <td>
                                                    {formatDate(
                                                        record.attendanceDate
                                                    )}
                                                </td>

                                                <td>
                                                    <strong>
                                                        {
                                                            record.fullName
                                                        }
                                                    </strong>

                                                    <div className="management-table-subtext">
                                                        {
                                                            record.employeeCode
                                                        }
                                                    </div>
                                                </td>

                                                <td>
                                                    {
                                                        record.branchName
                                                    }

                                                    <div className="management-table-subtext">
                                                        {
                                                            record.branchCode
                                                        }
                                                    </div>
                                                </td>

                                                <td>
                                                    {record.departmentName ||
                                                        "-"}
                                                </td>

                                                <td>
                                                    {formatAttendanceTime(
                                                        record.checkInTimeLocal ||
                                                        record.checkInTime
                                                    )}
                                                </td>

                                                <td>
                                                    {formatAttendanceTime(
                                                        record.checkOutTimeLocal ||
                                                        record.checkOutTime
                                                    )}
                                                </td>

                                                <td>
                                                    {formatWorkedDuration(
                                                        record.workedMinutes
                                                    )}
                                                </td>

                                                <td>
                                                    {record.attendancePercentage !=
                                                        null
                                                        ? `${record.attendancePercentage}%`
                                                        : "-"}
                                                </td>

                                                <td>
                                                    {record.isLate
                                                        ? "Yes"
                                                        : "No"}
                                                </td>

                                                <td>
                                                    {record.isEarlyDeparture
                                                        ? "Yes"
                                                        : "No"}
                                                </td>

                                                <td>
                                                    <span
                                                        className={`attendance-status-badge attendance-status-${record.attendanceStatus?.toLowerCase()}`}
                                                    >
                                                        {formatStatus(
                                                            record.attendanceStatus
                                                        )}
                                                    </span>
                                                    {isSuperAdmin && <button type="button" className="attendance-photo-view-button" onClick={() => setCorrection({ id: record.id, checkInTime: toInputTime(record.checkInTimeLocal || record.checkInTime), checkOutTime: toInputTime(record.checkOutTimeLocal || record.checkOutTime), reason: "" })}>Correct</button>}
                                                </td>

                                                <td className="attendance-photo-cell">
                                                    {record.checkInPhotoAvailable ? <button type="button" className="attendance-photo-view-button" onClick={() => openPhoto(record, "CHECK_IN")}>View</button> : <span className="attendance-photo-unavailable">Unavailable</span>}
                                                </td>

                                                <td className="attendance-photo-cell">
                                                    {record.checkOutPhotoAvailable ? <button type="button" className="attendance-photo-view-button" onClick={() => openPhoto(record, "CHECK_OUT")}>View</button> : <span className="attendance-photo-unavailable">Unavailable</span>}
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="management-table-footer attendance-pagination-footer" aria-label="Attendance pages">
                            <span className="attendance-pagination-info">Page {safeCurrentPage} of {totalPages}</span>
                            <div className="management-pagination attendance-pagination-actions">
                                <button type="button" className="management-secondary-button" onClick={() => setCurrentPage(safeCurrentPage - 1)} disabled={safeCurrentPage === 1}>Previous</button>
                                <button type="button" className="management-secondary-button" onClick={() => setCurrentPage(safeCurrentPage + 1)} disabled={safeCurrentPage === totalPages}>Next</button>
                            </div>
                        </div>
                        </>
                    )}
                </div>
            </div>
            {selectedPhoto && <div className="management-modal-backdrop attendance-photo-backdrop" role="presentation" onMouseDown={() => setSelectedPhoto(null)}>
                <section className="attendance-photo-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-photo-title" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="attendance-photo-modal-header"><div><p>{selectedPhoto.label}</p><h3 id="attendance-photo-title">{selectedPhoto.fullName}</h3><span>{selectedPhoto.employeeCode} · {formatDate(selectedPhoto.attendanceDate)}{selectedPhoto.time ? ` · ${formatAttendanceTime(selectedPhoto.time)}` : ""}</span></div><button type="button" className="attendance-photo-close" onClick={() => setSelectedPhoto(null)} aria-label="Close photo viewer">×</button></div>
                    {photoUnavailable ? <div className="management-empty-state">Photo unavailable.</div> : <img className="attendance-photo-preview" src={selectedPhoto.url} alt={`${selectedPhoto.label} for ${selectedPhoto.fullName}`} onError={() => setPhotoUnavailable(true)} />}
                </section>
            </div>}
            {correction && <div className="management-modal-backdrop" role="presentation" onMouseDown={() => setCorrection(null)}><section className="attendance-photo-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-correction-title" onMouseDown={(event) => event.stopPropagation()}><div className="attendance-photo-modal-header"><div><p>Super Admin only</p><h3 id="attendance-correction-title">Correct attendance</h3><span>Derived duration, rate, late status and attendance status will be recalculated.</span></div><button type="button" className="attendance-photo-close" onClick={() => setCorrection(null)} aria-label="Close correction dialog">×</button></div><form className="management-form-card" onSubmit={submitCorrection}><div className="management-form-grid"><div className="management-form-group"><label>Check in</label><input type="datetime-local" value={correction.checkInTime} onChange={(event) => setCorrection({ ...correction, checkInTime: event.target.value })} required /></div><div className="management-form-group"><label>Check out</label><input type="datetime-local" value={correction.checkOutTime} onChange={(event) => setCorrection({ ...correction, checkOutTime: event.target.value })} /></div><div className="management-form-group"><label>Reason</label><textarea value={correction.reason} onChange={(event) => setCorrection({ ...correction, reason: event.target.value })} required maxLength="500" /></div></div><div className="management-form-actions"><button type="submit" className="management-primary-button" disabled={correcting}>{correcting ? "Saving…" : "Save correction"}</button></div></form></section></div>}
        </ManagementLayout>
    );
};

export default Attendance;

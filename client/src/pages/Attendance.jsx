import React, { useEffect, useMemo, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";
import {
    getManagementAttendance,
    getBranches,
    getEmployees,
} from "../services/api";

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

    const formatDateTime = (dateTimeValue) => {
        if (!dateTimeValue) {
            return "-";
        }

        const date = new Date(dateTimeValue);

        if (Number.isNaN(date.getTime())) {
            return "-";
        }

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
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

    const summary = attendanceData.summary || {};

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

                <div className="attendance-summary-grid">
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
                                    attendanceData
                                        .attendanceRecords
                                        .length
                                }{" "}
                                record(s) found
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="management-loading">
                            Loading attendance...
                        </div>
                    ) : attendanceData
                        .attendanceRecords.length === 0 ? (
                        <div className="management-empty-state">
                            No attendance records found.
                        </div>
                    ) : (
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
                                    </tr>
                                </thead>

                                <tbody>
                                    {attendanceData.attendanceRecords.map(
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
                                                    {formatDateTime(
                                                        record.checkInTime
                                                    )}
                                                </td>

                                                <td>
                                                    {formatDateTime(
                                                        record.checkOutTime
                                                    )}
                                                </td>

                                                <td>
                                                    {record.workedMinutes ??
                                                        "-"}
                                                    {record.workedMinutes !=
                                                        null
                                                        ? " min"
                                                        : ""}
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
                                                </td>
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </ManagementLayout>
    );
};

export default Attendance;
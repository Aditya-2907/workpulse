import React, { useEffect, useMemo, useState } from "react";

import ManagementLayout from "../components/management/ManagementLayout";

import {
    getLeaves,
    createLeave,
    cancelLeave,
    getEmployees,
    getBranches,
    getAdmins,
} from "../services/api";

const Leaves = () => {
    const managementUser = JSON.parse(
        sessionStorage.getItem("managementUser") || "{}"
    );

    const role = managementUser.role;

    const [leaves, setLeaves] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [branches, setBranches] = useState([]);
    const [admins, setAdmins] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [createEmployeeSearch, setCreateEmployeeSearch] = useState("");

    const [filterEmployeeSearch, setFilterEmployeeSearch] = useState("");

    const [form, setForm] = useState({
        userId: "",
        fromDate: "",
        toDate: "",
        reason: "",
    });

    const [filters, setFilters] = useState({
        startDate: "",
        endDate: "",
        employeeId: "",
        status: "",
        branchId: "",
    });

    // ======================================================
    // LOAD INITIAL DATA
    // ======================================================

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            setError("");

            const requests = [
                getLeaves(),
                getEmployees(),
            ];

            /*
             * Super Admin:
             * - All employees
             * - All admins
             * - All branches
             *
             * Admin:
             * - Own branch employees
             * - Own account will be added locally from managementUser
             */
            if (role === "SUPER_ADMIN") {
                requests.push(
                    getBranches(),
                    getAdmins()
                );
            }

            const results = await Promise.all(requests);

            const leaveResponse = results[0];
            const employeeResponse = results[1];

            setLeaves(
                leaveResponse.leaves ||
                leaveResponse.data ||
                []
            );

            setEmployees(
                employeeResponse.employees ||
                employeeResponse.data ||
                employeeResponse ||
                []
            );

            if (role === "SUPER_ADMIN") {
                const branchResponse = results[2];
                const adminResponse = results[3];

                setBranches(
                    branchResponse.branches ||
                    branchResponse.data ||
                    branchResponse ||
                    []
                );

                setAdmins(
                    adminResponse.admins ||
                    adminResponse.data ||
                    []
                );
            }
        } catch (err) {
            setError(
                err.message || "Failed to load leave data"
            );
        } finally {
            setLoading(false);
        }
    };

    // ======================================================
    // FORM HANDLERS
    // ======================================================

    const handleFormChange = (e) => {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            if (
                !form.userId ||
                !form.fromDate ||
                !form.toDate ||
                !form.reason.trim()
            ) {
                setError(
                    "Employee/Admin, From Date, To Date and Reason are required"
                );
                return;
            }

            await createLeave({
                userId: Number(form.userId),
                fromDate: form.fromDate,
                toDate: form.toDate,
                reason: form.reason.trim(),
            });

            setSuccess("Leave approved successfully");

            setForm({
                userId: "",
                fromDate: "",
                toDate: "",
                reason: "",
            });

            setCreateEmployeeSearch("");

            await loadLeaves(filters);
        } catch (err) {
            setError(
                err.message || "Failed to approve leave"
            );
        } finally {
            setSaving(false);
        }
    };

    // ======================================================
    // FILTER HANDLERS
    // ======================================================

    const handleFilterChange = (e) => {
        const { name, value } = e.target;

        setFilters((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const loadLeaves = async (activeFilters = {}) => {
        try {
            setLoading(true);
            setError("");

            const response =
                await getLeaves(activeFilters);

            setLeaves(
                response.leaves ||
                response.data ||
                []
            );
        } catch (err) {
            setError(
                err.message || "Failed to load leaves"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleApplyFilters = async () => {
        await loadLeaves(filters);
    };

    const handleResetFilters = async () => {
        const reset = {
            startDate: "",
            endDate: "",
            employeeId: "",
            status: "",
            branchId: "",
        };

        setFilters(reset);

        setFilterEmployeeSearch("");

        await loadLeaves(reset);
    };

    // ======================================================
    // CANCEL LEAVE
    // ======================================================

    const handleCancelLeave = async (leave) => {
        const confirmed = window.confirm(
            `Cancel leave for ${leave.fullName} from ${formatDate(
                leave.fromDate
            )} to ${formatDate(leave.toDate)}?`
        );

        if (!confirmed) {
            return;
        }

        try {
            setError("");
            setSuccess("");

            await cancelLeave(leave.id);

            setSuccess("Leave cancelled successfully");

            await loadLeaves(filters);
        } catch (err) {
            setError(
                err.message || "Failed to cancel leave"
            );
        }
    };

    // ======================================================
    // HELPERS
    // ======================================================

    const formatDate = (dateValue) => {
        if (!dateValue) return "-";

        const dateString =
            typeof dateValue === "string"
                ? dateValue.substring(0, 10)
                : "";

        if (!dateString) return "-";

        const [year, month, day] =
            dateString.split("-");

        return `${day}-${month}-${year}`;
    };

    const approvedCount = useMemo(
        () =>
            leaves.filter(
                (leave) =>
                    leave.status === "APPROVED"
            ).length,
        [leaves]
    );

    const cancelledCount = useMemo(
        () =>
            leaves.filter(
                (leave) =>
                    leave.status === "CANCELLED"
            ).length,
        [leaves]
    );

    // ======================================================
    // EMPLOYEE OPTIONS
    // ======================================================

    const availableUsers = useMemo(() => {
        const employeeUsers = employees.map((employee) => ({
            ...employee,
            userType: "EMPLOYEE",
        }));

        /*
         * SUPER ADMIN
         * Can assign leave to:
         * - Employees
         * - Active Admins
         *
         * Super Admin himself is not included.
         */
        if (role === "SUPER_ADMIN") {
            const activeAdmins = admins
                .filter(
                    (admin) =>
                        admin.accountStatus === "ACTIVE"
                )
                .map((admin) => ({
                    ...admin,
                    userType: "ADMIN",
                }));

            return [
                ...employeeUsers,
                ...activeAdmins,
            ];
        }

        /*
         * ADMIN
         * Can assign leave to:
         * - Own branch employees
         * - Himself only
         *
         * Other Admins are intentionally not added.
         */
        if (
            role === "ADMIN" &&
            managementUser.id
        ) {
            const selfAdmin = {
                id: managementUser.id,
                employeeCode:
                    managementUser.employeeCode ||
                    "SELF",
                fullName:
                    managementUser.fullName ||
                    "Myself",
                branchId:
                    managementUser.branchId,
                branchName:
                    managementUser.branchName ||
                    "",
                designation:
                    managementUser.designation ||
                    "Admin",
                userType: "ADMIN",
            };

            return [
                selfAdmin,
                ...employeeUsers,
            ];
        }

        return employeeUsers;
    }, [
        employees,
        admins,
        role,
        managementUser.id,
        managementUser.employeeCode,
        managementUser.fullName,
        managementUser.branchId,
        managementUser.branchName,
        managementUser.designation,
    ]);

    const getEmployeeSearchText = (employee) => {
        return [
            employee.employeeCode,
            employee.employee_code,
            employee.fullName,
            employee.full_name,
            employee.designation,
            employee.departmentName,
            employee.department_name,
            employee.branchName,
            employee.branch_name,
            employee.phone,
            employee.userType,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
    };

    const filteredCreateUsers = useMemo(() => {
        const search =
            createEmployeeSearch.trim().toLowerCase();

        if (!search) {
            return availableUsers;
        }

        return availableUsers.filter((employee) =>
            getEmployeeSearchText(employee).includes(search)
        );
    }, [availableUsers, createEmployeeSearch]);

    const filteredFilterUsers = useMemo(() => {
        const search =
            filterEmployeeSearch.trim().toLowerCase();

        let users = availableUsers;

        /*
         * Super Admin branch filter select korle
         * Employee dropdown-o oi branch-er moddhei narrow hobe.
         */
        if (
            role === "SUPER_ADMIN" &&
            filters.branchId
        ) {
            users = users.filter((employee) => {
                const employeeBranchId =
                    employee.branchId ??
                    employee.branch_id;

                return (
                    Number(employeeBranchId) ===
                    Number(filters.branchId)
                );
            });
        }

        if (!search) {
            return users;
        }

        return users.filter((employee) =>
            getEmployeeSearchText(employee).includes(search)
        );
    }, [
        availableUsers,
        filterEmployeeSearch,
        filters.branchId,
        role,
    ]);

    return (
        <ManagementLayout>
            <div className="management-page">
                {/* ======================================================
                    PAGE HEADER
                ====================================================== */}

                <div className="management-page-header">
                    <div>
                        <h1>Leave Management</h1>

                        <p>
                            Approve, review and cancel employee leave.
                        </p>
                    </div>
                </div>

                {/* ======================================================
                    MESSAGES
                ====================================================== */}

                {error && (
                    <div className="management-error">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="management-success">
                        {success}
                    </div>
                )}

                {/* ======================================================
                    CREATE LEAVE
                ====================================================== */}

                <div className="management-form-card">
                    <div className="management-table-header">
                        <div>
                            <h2>Approve Leave</h2>
                            <p>
                                Select employee, leave dates and reason.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="leave-create-form"
                    >
                        <div className="form-group leave-employee-selector">
                            <label>Employee</label>

                            <input
                                type="text"
                                className="employee-search-input"
                                placeholder="Search by code, name, designation..."
                                value={createEmployeeSearch}
                                onChange={(e) =>
                                    setCreateEmployeeSearch(e.target.value)
                                }
                            />

                            <select
                                name="userId"
                                value={form.userId}
                                onChange={handleFormChange}
                                required
                            >
                                <option value="">
                                    Select Employee
                                </option>

                                {filteredCreateUsers.map((employee) => (
                                    <option
                                        key={employee.id}
                                        value={employee.id}
                                    >
                                        {employee.employeeCode ||
                                            employee.employee_code ||
                                            (employee.userType === "ADMIN" ? "ADMIN" : "-")}{" "}
                                        -{" "}
                                        {employee.fullName ||
                                            employee.full_name}{" "}
                                        [{employee.userType === "ADMIN" ? "Admin" : "Employee"}]
                                    </option>
                                ))}
                            </select>

                            {createEmployeeSearch &&
                                filteredCreateUsers.length === 0 && (
                                    <small className="employee-search-empty">
                                        No matching employee found
                                    </small>
                                )}
                        </div>

                        <div className="form-group">
                            <label>
                                From Date
                            </label>

                            <input
                                type="date"
                                name="fromDate"
                                value={form.fromDate}
                                onChange={
                                    handleFormChange
                                }
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>
                                To Date
                            </label>

                            <input
                                type="date"
                                name="toDate"
                                value={form.toDate}
                                onChange={
                                    handleFormChange
                                }
                                required
                            />
                        </div>

                        <div className="form-group leave-reason-group">
                            <label>
                                Reason
                            </label>

                            <textarea
                                name="reason"
                                value={form.reason}
                                onChange={
                                    handleFormChange
                                }
                                placeholder="Enter leave reason"
                                rows="3"
                                required
                            />
                        </div>

                        <div className="leave-form-actions">
                            <button
                                type="submit"
                                className="management-primary-button"
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : "Approve Leave"}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ======================================================
                    SUMMARY
                ====================================================== */}

                <div className="attendance-summary-grid leave-summary-grid">
                    <div className="attendance-summary-card">
                        <span>
                            Total Leave Records
                        </span>

                        <strong>
                            {leaves.length}
                        </strong>
                    </div>

                    <div className="attendance-summary-card">
                        <span>
                            Approved
                        </span>

                        <strong>
                            {approvedCount}
                        </strong>
                    </div>

                    <div className="attendance-summary-card">
                        <span>
                            Cancelled
                        </span>

                        <strong>
                            {cancelledCount}
                        </strong>
                    </div>
                </div>

                {/* ======================================================
                    FILTERS
                ====================================================== */}

                <div className="management-form-card">
                    <div className="management-table-header">
                        <div>
                            <h2>Leave Filters</h2>

                            <p>
                                Filter leave records by date, employee and status.
                            </p>
                        </div>
                    </div>

                    <div className="leave-filter-grid">
                        <div className="form-group">
                            <label>
                                Start Date
                            </label>

                            <input
                                type="date"
                                name="startDate"
                                value={
                                    filters.startDate
                                }
                                onChange={
                                    handleFilterChange
                                }
                            />
                        </div>

                        <div className="form-group">
                            <label>
                                End Date
                            </label>

                            <input
                                type="date"
                                name="endDate"
                                value={
                                    filters.endDate
                                }
                                onChange={
                                    handleFilterChange
                                }
                            />
                        </div>

                        <div className="form-group leave-employee-selector">
                            <label>Employee</label>

                            <input
                                type="text"
                                className="employee-search-input"
                                placeholder="Search employee..."
                                value={filterEmployeeSearch}
                                onChange={(e) =>
                                    setFilterEmployeeSearch(e.target.value)
                                }
                            />

                            <select
                                name="employeeId"
                                value={filters.employeeId}
                                onChange={handleFilterChange}
                            >
                                <option value="">
                                    All Employees
                                </option>

                                {filteredFilterUsers.map((employee) => (
                                    <option
                                        key={employee.id}
                                        value={employee.id}
                                    >
                                        {employee.employeeCode ||
                                            employee.employee_code ||
                                            (employee.userType === "ADMIN" ? "ADMIN" : "-")}{" "}
                                        -{" "}
                                        {employee.fullName ||
                                            employee.full_name}{" "}
                                        [{employee.userType === "ADMIN" ? "Admin" : "Employee"}]
                                    </option>
                                ))}
                            </select>

                            {filterEmployeeSearch &&
                                filteredFilterUsers.length === 0 && (
                                    <small className="employee-search-empty">
                                        No matching employee found
                                    </small>
                                )}
                        </div>

                        <div className="form-group">
                            <label>
                                Status
                            </label>

                            <select
                                name="status"
                                value={
                                    filters.status
                                }
                                onChange={
                                    handleFilterChange
                                }
                            >
                                <option value="">
                                    All Status
                                </option>

                                <option value="APPROVED">
                                    Approved
                                </option>

                                <option value="CANCELLED">
                                    Cancelled
                                </option>
                            </select>
                        </div>

                        {role === "SUPER_ADMIN" && (
                            <div className="form-group">
                                <label>
                                    Branch
                                </label>

                                <select
                                    name="branchId"
                                    value={
                                        filters.branchId
                                    }
                                    onChange={
                                        handleFilterChange
                                    }
                                >
                                    <option value="">
                                        All Branches
                                    </option>

                                    {branches.map(
                                        (branch) => (
                                            <option
                                                key={
                                                    branch.id
                                                }
                                                value={
                                                    branch.id
                                                }
                                            >
                                                {branch.branchName ||
                                                    branch.branch_name}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="leave-filter-actions">
                        <button
                            type="button"
                            className="management-primary-button"
                            onClick={
                                handleApplyFilters
                            }
                        >
                            Apply Filters
                        </button>

                        <button
                            type="button"
                            className="management-secondary-button"
                            onClick={
                                handleResetFilters
                            }
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* ======================================================
                    TABLE
                ====================================================== */}

                <div className="management-table-card">
                    <div className="management-table-header">
                        <div>
                            <h2>
                                Leave Records
                            </h2>

                            <p className="management-table-subtext">
                                {leaves.length} record
                                {leaves.length === 1
                                    ? ""
                                    : "s"}{" "}
                                found
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="management-loading">
                            Loading leave records...
                        </div>
                    ) : leaves.length === 0 ? (
                        <div className="management-loading">
                            No leave records found.
                        </div>
                    ) : (
                        <div className="management-table-wrapper">
                            <table className="management-table leave-table">
                                <thead>
                                    <tr>
                                        <th>
                                            Employee
                                        </th>
                                        <th>
                                            Branch
                                        </th>
                                        <th>
                                            Department
                                        </th>
                                        <th>
                                            From
                                        </th>
                                        <th>
                                            To
                                        </th>
                                        <th>
                                            Reason
                                        </th>
                                        <th>
                                            Approved By
                                        </th>
                                        <th>
                                            Status
                                        </th>
                                        <th>
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {leaves.map(
                                        (leave) => (
                                            <tr
                                                key={
                                                    leave.id
                                                }
                                            >
                                                <td>
                                                    <strong>
                                                        {leave.fullName ||
                                                            "-"}
                                                    </strong>

                                                    <div className="management-table-subtext">
                                                        {
                                                            leave.employeeCode ||
                                                            "-"
                                                        }
                                                    </div>
                                                </td>

                                                <td>
                                                    {leave.branchName ||
                                                        "-"}
                                                </td>

                                                <td>
                                                    {leave.departmentName ||
                                                        "-"}
                                                </td>

                                                <td>
                                                    {formatDate(
                                                        leave.fromDate
                                                    )}
                                                </td>

                                                <td>
                                                    {formatDate(
                                                        leave.toDate
                                                    )}
                                                </td>

                                                <td className="leave-reason-cell">
                                                    {leave.reason}
                                                </td>

                                                <td>
                                                    {leave.approvedByName ||
                                                        "-"}
                                                </td>

                                                <td>
                                                    <span
                                                        className={`attendance-status-badge ${String(
                                                            leave.status
                                                        ).toLowerCase()}`}
                                                    >
                                                        {
                                                            leave.status
                                                        }
                                                    </span>
                                                </td>

                                                <td>
                                                    {leave.status ===
                                                        "APPROVED" ? (
                                                        <button
                                                            type="button"
                                                            className="management-danger-button"
                                                            onClick={() =>
                                                                handleCancelLeave(
                                                                    leave
                                                                )
                                                            }
                                                        >
                                                            Cancel
                                                        </button>
                                                    ) : (
                                                        <span className="management-table-subtext">
                                                            No action
                                                        </span>
                                                    )}
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

export default Leaves;

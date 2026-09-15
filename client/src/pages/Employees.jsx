import { useEffect, useMemo, useState } from "react";

import ManagementLayout from "../components/management/ManagementLayout";

import {
    getEmployees,
    createEmployee,
    getEmployeeById,
    updateEmployee,
    updateEmployeeStatus,
    transferEmployeeBranch,
    getBranches,
    getDepartments,
} from "../services/api";


const initialForm = {
    fullName: "",
    phone: "",
    email: "",
    branchId: "",
    departmentId: "",
    designation: "",
    address: "",
    pincode: "",
    qualification: "",
    computerSkill: false,
    aadhaarNumber: "",
    panNumber: "",
    dutyStartTime: "",
    dutyEndTime: "",
    joiningDate: "",
};


function Employees() {
    const managementUser = JSON.parse(
        sessionStorage.getItem("managementUser") || "{}"
    );

    const isSuperAdmin =
        managementUser.role === "SUPER_ADMIN";

    const [employees, setEmployees] = useState([]);
    const [branches, setBranches] = useState([]);
    const [departments, setDepartments] = useState([]);

    const [formData, setFormData] =
        useState(initialForm);

    const [editingEmployee, setEditingEmployee] =
        useState(null);

    const [showForm, setShowForm] =
        useState(false);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [message, setMessage] =
        useState("");

    const [error, setError] =
        useState("");

    const [currentMaskedAadhaar, setCurrentMaskedAadhaar] =
        useState("");

    const [currentPan, setCurrentPan] =
        useState("");

    const [searchText, setSearchText] =
        useState("");


    // =====================================================
    // LOAD DATA
    // =====================================================

    const loadData = async () => {
        try {
            setLoading(true);
            setError("");

            const requests = [
                getEmployees(),
                getDepartments(),
            ];

            if (isSuperAdmin) {
                requests.push(
                    getBranches()
                );
            }

            const results =
                await Promise.all(requests);

            const employeesResponse =
                results[0];

            const departmentsResponse =
                results[1];

            setEmployees(
                employeesResponse.employees || []
            );

            setDepartments(
                (
                    departmentsResponse.departments ||
                    []
                ).filter(
                    (department) =>
                        department.status === "ACTIVE"
                )
            );

            if (isSuperAdmin) {
                const branchesResponse =
                    results[2];

                setBranches(
                    (
                        branchesResponse.branches ||
                        []
                    ).filter(
                        (branch) =>
                            branch.status === "ACTIVE"
                    )
                );
            }
        } catch (err) {
            console.error(
                "Employee data load error:",
                err
            );

            setError(
                err.message ||
                "Unable to load employee data"
            );
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        loadData();
    }, []);


    // =====================================================
    // FORM HELPERS
    // =====================================================

    const resetForm = () => {
        setFormData(initialForm);
        setEditingEmployee(null);
        setCurrentMaskedAadhaar("");
        setCurrentPan("");
        setMessage("");
        setError("");
    };


    const openAddForm = () => {
        resetForm();
        setShowForm(true);
    };


    const closeForm = () => {
        resetForm();
        setShowForm(false);
    };


    const handleChange = (event) => {
        const {
            name,
            value,
            type,
            checked,
        } = event.target;

        setFormData((previous) => ({
            ...previous,

            [name]:
                type === "checkbox"
                    ? checked
                    : value,
        }));
    };


    // =====================================================
    // CREATE / UPDATE EMPLOYEE
    // =====================================================

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            setSaving(true);
            setMessage("");
            setError("");

            const payload = {
                fullName:
                    formData.fullName.trim(),

                phone:
                    formData.phone.trim(),

                email:
                    formData.email.trim() ||
                    null,

                departmentId:
                    Number(
                        formData.departmentId
                    ),

                designation:
                    formData.designation.trim(),

                address:
                    formData.address.trim() ||
                    null,

                pincode:
                    formData.pincode.trim() ||
                    null,

                qualification:
                    formData.qualification.trim() ||
                    null,

                computerSkill:
                    Boolean(
                        formData.computerSkill
                    ),

                aadhaarNumber:
                    formData.aadhaarNumber.trim(),

                panNumber:
                    formData.panNumber.trim() ||
                    null,

                dutyStartTime:
                    formData.dutyStartTime,

                dutyEndTime:
                    formData.dutyEndTime,

                joiningDate:
                    formData.joiningDate,
            };


            /*
             * Only Super Admin selects a branch
             * while creating an employee.
             *
             * For Admin, backend automatically
             * uses Admin's own branch.
             */
            if (
                isSuperAdmin &&
                !editingEmployee
            ) {
                payload.branchId =
                    Number(
                        formData.branchId
                    );
            }


            if (editingEmployee) {
                await updateEmployee(
                    editingEmployee.id,
                    payload
                );

                setMessage(
                    "Employee updated successfully"
                );
            } else {
                const response =
                    await createEmployee(
                        payload
                    );

                setMessage(
                    response.employeeCode
                        ? `Employee created successfully. Employee Code: ${response.employeeCode}`
                        : "Employee created successfully"
                );
            }


            await loadData();

            setTimeout(() => {
                closeForm();
            }, 700);
        } catch (err) {
            console.error(
                "Employee save error:",
                err
            );

            setError(
                err.message ||
                "Unable to save employee"
            );
        } finally {
            setSaving(false);
        }
    };


    // =====================================================
    // OPEN EDIT
    // =====================================================

    const openEditForm = async (
        employeeId
    ) => {
        try {
            setError("");
            setMessage("");

            const response =
                await getEmployeeById(
                    employeeId
                );

            const employee =
                response.employee;

            setEditingEmployee(
                employee
            );


            /*
             * Employee Code is intentionally
             * NOT stored in formData.
             *
             * It is generated by WorkPulse
             * and can never be edited.
             */
            setFormData({
                fullName:
                    employee.fullName || "",

                phone:
                    employee.phone || "",

                email:
                    employee.email || "",

                branchId:
                    employee.branchId || "",

                departmentId:
                    employee.departmentId || "",

                designation:
                    employee.designation || "",

                address:
                    employee.address || "",

                pincode:
                    employee.pincode || "",

                qualification:
                    employee.qualification || "",

                computerSkill:
                    Boolean(
                        employee.computerSkill
                    ),

                /*
                 * Do not put masked Aadhaar
                 * inside editable field.
                 *
                 * Blank means preserve old
                 * Aadhaar in backend.
                 */
                aadhaarNumber: "",

                panNumber: "",

                dutyStartTime:
                    employee.dutyStartTime
                        ? String(
                            employee.dutyStartTime
                        ).slice(0, 5)
                        : "",

                dutyEndTime:
                    employee.dutyEndTime
                        ? String(
                            employee.dutyEndTime
                        ).slice(0, 5)
                        : "",

                joiningDate:
                    employee.joiningDate
                        ? String(
                            employee.joiningDate
                        ).slice(0, 10)
                        : "",
            });


            setCurrentMaskedAadhaar(
                employee.aadhaarNumber || ""
            );

            setCurrentPan(
                employee.panNumber
                    ? `${String(employee.panNumber).slice(0, 2)}******${String(employee.panNumber).slice(-2)}`
                    : ""
            );

            setShowForm(true);
        } catch (err) {
            console.error(
                "Employee edit load error:",
                err
            );

            setError(
                err.message ||
                "Unable to load employee"
            );
        }
    };


    // =====================================================
    // ACTIVE / INACTIVE
    // =====================================================

    const handleStatusChange = async (
        employee
    ) => {
        const newStatus =
            employee.accountStatus ===
                "ACTIVE"
                ? "INACTIVE"
                : "ACTIVE";

        const actionText =
            newStatus === "ACTIVE"
                ? "activate"
                : "deactivate";

        const confirmed =
            window.confirm(
                `Are you sure you want to ${actionText} ${employee.fullName}?`
            );

        if (!confirmed) {
            return;
        }

        try {
            setError("");
            setMessage("");

            await updateEmployeeStatus(
                employee.id,
                newStatus
            );

            setMessage(
                `Employee marked as ${newStatus}`
            );

            await loadData();
        } catch (err) {
            setError(
                err.message ||
                "Unable to update employee status"
            );
        }
    };


    // =====================================================
    // SUPER ADMIN: TRANSFER BRANCH
    // =====================================================

    const handleTransfer = async (
        employee
    ) => {
        if (!isSuperAdmin) {
            return;
        }

        const availableBranches =
            branches.filter(
                (branch) =>
                    Number(branch.id) !==
                    Number(
                        employee.branchId
                    )
            );

        if (
            availableBranches.length ===
            0
        ) {
            window.alert(
                "No other active branch is available."
            );

            return;
        }


        const branchList =
            availableBranches
                .map(
                    (branch) =>
                        `${branch.id} - ${branch.branchName}`
                )
                .join("\n");


        const selectedBranchId =
            window.prompt(
                `Enter new Branch ID for ${employee.fullName}:\n\n${branchList}`
            );


        if (!selectedBranchId) {
            return;
        }


        const selectedBranch =
            availableBranches.find(
                (branch) =>
                    Number(branch.id) ===
                    Number(
                        selectedBranchId
                    )
            );


        if (!selectedBranch) {
            window.alert(
                "Invalid branch selected."
            );

            return;
        }


        const confirmed =
            window.confirm(
                `Transfer ${employee.fullName} from ${employee.branchName} to ${selectedBranch.branchName}?`
            );


        if (!confirmed) {
            return;
        }


        try {
            setError("");
            setMessage("");

            await transferEmployeeBranch(
                employee.id,
                Number(selectedBranchId)
            );

            setMessage(
                "Employee transferred successfully"
            );

            await loadData();
        } catch (err) {
            setError(
                err.message ||
                "Unable to transfer employee"
            );
        }
    };


    // =====================================================
    // SEARCH
    // =====================================================

    const filteredEmployees =
        useMemo(() => {
            const search =
                searchText
                    .trim()
                    .toLowerCase();

            if (!search) {
                return employees;
            }

            return employees.filter(
                (employee) => {
                    const values = [
                        employee.employeeCode,
                        employee.fullName,
                        employee.phone,
                        employee.email,
                        employee.designation,
                        employee.branchName,
                        employee.departmentName,
                        employee.accountStatus,
                    ];

                    return values.some(
                        (value) =>
                            String(
                                value || ""
                            )
                                .toLowerCase()
                                .includes(search)
                    );
                }
            );
        }, [
            employees,
            searchText,
        ]);


    // =====================================================
    // UI
    // =====================================================

    return (
        <ManagementLayout>

            <section className="dashboard-welcome-section">
                <div>
                    <span className="dashboard-eyebrow">
                        EMPLOYEE MANAGEMENT
                    </span>

                    <h2>
                        Employees
                    </h2>

                    <p>
                        {isSuperAdmin
                            ? "Manage employees across all branches."
                            : "Manage employees assigned to your branch."}
                    </p>
                </div>

                <button
                    type="button"
                    className="management-primary-button"
                    onClick={
                        openAddForm
                    }
                >
                    + Add Employee
                </button>
            </section>


            {message && (
                <div className="management-success-message">
                    {message}
                </div>
            )}


            {error && (
                <div className="management-error-message">
                    {error}
                </div>
            )}


            {/* =================================================
                ADD / EDIT EMPLOYEE FORM
            ================================================= */}

            {showForm && (
                <section className="dashboard-panel">

                    <div className="dashboard-panel-header">
                        <div>
                            <h3>
                                {editingEmployee
                                    ? "Edit Employee"
                                    : "Add New Employee"}
                            </h3>

                            <p>
                                {editingEmployee
                                    ? "Update employee information. Employee Code cannot be changed."
                                    : "Employee Code will be generated automatically by WorkPulse."}
                            </p>
                        </div>

                        <button
                            type="button"
                            className="management-secondary-button"
                            onClick={
                                closeForm
                            }
                        >
                            Close
                        </button>
                    </div>


                    {editingEmployee && (
                        <div className="management-info-box">
                            Employee Code:{" "}
                            <strong>
                                {
                                    editingEmployee.employeeCode
                                }
                            </strong>
                        </div>
                    )}


                    <form
                        onSubmit={
                            handleSubmit
                        }
                        className="management-form-grid"
                    >

                        {/* Full Name */}

                        <div className="management-form-group">
                            <label>
                                Full Name *
                            </label>

                            <input
                                type="text"
                                name="fullName"
                                value={
                                    formData.fullName
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />
                        </div>


                        {/* Phone */}

                        <div className="management-form-group">
                            <label>
                                Phone *
                            </label>

                            <input
                                type="tel"
                                name="phone"
                                value={
                                    formData.phone
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />
                        </div>


                        {/* Email */}

                        <div className="management-form-group">
                            <label>
                                Email
                            </label>

                            <input
                                type="email"
                                name="email"
                                value={
                                    formData.email
                                }
                                onChange={
                                    handleChange
                                }
                            />
                        </div>


                        {/* Branch - only Super Admin during create */}

                        {isSuperAdmin &&
                            !editingEmployee && (
                                <div className="management-form-group">

                                    <label>
                                        Branch *
                                    </label>

                                    <select
                                        name="branchId"
                                        value={
                                            formData.branchId
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        required
                                    >
                                        <option value="">
                                            Select Branch
                                        </option>

                                        {branches.map(
                                            (
                                                branch
                                            ) => (
                                                <option
                                                    key={
                                                        branch.id
                                                    }
                                                    value={
                                                        branch.id
                                                    }
                                                >
                                                    {
                                                        branch.branchName
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>

                                </div>
                            )}


                        {/* Existing Branch while editing */}

                        {editingEmployee && (
                            <div className="management-form-group">

                                <label>
                                    Current Branch
                                </label>

                                <input
                                    value={
                                        editingEmployee.branchName ||
                                        "-"
                                    }
                                    disabled
                                />

                            </div>
                        )}


                        {/* Department */}

                        <div className="management-form-group">
                            <label>
                                Department *
                            </label>

                            <select
                                name="departmentId"
                                value={
                                    formData.departmentId
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            >
                                <option value="">
                                    Select Department
                                </option>

                                {departments.map(
                                    (
                                        department
                                    ) => (
                                        <option
                                            key={
                                                department.id
                                            }
                                            value={
                                                department.id
                                            }
                                        >
                                            {
                                                department.departmentName
                                            }
                                        </option>
                                    )
                                )}
                            </select>
                        </div>


                        {/* Designation */}

                        <div className="management-form-group">
                            <label>
                                Designation *
                            </label>

                            <input
                                type="text"
                                name="designation"
                                value={
                                    formData.designation
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />
                        </div>


                        {/* Address */}

                        <div className="management-form-group management-form-group-full">
                            <label>
                                Address
                            </label>

                            <textarea
                                name="address"
                                value={
                                    formData.address
                                }
                                onChange={
                                    handleChange
                                }
                                rows="3"
                            />
                        </div>


                        {/* Pincode */}

                        <div className="management-form-group">
                            <label>
                                Pincode
                            </label>

                            <input
                                type="text"
                                name="pincode"
                                value={
                                    formData.pincode
                                }
                                onChange={
                                    handleChange
                                }
                            />
                        </div>


                        {/* Qualification */}

                        <div className="management-form-group">
                            <label>
                                Qualification
                            </label>

                            <input
                                type="text"
                                name="qualification"
                                value={
                                    formData.qualification
                                }
                                onChange={
                                    handleChange
                                }
                            />
                        </div>


                        {/* Computer Skill */}

                        <div className="management-form-group">
                            <label>
                                Computer Skill
                            </label>

                            <label className="management-checkbox-row">
                                <input
                                    type="checkbox"
                                    name="computerSkill"
                                    checked={
                                        formData.computerSkill
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                                Has computer skills
                            </label>
                        </div>


                        {/* Aadhaar */}

                        <div className="management-form-group">
                            <label>
                                Aadhaar Number{" "}
                                {!editingEmployee && "*"}
                            </label>

                            {editingEmployee && currentMaskedAadhaar && (
                                <div className="management-info-box">
                                    Current Aadhaar:{" "}
                                    <strong>{currentMaskedAadhaar}</strong>
                                </div>
                            )}

                            <input
                                type="text"
                                name="aadhaarNumber"
                                value={formData.aadhaarNumber}
                                onChange={handleChange}
                                placeholder={
                                    editingEmployee
                                        ? "Enter new Aadhaar only if you want to change it"
                                        : "Enter Aadhaar number"
                                }
                                required={!editingEmployee}
                            />
                        </div>


                        {/* PAN */}

                        <div className="management-form-group">
                            <label>
                                PAN Number
                            </label>

                            {editingEmployee && currentPan && (
                                <div className="management-info-box">
                                    Current PAN:{" "}
                                    <strong>{currentPan}</strong>
                                </div>
                            )}

                            <input
                                type="text"
                                name="panNumber"
                                value={formData.panNumber}
                                onChange={handleChange}
                                placeholder={
                                    editingEmployee
                                        ? "Enter new PAN only if you want to change it"
                                        : "Enter PAN number"
                                }
                            />
                        </div>


                        {/* Duty Start */}

                        <div className="management-form-group">
                            <label>
                                Duty Start Time *
                            </label>

                            <input
                                type="time"
                                name="dutyStartTime"
                                value={
                                    formData.dutyStartTime
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />
                        </div>


                        {/* Duty End */}

                        <div className="management-form-group">
                            <label>
                                Duty End Time *
                            </label>

                            <input
                                type="time"
                                name="dutyEndTime"
                                value={
                                    formData.dutyEndTime
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />
                        </div>


                        {/* Joining Date */}

                        <div className="management-form-group">
                            <label>
                                Joining Date *
                            </label>

                            <input
                                type="date"
                                name="joiningDate"
                                value={
                                    formData.joiningDate
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />
                        </div>


                        <div className="management-form-actions management-form-group-full">

                            <button
                                type="submit"
                                className="management-primary-button"
                                disabled={
                                    saving
                                }
                            >
                                {saving
                                    ? "Saving..."
                                    : editingEmployee
                                        ? "Update Employee"
                                        : "Create Employee"}
                            </button>

                            <button
                                type="button"
                                className="management-secondary-button"
                                onClick={
                                    closeForm
                                }
                                disabled={
                                    saving
                                }
                            >
                                Cancel
                            </button>

                        </div>

                    </form>
                </section>
            )}


            {/* =================================================
                EMPLOYEE LIST
            ================================================= */}

            <section className="dashboard-panel">

                <div className="dashboard-panel-header">
                    <div>
                        <h3>
                            Employee List
                        </h3>

                        <p>
                            {employees.length} employee
                            {employees.length !==
                                1
                                ? "s"
                                : ""}{" "}
                            found.
                        </p>
                    </div>


                    <input
                        type="search"
                        placeholder="Search employee..."
                        value={
                            searchText
                        }
                        onChange={(
                            event
                        ) =>
                            setSearchText(
                                event.target
                                    .value
                            )
                        }
                        className="management-search-input"
                    />
                </div>


                {loading ? (
                    <p>
                        Loading employees...
                    </p>
                ) : filteredEmployees.length ===
                    0 ? (
                    <div className="management-empty-state">
                        No employees found.
                    </div>
                ) : (
                    <div className="management-table-wrapper">

                        <table className="management-table">

                            <thead>
                                <tr>
                                    <th>
                                        Employee Code
                                    </th>

                                    <th>
                                        Name
                                    </th>

                                    <th>
                                        Phone
                                    </th>

                                    {isSuperAdmin && (
                                        <th>
                                            Branch
                                        </th>
                                    )}

                                    <th>
                                        Department
                                    </th>

                                    <th>
                                        Designation
                                    </th>

                                    <th>
                                        Duty Time
                                    </th>

                                    <th>
                                        Status
                                    </th>

                                    <th>
                                        Actions
                                    </th>
                                </tr>
                            </thead>


                            <tbody>
                                {filteredEmployees.map(
                                    (
                                        employee
                                    ) => (
                                        <tr
                                            key={
                                                employee.id
                                            }
                                        >
                                            <td>
                                                <strong>
                                                    {
                                                        employee.employeeCode
                                                    }
                                                </strong>
                                            </td>

                                            <td>
                                                {
                                                    employee.fullName
                                                }
                                            </td>

                                            <td>
                                                {
                                                    employee.phone
                                                }
                                            </td>

                                            {isSuperAdmin && (
                                                <td>
                                                    {
                                                        employee.branchName ||
                                                        "-"
                                                    }
                                                </td>
                                            )}

                                            <td>
                                                {
                                                    employee.departmentName ||
                                                    "-"
                                                }
                                            </td>

                                            <td>
                                                {
                                                    employee.designation ||
                                                    "-"
                                                }
                                            </td>

                                            <td>
                                                {employee.dutyStartTime
                                                    ? String(
                                                        employee.dutyStartTime
                                                    ).slice(
                                                        0,
                                                        5
                                                    )
                                                    : "-"}

                                                {" - "}

                                                {employee.dutyEndTime
                                                    ? String(
                                                        employee.dutyEndTime
                                                    ).slice(
                                                        0,
                                                        5
                                                    )
                                                    : "-"}
                                            </td>

                                            <td>
                                                <span
                                                    className={`management-status-badge ${employee.accountStatus ===
                                                            "ACTIVE"
                                                            ? "active"
                                                            : "inactive"
                                                        }`}
                                                >
                                                    {
                                                        employee.accountStatus
                                                    }
                                                </span>
                                            </td>

                                            <td>
                                                <div className="management-table-actions">

                                                    <button
                                                        type="button"
                                                        className="management-action-button"
                                                        onClick={() =>
                                                            openEditForm(
                                                                employee.id
                                                            )
                                                        }
                                                    >
                                                        Edit
                                                    </button>


                                                    <button
                                                        type="button"
                                                        className="management-action-button"
                                                        onClick={() =>
                                                            handleStatusChange(
                                                                employee
                                                            )
                                                        }
                                                    >
                                                        {employee.accountStatus ===
                                                            "ACTIVE"
                                                            ? "Deactivate"
                                                            : "Activate"}
                                                    </button>


                                                    {isSuperAdmin && (
                                                        <button
                                                            type="button"
                                                            className="management-action-button"
                                                            onClick={() =>
                                                                handleTransfer(
                                                                    employee
                                                                )
                                                            }
                                                        >
                                                            Transfer
                                                        </button>
                                                    )}

                                                </div>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>

                        </table>

                    </div>
                )}

            </section>

        </ManagementLayout>
    );
}


export default Employees;
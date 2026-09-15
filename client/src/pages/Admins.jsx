import React, { useEffect, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";

import {
    getAdmins,
    createAdmin,
    updateAdminStatus,
    getAdminById,
    updateAdmin,
    getBranches,
    getDepartments,
    getAdminApprovalRequests,
    reviewAdminApprovalRequest,
    resetAdminPassword,
} from "../services/api";

const initialForm = {
    fullName: "",
    phone: "",
    email: "",
    password: "",
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

const Admins = () => {
    const [admins, setAdmins] = useState([]);
    const [branches, setBranches] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [approvalRequests, setApprovalRequests] = useState([]);

    const [formData, setFormData] =
        useState(initialForm);

    const [showForm, setShowForm] =
        useState(false);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    const [editingAdmin, setEditingAdmin] =
        useState(null);

    const [
        reviewingRequestId,
        setReviewingRequestId,
    ] = useState(null);

    const [resettingAdmin, setResettingAdmin] = useState(null);
    const [resetPasswordData, setResetPasswordData] = useState({
        newPassword: "",
        confirmPassword: "",
    });
    const [resetPasswordError, setResetPasswordError] = useState("");
    const [resettingPassword, setResettingPassword] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            setError("");

            const [
                adminsResponse,
                branchesResponse,
                departmentsResponse,
                approvalsResponse,
            ] = await Promise.all([
                getAdmins(),
                getBranches(),
                getDepartments(),
                getAdminApprovalRequests(),
            ]);

            setAdmins(
                adminsResponse.admins || []
            );

            setBranches(
                (
                    branchesResponse.branches ||
                    []
                ).filter(
                    (branch) =>
                        branch.status === "ACTIVE"
                )
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

            setApprovalRequests(
                approvalsResponse.requests || []
            );
        } catch (err) {
            setError(
                err.message ||
                "Failed to load admin data"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleChange = (e) => {
        const {
            name,
            value,
            type,
            checked,
        } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]:
                type === "checkbox"
                    ? checked
                    : value,
        }));
    };

    const openAddForm = () => {
        setEditingAdmin(null);
        setFormData(initialForm);
        setShowForm(true);
    };

    const closeForm = () => {
        setFormData(initialForm);
        setEditingAdmin(null);
        setShowForm(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);

            const payload = {
                fullName:
                    formData.fullName.trim(),

                phone:
                    formData.phone.trim(),

                email:
                    formData.email.trim() || null,

                branchId: Number(
                    formData.branchId
                ),

                departmentId: Number(
                    formData.departmentId
                ),

                designation:
                    formData.designation.trim(),

                address:
                    formData.address.trim(),

                pincode:
                    formData.pincode.trim(),

                qualification:
                    formData.qualification.trim(),

                computerSkill:
                    formData.computerSkill,

                aadhaarNumber:
                    formData.aadhaarNumber.trim(),

                panNumber:
                    formData.panNumber.trim(),

                dutyStartTime:
                    formData.dutyStartTime,

                dutyEndTime:
                    formData.dutyEndTime,

                joiningDate:
                    formData.joiningDate,
            };

            if (editingAdmin) {
                await updateAdmin(
                    editingAdmin.id,
                    payload
                );

                alert(
                    "Admin updated successfully"
                );
            } else {
                await createAdmin({
                    ...payload,
                    password:
                        formData.password,
                });

                alert(
                    "Admin created successfully"
                );
            }

            closeForm();
            await loadData();
        } catch (err) {
            alert(
                err.message ||
                "Failed to save admin"
            );
        } finally {
            setSaving(false);
        }
    };

    const openEditForm = async (admin) => {
        try {
            const response =
                await getAdminById(
                    admin.id
                );

            const details =
                response.admin;

            setEditingAdmin(details);

            setFormData({
                fullName:
                    details.fullName || "",

                phone:
                    details.phone || "",

                email:
                    details.email || "",

                password: "",

                branchId:
                    details.branchId || "",

                departmentId:
                    details.departmentId || "",

                designation:
                    details.designation || "",

                address:
                    details.address || "",

                pincode:
                    details.pincode || "",

                qualification:
                    details.qualification || "",

                computerSkill:
                    Boolean(
                        details.computerSkill
                    ),

                aadhaarNumber: "",

                panNumber: "",

                dutyStartTime:
                    details.dutyStartTime
                        ? String(
                            details.dutyStartTime
                        ).slice(0, 5)
                        : "",

                dutyEndTime:
                    details.dutyEndTime
                        ? String(
                            details.dutyEndTime
                        ).slice(0, 5)
                        : "",

                joiningDate:
                    details.joiningDate
                        ? String(
                            details.joiningDate
                        ).slice(0, 10)
                        : "",
            });

            setShowForm(true);
        } catch (err) {
            alert(
                err.message ||
                "Failed to load admin details"
            );
        }
    };

    const handleStatusChange = async (
        admin
    ) => {
        if (
            admin.accountStatus !== "ACTIVE" &&
            admin.accountStatus !== "INACTIVE"
        ) {
            alert(
                "Pending or rejected Admins must be handled through the approval workflow"
            );

            return;
        }

        const nextStatus =
            admin.accountStatus === "ACTIVE"
                ? "INACTIVE"
                : "ACTIVE";

        const confirmed =
            window.confirm(
                `Mark ${admin.fullName} as ${nextStatus}?`
            );

        if (!confirmed) return;

        try {
            await updateAdminStatus(
                admin.id,
                nextStatus
            );

            await loadData();
        } catch (err) {
            alert(
                err.message ||
                "Failed to update admin status"
            );
        }
    };

    const handleApprovalReview = async (
        request,
        action
    ) => {
        const actionText =
            action === "APPROVE"
                ? "approve"
                : "reject";

        const confirmed =
            window.confirm(
                `Are you sure you want to ${actionText} ${request.fullName}?`
            );

        if (!confirmed) return;

        let reviewNote = "";

        if (action === "REJECT") {
            reviewNote =
                window.prompt(
                    "Enter rejection reason (optional):"
                ) || "";
        }

        try {
            setReviewingRequestId(
                request.id
            );

            await reviewAdminApprovalRequest(
                request.id,
                action,
                reviewNote
            );

            alert(
                action === "APPROVE"
                    ? "Admin approved successfully"
                    : "Admin rejected successfully"
            );

            await loadData();
        } catch (err) {
            alert(
                err.message ||
                "Failed to review admin request"
            );
        } finally {
            setReviewingRequestId(
                null
            );
        }
    };

    const openResetPasswordForm = (admin) => {
        setResettingAdmin(admin);
        setResetPasswordData({ newPassword: "", confirmPassword: "" });
        setResetPasswordError("");
    };

    const closeResetPasswordForm = () => {
        setResettingAdmin(null);
        setResetPasswordData({ newPassword: "", confirmPassword: "" });
        setResetPasswordError("");
    };

    const handleResetPasswordChange = (event) => {
        const { name, value } = event.target;
        setResetPasswordData((current) => ({
            ...current,
            [name]: value,
        }));
    };

    const handleResetPassword = async (event) => {
        event.preventDefault();
        setResetPasswordError("");

        if (!resetPasswordData.newPassword || !resetPasswordData.confirmPassword) {
            setResetPasswordError("New password and confirmation are required.");
            return;
        }

        if (resetPasswordData.newPassword.length < 8) {
            setResetPasswordError("New password must be at least 8 characters.");
            return;
        }

        if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
            setResetPasswordError("New password and confirmation do not match.");
            return;
        }

        try {
            setResettingPassword(true);
            await resetAdminPassword(resettingAdmin.id, resetPasswordData);
            window.alert("Admin password reset successfully.");
            closeResetPasswordForm();
        } catch (err) {
            setResetPasswordError(err.message || "Failed to reset admin password.");
        } finally {
            setResettingPassword(false);
        }
    };

    const pendingApprovalRequests =
        approvalRequests.filter(
            (request) =>
                request.status === "PENDING"
        );

    const getStatusClassName = (
        status
    ) => {
        if (status === "ACTIVE") {
            return "status-badge status-active";
        }

        return "status-badge status-inactive";
    };

    return (
        <ManagementLayout>

            <section className="dashboard-welcome-section">
                <div>
                    <span className="dashboard-eyebrow">
                        ADMIN MANAGEMENT
                    </span>

                    <h2>Admins</h2>

                    <p>
                        Manage branch administrators
                        and their access.
                    </p>
                </div>

                <button
                    className="primary-action-btn"
                    onClick={openAddForm}
                >
                    + Add Admin
                </button>
            </section>

            {error && (
                <div className="dashboard-panel">
                    {error}
                </div>
            )}

            {showForm && (
                <section className="dashboard-panel">

                    <div className="dashboard-panel-header">
                        <div>
                            <h3>
                                {editingAdmin
                                    ? "Edit Admin"
                                    : "Add New Admin"}
                            </h3>

                            <p>
                                {editingAdmin
                                    ? "Update administrator details or transfer the admin to another branch."
                                    : "Create an administrator and assign a branch."}
                            </p>
                        </div>
                    </div>

                    <form
                        className="management-form-grid"
                        onSubmit={
                            handleSubmit
                        }
                    >

                        <div className="management-form-group">
                            <label>
                                Full Name *
                            </label>

                            <input
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

                        <div className="management-form-group">
                            <label>
                                Phone *
                            </label>

                            <input
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

                        {!editingAdmin && (
                            <div className="management-form-group">
                                <label>
                                    Management Password *
                                </label>

                                <input
                                    type="password"
                                    name="password"
                                    value={
                                        formData.password
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    minLength="8"
                                    required
                                />
                            </div>
                        )}

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
                                    (branch) => (
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

                        <div className="management-form-group">
                            <label>
                                Designation *
                            </label>

                            <input
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

                        <div className="management-form-group full-width">
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

                        <div className="management-form-group">
                            <label>
                                Pincode
                            </label>

                            <input
                                name="pincode"
                                value={
                                    formData.pincode
                                }
                                onChange={
                                    handleChange
                                }
                            />
                        </div>

                        <div className="management-form-group">
                            <label>
                                Qualification
                            </label>

                            <input
                                name="qualification"
                                value={
                                    formData.qualification
                                }
                                onChange={
                                    handleChange
                                }
                            />
                        </div>

                        <div className="management-form-group">
                            <label>
                                Aadhaar Number
                                {!editingAdmin &&
                                    " *"}
                            </label>

                            {editingAdmin
                                ?.aadhaarMasked && (
                                    <small>
                                        Current:{" "}
                                        {
                                            editingAdmin.aadhaarMasked
                                        }
                                    </small>
                                )}

                            <input
                                name="aadhaarNumber"
                                value={
                                    formData.aadhaarNumber
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder={
                                    editingAdmin
                                        ? "Leave blank to keep existing Aadhaar"
                                        : ""
                                }
                                required={
                                    !editingAdmin
                                }
                            />
                        </div>

                        <div className="management-form-group">
                            <label>
                                PAN Number
                            </label>

                            {editingAdmin
                                ?.panMasked && (
                                    <small>
                                        Current:{" "}
                                        {
                                            editingAdmin.panMasked
                                        }
                                    </small>
                                )}

                            <input
                                name="panNumber"
                                value={
                                    formData.panNumber
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder={
                                    editingAdmin
                                        ? "Leave blank to keep existing PAN"
                                        : ""
                                }
                            />
                        </div>

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

                        <div className="management-form-group">
                            <label>
                                Computer Skill
                            </label>

                            <label>
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

                                {" "}Yes
                            </label>
                        </div>

                        <div className="management-form-actions full-width">

                            <button
                                type="button"
                                className="secondary-action-btn"
                                onClick={
                                    closeForm
                                }
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="primary-action-btn"
                                disabled={
                                    saving
                                }
                            >
                                {saving
                                    ? "Saving..."
                                    : editingAdmin
                                        ? "Update Admin"
                                        : "Create Admin"}
                            </button>

                        </div>

                    </form>

                </section>
            )}

            {resettingAdmin && (
                <div className="management-modal-backdrop" role="presentation">
                    <section
                        className="management-password-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reset-password-title"
                    >
                        <div className="dashboard-panel-header">
                            <div>
                                <h3 id="reset-password-title">Reset Password</h3>
                                <p>
                                    Reset the password for {resettingAdmin.fullName}.
                                    Existing passwords cannot be viewed. You can securely reset the Admin&apos;s password.
                                </p>
                            </div>
                        </div>

                        <form className="management-password-form" onSubmit={handleResetPassword}>
                            <label>
                                New Password
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={resetPasswordData.newPassword}
                                    onChange={handleResetPasswordChange}
                                    autoComplete="new-password"
                                    minLength="8"
                                    required
                                />
                            </label>

                            <label>
                                Confirm New Password
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={resetPasswordData.confirmPassword}
                                    onChange={handleResetPasswordChange}
                                    autoComplete="new-password"
                                    minLength="8"
                                    required
                                />
                            </label>

                            {resetPasswordError && (
                                <p className="management-form-error" role="alert">{resetPasswordError}</p>
                            )}

                            <div className="management-form-actions">
                                <button type="button" className="secondary-action-btn" onClick={closeResetPasswordForm} disabled={resettingPassword}>
                                    Cancel
                                </button>
                                <button type="submit" className="primary-action-btn" disabled={resettingPassword}>
                                    {resettingPassword ? "Resetting..." : "Reset Password"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            <section className="dashboard-panel">

                <div className="dashboard-panel-header">
                    <div>
                        <h3>
                            Pending Admin Approvals
                        </h3>

                        <p>
                            Review Admin accounts
                            requested by branch
                            administrators.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <p>
                        Loading approval
                        requests...
                    </p>
                ) : pendingApprovalRequests.length ===
                    0 ? (
                    <p>
                        No pending admin
                        approvals.
                    </p>
                ) : (
                    <div className="management-table-wrapper">

                        <table className="management-table">

                            <thead>
                                <tr>
                                    <th>
                                        Code
                                    </th>

                                    <th>
                                        Name
                                    </th>

                                    <th>
                                        Requested By
                                    </th>

                                    <th>
                                        Branch
                                    </th>

                                    <th>
                                        Department
                                    </th>

                                    <th>
                                        Designation
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
                                {pendingApprovalRequests.map(
                                    (
                                        request
                                    ) => (
                                        <tr
                                            key={
                                                request.id
                                            }
                                        >

                                            <td>
                                                {
                                                    request.employeeCode
                                                }
                                            </td>

                                            <td>
                                                {
                                                    request.fullName
                                                }
                                            </td>

                                            <td>
                                                {
                                                    request.requestedByName ||
                                                    "-"
                                                }
                                            </td>

                                            <td>
                                                {
                                                    request.branchName ||
                                                    "-"
                                                }
                                            </td>

                                            <td>
                                                {
                                                    request.departmentName ||
                                                    "-"
                                                }
                                            </td>

                                            <td>
                                                {
                                                    request.designation ||
                                                    "-"
                                                }
                                            </td>

                                            <td>
                                                <span className="status-badge status-inactive">
                                                    PENDING
                                                </span>
                                            </td>

                                            <td>
                                                <div className="table-action-group">

                                                    <button
                                                        disabled={
                                                            reviewingRequestId ===
                                                            request.id
                                                        }
                                                        onClick={() =>
                                                            handleApprovalReview(
                                                                request,
                                                                "APPROVE"
                                                            )
                                                        }
                                                    >
                                                        {reviewingRequestId ===
                                                            request.id
                                                            ? "Processing..."
                                                            : "Approve"}
                                                    </button>

                                                    <button
                                                        disabled={
                                                            reviewingRequestId ===
                                                            request.id
                                                        }
                                                        onClick={() =>
                                                            handleApprovalReview(
                                                                request,
                                                                "REJECT"
                                                            )
                                                        }
                                                    >
                                                        Reject
                                                    </button>

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

            <section className="dashboard-panel">

                <div className="dashboard-panel-header">
                    <div>
                        <h3>
                            Registered Admins
                        </h3>

                        <p>
                            Branch administrators
                            configured in WorkPulse.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <p>
                        Loading admins...
                    </p>
                ) : admins.length === 0 ? (
                    <p>
                        No admins found.
                    </p>
                ) : (
                    <div className="management-table-wrapper">

                        <table className="management-table">

                            <thead>
                                <tr>
                                    <th>
                                        Code
                                    </th>

                                    <th>
                                        Name
                                    </th>

                                    <th>
                                        Phone
                                    </th>

                                    <th>
                                        Branch
                                    </th>

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
                                {admins.map(
                                    (admin) => (
                                        <tr
                                            key={
                                                admin.id
                                            }
                                        >

                                            <td>
                                                {
                                                    admin.employeeCode
                                                }
                                            </td>

                                            <td>
                                                {
                                                    admin.fullName
                                                }
                                            </td>

                                            <td>
                                                {
                                                    admin.phone
                                                }
                                            </td>

                                            <td>
                                                {
                                                    admin.branchName ||
                                                    "-"
                                                }
                                            </td>

                                            <td>
                                                {
                                                    admin.departmentName ||
                                                    "-"
                                                }
                                            </td>

                                            <td>
                                                {
                                                    admin.designation ||
                                                    "-"
                                                }
                                            </td>

                                            <td>
                                                {
                                                    admin.dutyStartTime
                                                }
                                                {" - "}
                                                {
                                                    admin.dutyEndTime
                                                }
                                            </td>

                                            <td>
                                                <span
                                                    className={getStatusClassName(
                                                        admin.accountStatus
                                                    )}
                                                >
                                                    {
                                                        admin.accountStatus
                                                    }
                                                </span>
                                            </td>

                                            <td>
                                                <div className="table-action-group">

                                                    <button
                                                        onClick={() =>
                                                            openEditForm(
                                                                admin
                                                            )
                                                        }
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        onClick={() => openResetPasswordForm(admin)}
                                                    >
                                                        Reset Password
                                                    </button>

                                                    {admin.accountStatus ===
                                                        "ACTIVE" && (
                                                            <button
                                                                onClick={() =>
                                                                    handleStatusChange(
                                                                        admin
                                                                    )
                                                                }
                                                            >
                                                                Deactivate
                                                            </button>
                                                        )}

                                                    {admin.accountStatus ===
                                                        "INACTIVE" && (
                                                            <button
                                                                onClick={() =>
                                                                    handleStatusChange(
                                                                        admin
                                                                    )
                                                                }
                                                            >
                                                                Activate
                                                            </button>
                                                        )}

                                                    {admin.accountStatus ===
                                                        "PENDING_APPROVAL" && (
                                                            <span>
                                                                Awaiting
                                                                Approval
                                                            </span>
                                                        )}

                                                    {admin.accountStatus ===
                                                        "REJECTED" && (
                                                            <span>
                                                                Rejected
                                                            </span>
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
};

export default Admins;

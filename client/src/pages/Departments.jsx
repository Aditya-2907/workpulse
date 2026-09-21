import React, { useEffect, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";

import {
    getDepartments,
    createDepartment,
    updateDepartment,
    updateDepartmentStatus,
} from "../services/api";

const Departments = () => {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingDepartment, setEditingDepartment] =
        useState(null);

    const [departmentName, setDepartmentName] =
        useState("");

    const [saving, setSaving] = useState(false);

    const loadDepartments = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await getDepartments();

            setDepartments(response.departments || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDepartments();
    }, []);

    const openAddForm = () => {
        setEditingDepartment(null);
        setDepartmentName("");
        setShowForm(true);
    };

    const openEditForm = (department) => {
        setEditingDepartment(department);
        setDepartmentName(
            department.departmentName || ""
        );
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingDepartment(null);
        setDepartmentName("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanName = departmentName.trim();

        if (!cleanName) {
            alert("Department name is required");
            return;
        }

        try {
            setSaving(true);

            if (editingDepartment) {
                await updateDepartment(
                    editingDepartment.id,
                    cleanName
                );
            } else {
                await createDepartment(cleanName);
            }

            closeForm();
            await loadDepartments();
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (
        department
    ) => {
        const nextStatus =
            department.status === "ACTIVE"
                ? "INACTIVE"
                : "ACTIVE";

        const confirmed = window.confirm(
            `Mark ${department.departmentName} as ${nextStatus}?`
        );

        if (!confirmed) return;

        try {
            await updateDepartmentStatus(
                department.id,
                nextStatus
            );

            await loadDepartments();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <ManagementLayout>
            <section className="dashboard-welcome-section">
                <div>
                    <span className="dashboard-eyebrow">
                        DEPARTMENT MANAGEMENT
                    </span>

                    <h2>Departments</h2>

                    <p>
                        Manage organization-wide departments
                        used for employee assignment.
                    </p>
                </div>

                <button
                    className="primary-action-btn"
                    onClick={openAddForm}
                >
                    + Add Department
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
                                {editingDepartment
                                    ? "Edit Department"
                                    : "Add Department"}
                            </h3>

                            <p>
                                Enter the department name.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="management-form-grid"
                    >
                        <div className="management-form-group">
                            <label>Department Code</label>

                            <input
                                type="text"
                                value={
                                    editingDepartment
                                        ? editingDepartment.departmentCode
                                        : "Assigned automatically"
                                }
                                readOnly
                                aria-describedby="department-code-help"
                            />

                            <small id="department-code-help">
                                {editingDepartment
                                    ? "Department codes are assigned automatically and cannot be changed."
                                    : "WorkPulse will assign the next available department code when you create this department."}
                            </small>
                        </div>

                        <div className="management-form-group full-width">
                            <label>
                                Department Name
                            </label>

                            <input
                                type="text"
                                value={departmentName}
                                onChange={(e) =>
                                    setDepartmentName(
                                        e.target.value
                                    )
                                }
                                placeholder="e.g. Human Resources"
                                required
                            />
                        </div>

                        <div className="management-form-actions full-width">
                            <button
                                type="button"
                                className="secondary-action-btn"
                                onClick={closeForm}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="primary-action-btn"
                                disabled={saving}
                            >
                                {saving
                                    ? "Saving..."
                                    : editingDepartment
                                        ? "Update Department"
                                        : "Create Department"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h3>
                            Registered Departments
                        </h3>

                        <p>
                            All departments configured in
                            WorkPulse.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <p>Loading departments...</p>
                ) : departments.length === 0 ? (
                    <p>No departments found.</p>
                ) : (
                    <div className="management-table-wrapper">
                        <table className="management-table">
                            <thead>
                                <tr>
                                    <th>Department Code</th>
                                    <th>Department Name</th>
                                    <th>Status</th>
                                    <th>Created At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {departments.map(
                                    (department) => (
                                        <tr
                                            key={
                                                department.id
                                            }
                                        >
                                            <td>
                                                <strong>
                                                    {department.departmentCode || "-"}
                                                </strong>
                                            </td>

                                            <td>
                                                {
                                                    department.departmentName
                                                }
                                            </td>

                                            <td>
                                                <span
                                                    className={
                                                        department.status ===
                                                            "ACTIVE"
                                                            ? "status-badge status-active"
                                                            : "status-badge status-inactive"
                                                    }
                                                >
                                                    {
                                                        department.status
                                                    }
                                                </span>
                                            </td>

                                            <td>
                                                {department.createdAt
                                                    ? new Date(
                                                        department.createdAt
                                                    ).toLocaleDateString()
                                                    : "-"}
                                            </td>

                                            <td>
                                                <div className="table-action-group">
                                                    <button
                                                        onClick={() =>
                                                            openEditForm(
                                                                department
                                                            )
                                                        }
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        onClick={() =>
                                                            handleStatusChange(
                                                                department
                                                            )
                                                        }
                                                    >
                                                        {department.status ===
                                                            "ACTIVE"
                                                            ? "Deactivate"
                                                            : "Activate"}
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
        </ManagementLayout>
    );
};

export default Departments;

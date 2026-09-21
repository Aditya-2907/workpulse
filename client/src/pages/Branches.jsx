import React, { useEffect, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";

import {
    getBranches,
    createBranch,
    updateBranch,
    updateBranchStatus,
} from "../services/api";

// Start Aditya - Weekly off options
const WEEKDAYS = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
];
// End Aditya

const initialForm = {
    branchName: "",
    address: "",
    pincode: "",
    latitude: "",
    longitude: "",

    // Start Aditya - Weekly off
    weeklyOffs: [],
    // End Aditya
};

const Branches = () => {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingBranch, setEditingBranch] =
        useState(null);

    const [formData, setFormData] =
        useState(initialForm);

    const [saving, setSaving] = useState(false);

    const loadBranches = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await getBranches();

            setBranches(response.branches || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBranches();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // Start Aditya - Weekly off checkbox handler
    const handleWeeklyOffChange = (weekday) => {
        setFormData((prev) => {
            const alreadySelected =
                prev.weeklyOffs.includes(weekday);

            return {
                ...prev,
                weeklyOffs: alreadySelected
                    ? prev.weeklyOffs.filter(
                        (day) => day !== weekday
                    )
                    : [...prev.weeklyOffs, weekday],
            };
        });
    };
    // End Aditya

    const openAddForm = () => {
        setEditingBranch(null);

        setFormData({
            ...initialForm,
            weeklyOffs: [],
        });

        setShowForm(true);
    };

    const openEditForm = (branch) => {
        setEditingBranch(branch);

        setFormData({
            branchName: branch.branchName || "",
            address: branch.address || "",
            pincode: branch.pincode || "",
            latitude: branch.latitude || "",
            longitude: branch.longitude || "",

            // Start Aditya - Load existing weekly offs
            weeklyOffs: Array.isArray(
                branch.weeklyOffs
            )
                ? [...branch.weeklyOffs]
                : [],
            // End Aditya
        });

        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingBranch(null);

        setFormData({
            ...initialForm,
            weeklyOffs: [],
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);

            const payload = {
                branchName:
                    formData.branchName.trim(),

                address:
                    formData.address.trim(),

                pincode:
                    formData.pincode.trim(),

                latitude:
                    Number(formData.latitude),

                longitude:
                    Number(formData.longitude),

                // Start Aditya - Send weekly offs
                weeklyOffs:
                    formData.weeklyOffs,
                // End Aditya
            };

            if (editingBranch) {
                await updateBranch(
                    editingBranch.id,
                    payload
                );
            } else {
                await createBranch(payload);
            }

            closeForm();
            await loadBranches();
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (
        branch
    ) => {
        const nextStatus =
            branch.status === "ACTIVE"
                ? "INACTIVE"
                : "ACTIVE";

        const confirmed = window.confirm(
            `Mark ${branch.branchName} as ${nextStatus}?`
        );

        if (!confirmed) return;

        try {
            await updateBranchStatus(
                branch.id,
                nextStatus
            );

            await loadBranches();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <ManagementLayout>
            <section className="dashboard-welcome-section">
                <div>
                    <span className="dashboard-eyebrow">
                        BRANCH MANAGEMENT
                    </span>

                    <h2>Branches</h2>

                    <p>
                        Manage office branches,
                        attendance locations and
                        weekly offs.
                    </p>
                </div>

                <button
                    className="primary-action-btn"
                    onClick={openAddForm}
                >
                    + Add Branch
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
                                {editingBranch
                                    ? "Edit Branch"
                                    : "Add Branch"}
                            </h3>

                            <p>
                                Enter branch details,
                                attendance coordinates and
                                weekly off days.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="management-form-grid"
                    >
                        <div className="management-form-group">
                            <label>
                                Branch Code
                            </label>

                            <input
                                type="text"
                                value={
                                    editingBranch
                                        ? editingBranch.branchCode
                                        : "Assigned automatically"
                                }
                                readOnly
                                aria-describedby="branch-code-help"
                            />

                            <small id="branch-code-help">
                                {editingBranch
                                    ? "Branch codes are assigned automatically and cannot be changed."
                                    : "WorkPulse will assign the next available branch code when you create this branch."}
                            </small>
                        </div>

                        <div className="management-form-group">
                            <label>
                                Branch Name
                            </label>

                            <input
                                type="text"
                                name="branchName"
                                value={
                                    formData.branchName
                                }
                                onChange={handleChange}
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
                                onChange={handleChange}
                                rows="3"
                                required
                            />
                        </div>

                        <div className="management-form-group">
                            <label>Pincode</label>

                            <input
                                type="text"
                                name="pincode"
                                value={
                                    formData.pincode
                                }
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="management-form-group">
                            <label>
                                Latitude
                            </label>

                            <input
                                type="number"
                                step="any"
                                name="latitude"
                                value={
                                    formData.latitude
                                }
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="management-form-group">
                            <label>
                                Longitude
                            </label>

                            <input
                                type="number"
                                step="any"
                                name="longitude"
                                value={
                                    formData.longitude
                                }
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* Start Aditya - Weekly off selection */}
                        <div className="management-form-group full-width">
                            <label>
                                Weekly Off
                            </label>

                            <p
                                style={{
                                    marginTop: "4px",
                                    marginBottom: "12px",
                                    fontSize: "13px",
                                    opacity: 0.7,
                                }}
                            >
                                Select one or more weekly
                                off days for this branch.
                            </p>

                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "12px",
                                }}
                            >
                                {WEEKDAYS.map(
                                    (weekday) => (
                                        <label
                                            key={weekday}
                                            style={{
                                                display:
                                                    "flex",
                                                alignItems:
                                                    "center",
                                                gap: "6px",
                                                cursor:
                                                    "pointer",
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.weeklyOffs.includes(
                                                    weekday
                                                )}
                                                onChange={() =>
                                                    handleWeeklyOffChange(
                                                        weekday
                                                    )
                                                }
                                            />

                                            <span>
                                                {weekday
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                    weekday
                                                        .slice(
                                                            1
                                                        )
                                                        .toLowerCase()}
                                            </span>
                                        </label>
                                    )
                                )}
                            </div>
                        </div>
                        {/* End Aditya */}

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
                                    : editingBranch
                                        ? "Update Branch"
                                        : "Create Branch"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h3>
                            Registered Branches
                        </h3>

                        <p>
                            All office locations configured
                            in WorkPulse.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <p>Loading branches...</p>
                ) : branches.length === 0 ? (
                    <p>No branches found.</p>
                ) : (
                    <div className="management-table-wrapper">
                        <table className="management-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Name</th>
                                    <th>Address</th>
                                    <th>Pincode</th>
                                    <th>Latitude</th>
                                    <th>Longitude</th>

                                    {/* Start Aditya */}
                                    <th>
                                        Weekly Off
                                    </th>
                                    {/* End Aditya */}

                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {branches.map(
                                    (branch) => (
                                        <tr key={branch.id}>
                                            <td>
                                                {
                                                    branch.branchCode
                                                }
                                            </td>

                                            <td>
                                                {
                                                    branch.branchName
                                                }
                                            </td>

                                            <td>
                                                {
                                                    branch.address
                                                }
                                            </td>

                                            <td>
                                                {
                                                    branch.pincode
                                                }
                                            </td>

                                            <td>
                                                {
                                                    branch.latitude
                                                }
                                            </td>

                                            <td>
                                                {
                                                    branch.longitude
                                                }
                                            </td>

                                            {/* Start Aditya - Display weekly offs */}
                                            <td>
                                                {Array.isArray(
                                                    branch.weeklyOffs
                                                ) &&
                                                    branch
                                                        .weeklyOffs
                                                        .length >
                                                    0
                                                    ? branch.weeklyOffs
                                                        .map(
                                                            (
                                                                day
                                                            ) =>
                                                                day
                                                                    .charAt(
                                                                        0
                                                                    )
                                                                    .toUpperCase() +
                                                                day
                                                                    .slice(
                                                                        1
                                                                    )
                                                                    .toLowerCase()
                                                        )
                                                        .join(
                                                            ", "
                                                        )
                                                    : "Not Set"}
                                            </td>
                                            {/* End Aditya */}

                                            <td>
                                                <span
                                                    className={
                                                        branch.status ===
                                                            "ACTIVE"
                                                            ? "status-badge status-active"
                                                            : "status-badge status-inactive"
                                                    }
                                                >
                                                    {
                                                        branch.status
                                                    }
                                                </span>
                                            </td>

                                            <td>
                                                <div className="table-action-group">
                                                    <button
                                                        onClick={() =>
                                                            openEditForm(
                                                                branch
                                                            )
                                                        }
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        onClick={() =>
                                                            handleStatusChange(
                                                                branch
                                                            )
                                                        }
                                                    >
                                                        {branch.status ===
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

export default Branches;

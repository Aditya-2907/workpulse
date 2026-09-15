import React, { useEffect, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";

import {
    getHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
} from "../services/api";

const Holidays = () => {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingHoliday, setEditingHoliday] =
        useState(null);

    const [holidayDate, setHolidayDate] = useState("");
    const [purpose, setPurpose] = useState("");

    const [saving, setSaving] = useState(false);

    const [filters, setFilters] = useState({
        startDate: "",
        endDate: "",
    });

    // ======================================================
    // LOAD HOLIDAYS
    // ======================================================

    const loadHolidays = async (
        customFilters = filters
    ) => {
        try {
            setLoading(true);
            setError("");

            const response =
                await getHolidays(customFilters);

            setHolidays(response.holidays || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHolidays({
            startDate: "",
            endDate: "",
        });
    }, []);

    // ======================================================
    // FORM
    // ======================================================

    const openAddForm = () => {
        setEditingHoliday(null);
        setHolidayDate("");
        setPurpose("");
        setShowForm(true);
    };

    const openEditForm = (holiday) => {
        setEditingHoliday(holiday);
        setHolidayDate(holiday.holidayDate || "");
        setPurpose(holiday.purpose || "");
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingHoliday(null);
        setHolidayDate("");
        setPurpose("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanPurpose = purpose.trim();

        if (!holidayDate) {
            alert("Holiday date is required");
            return;
        }

        if (!cleanPurpose) {
            alert("Holiday purpose is required");
            return;
        }

        try {
            setSaving(true);

            const holidayData = {
                holidayDate,
                purpose: cleanPurpose,
            };

            if (editingHoliday) {
                await updateHoliday(
                    editingHoliday.id,
                    holidayData
                );
            } else {
                await createHoliday(holidayData);
            }

            closeForm();

            await loadHolidays();
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    // ======================================================
    // DELETE
    // ======================================================

    const handleDelete = async (holiday) => {
        const confirmed = window.confirm(
            `Delete holiday "${holiday.purpose}" on ${formatDate(
                holiday.holidayDate
            )}?`
        );

        if (!confirmed) return;

        try {
            await deleteHoliday(holiday.id);
            await loadHolidays();
        } catch (err) {
            alert(err.message);
        }
    };

    // ======================================================
    // FILTERS
    // ======================================================

    const handleFilterChange = (e) => {
        const { name, value } = e.target;

        setFilters((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleApplyFilters = async (e) => {
        e.preventDefault();

        if (
            filters.startDate &&
            filters.endDate &&
            filters.startDate > filters.endDate
        ) {
            alert(
                "Start date cannot be after end date"
            );
            return;
        }

        await loadHolidays(filters);
    };

    const handleResetFilters = async () => {
        const emptyFilters = {
            startDate: "",
            endDate: "",
        };

        setFilters(emptyFilters);
        await loadHolidays(emptyFilters);
    };

    // ======================================================
    // DATE FORMAT
    // ======================================================

    const formatDate = (dateString) => {
        if (!dateString) return "-";

        const parts = dateString.split("-");

        if (parts.length !== 3) {
            return dateString;
        }

        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };

    const formatCreatedAt = (dateString) => {
        if (!dateString) return "-";

        return new Date(dateString).toLocaleString();
    };

    return (
        <ManagementLayout>
            {/* ==================================================
                PAGE HEADER
            ================================================== */}

            <section className="dashboard-welcome-section">
                <div>
                    <span className="dashboard-eyebrow">
                        HOLIDAY MANAGEMENT
                    </span>

                    <h2>Holidays</h2>

                    <p>
                        Manage organization-wide holidays
                        used for attendance calculation.
                    </p>
                </div>

                <button
                    className="primary-action-btn"
                    onClick={openAddForm}
                >
                    + Add Holiday
                </button>
            </section>

            {/* ==================================================
                ERROR
            ================================================== */}

            {error && (
                <div className="dashboard-panel">
                    {error}
                </div>
            )}

            {/* ==================================================
                ADD / EDIT FORM
            ================================================== */}

            {showForm && (
                <section className="dashboard-panel">
                    <div className="dashboard-panel-header">
                        <div>
                            <h3>
                                {editingHoliday
                                    ? "Edit Holiday"
                                    : "Add Holiday"}
                            </h3>

                            <p>
                                Enter the holiday date and
                                purpose.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="management-form-grid"
                    >
                        <div className="management-form-group">
                            <label>
                                Holiday Date
                            </label>

                            <input
                                type="date"
                                value={holidayDate}
                                onChange={(e) =>
                                    setHolidayDate(
                                        e.target.value
                                    )
                                }
                                required
                            />
                        </div>

                        <div className="management-form-group">
                            <label>
                                Purpose
                            </label>

                            <input
                                type="text"
                                value={purpose}
                                onChange={(e) =>
                                    setPurpose(
                                        e.target.value
                                    )
                                }
                                placeholder="e.g. Diwali"
                                maxLength={255}
                                required
                            />
                        </div>

                        <div className="management-form-actions full-width">
                            <button
                                type="button"
                                className="secondary-action-btn"
                                onClick={closeForm}
                                disabled={saving}
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
                                    : editingHoliday
                                        ? "Update Holiday"
                                        : "Create Holiday"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* ==================================================
                FILTERS
            ================================================== */}

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h3>Holiday Filters</h3>

                        <p>
                            Filter holidays using a date
                            range.
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={handleApplyFilters}
                    className="management-form-grid"
                >
                    <div className="management-form-group">
                        <label>Start Date</label>

                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={
                                handleFilterChange
                            }
                        />
                    </div>

                    <div className="management-form-group">
                        <label>End Date</label>

                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={
                                handleFilterChange
                            }
                        />
                    </div>

                    <div className="management-form-actions full-width">
                        <button
                            type="button"
                            className="secondary-action-btn"
                            onClick={handleResetFilters}
                        >
                            Reset
                        </button>

                        <button
                            type="submit"
                            className="primary-action-btn"
                        >
                            Apply Filters
                        </button>
                    </div>
                </form>
            </section>

            {/* ==================================================
                HOLIDAY LIST
            ================================================== */}

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h3>
                            Registered Holidays
                        </h3>

                        <p>
                            All organization-wide holidays
                            configured in WorkPulse.
                        </p>
                    </div>

                    {!loading && (
                        <span className="status-badge status-active">
                            {holidays.length} Holiday
                            {holidays.length === 1
                                ? ""
                                : "s"}
                        </span>
                    )}
                </div>

                {loading ? (
                    <p>Loading holidays...</p>
                ) : holidays.length === 0 ? (
                    <p>No holidays found.</p>
                ) : (
                    <div className="management-table-wrapper">
                        <table className="management-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Date</th>
                                    <th>Purpose</th>
                                    <th>
                                        Created By
                                    </th>
                                    <th>
                                        Created At
                                    </th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {holidays.map(
                                    (holiday) => (
                                        <tr
                                            key={
                                                holiday.id
                                            }
                                        >
                                            <td>
                                                {
                                                    holiday.id
                                                }
                                            </td>

                                            <td>
                                                <strong>
                                                    {formatDate(
                                                        holiday.holidayDate
                                                    )}
                                                </strong>
                                            </td>

                                            <td>
                                                {
                                                    holiday.purpose
                                                }
                                            </td>

                                            <td>
                                                {holiday.createdByName ||
                                                    "-"}
                                            </td>

                                            <td>
                                                {formatCreatedAt(
                                                    holiday.createdAt
                                                )}
                                            </td>

                                            <td>
                                                <div className="table-action-group">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openEditForm(
                                                                holiday
                                                            )
                                                        }
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleDelete(
                                                                holiday
                                                            )
                                                        }
                                                    >
                                                        Delete
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

export default Holidays;
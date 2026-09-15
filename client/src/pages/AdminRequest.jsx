import React, { useEffect, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";

import {
    requestAdminCreation,
    getDepartments,
} from "../services/api";

const initialForm = {
    fullName: "",
    phone: "",
    email: "",
    password: "",
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

const AdminRequest = () => {
    const [formData, setFormData] =
        useState(initialForm);

    const [departments, setDepartments] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    const loadDepartments = async () => {
        try {
            setLoading(true);
            setError("");

            const response =
                await getDepartments();

            setDepartments(
                (
                    response.departments ||
                    []
                ).filter(
                    (department) =>
                        department.status ===
                        "ACTIVE"
                )
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDepartments();
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

                password:
                    formData.password,

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

            const response =
                await requestAdminCreation(
                    payload
                );

            alert(
                response.message ||
                "Admin request submitted successfully"
            );

            setFormData(initialForm);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ManagementLayout>

            <section className="dashboard-welcome-section">
                <div>
                    <span className="dashboard-eyebrow">
                        ADMIN REQUEST
                    </span>

                    <h2>
                        Request New Admin
                    </h2>

                    <p>
                        Submit a new administrator
                        request for your assigned
                        branch.
                    </p>
                </div>
            </section>

            {error && (
                <div className="dashboard-panel">
                    {error}
                </div>
            )}

            <section className="dashboard-panel">

                <div className="dashboard-panel-header">
                    <div>
                        <h3>
                            New Admin Request
                        </h3>

                        <p>
                            The request will remain
                            pending until approved by
                            the Super Admin.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <p>
                        Loading departments...
                    </p>
                ) : (
                    <form
                        className="management-form-grid"
                        onSubmit={handleSubmit}
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
                                onChange={handleChange}
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
                                onChange={handleChange}
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
                                onChange={handleChange}
                            />
                        </div>

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
                                onChange={handleChange}
                                minLength="8"
                                required
                            />
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
                                onChange={handleChange}
                                required
                            >
                                <option value="">
                                    Select Department
                                </option>

                                {departments.map(
                                    (department) => (
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
                                onChange={handleChange}
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
                                onChange={handleChange}
                            />
                        </div>

                        <div className="management-form-group">
                            <label>
                                Aadhaar Number *
                            </label>

                            <input
                                name="aadhaarNumber"
                                value={
                                    formData.aadhaarNumber
                                }
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="management-form-group">
                            <label>
                                PAN Number
                            </label>

                            <input
                                name="panNumber"
                                value={
                                    formData.panNumber
                                }
                                onChange={handleChange}
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
                                onChange={handleChange}
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
                                onChange={handleChange}
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
                                onChange={handleChange}
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
                                type="submit"
                                className="primary-action-btn"
                                disabled={saving}
                            >
                                {saving
                                    ? "Submitting..."
                                    : "Submit Request"}
                            </button>

                        </div>

                    </form>
                )}

            </section>

        </ManagementLayout>
    );
};

export default AdminRequest;
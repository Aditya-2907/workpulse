import React, { useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";
import { requestAdminCreation } from "../services/api";

const initialForm = {
    fullName: "", phone: "", email: "", dateOfBirth: "", gender: "",
    address: "", pincode: "", aadhaarNumber: "", panNumber: "",
};

const AdminRequest = () => {
    const [formData, setFormData] = useState(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((current) => ({ ...current, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");
        try {
            setSaving(true);
            const response = await requestAdminCreation({
                fullName: formData.fullName.trim(), phone: formData.phone.trim(),
                email: formData.email.trim() || null, dateOfBirth: formData.dateOfBirth || null,
                gender: formData.gender || null, address: formData.address.trim() || null,
                pincode: formData.pincode.trim() || null,
                aadhaarNumber: formData.aadhaarNumber.trim(), panNumber: formData.panNumber.trim() || null,
            });
            setSuccess(response.message || "Admin access request submitted.");
            setFormData(initialForm);
        } catch (requestError) {
            setError(requestError.message || "Unable to submit the request.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <ManagementLayout>
            <section className="dashboard-welcome-section">
                <div>
                    <span className="dashboard-eyebrow">ADMIN ACCESS REQUEST</span>
                    <h2>Request access for an Admin candidate</h2>
                    <p>Submit only the candidate's identity and contact details. A Super Admin assigns organization access and a temporary password if the request is approved.</p>
                </div>
            </section>
            <section className="dashboard-panel">
                <div className="dashboard-panel-header"><div><h3>Candidate information</h3><p>This form does not assign a role, branch, department, designation, joining date, approval status, or password.</p></div></div>
                {error && <p className="management-form-error" role="alert">{error}</p>}
                {success && <p className="management-form-success" role="status">{success}</p>}
                <form className="management-form-grid" onSubmit={handleSubmit}>
                    <div className="management-form-group"><label htmlFor="request-admin-name">Full Name *</label><input id="request-admin-name" name="fullName" value={formData.fullName} onChange={handleChange} required /></div>
                    <div className="management-form-group"><label htmlFor="request-admin-phone">Phone *</label><input id="request-admin-phone" name="phone" value={formData.phone} onChange={handleChange} inputMode="tel" required /></div>
                    <div className="management-form-group"><label htmlFor="request-admin-email">Email</label><input id="request-admin-email" type="email" name="email" value={formData.email} onChange={handleChange} /></div>
                    <div className="management-form-group"><label htmlFor="request-admin-dob">Date of Birth</label><input id="request-admin-dob" type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} /></div>
                    <div className="management-form-group"><label htmlFor="request-admin-gender">Gender</label><select id="request-admin-gender" name="gender" value={formData.gender} onChange={handleChange}><option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="NON_BINARY">Non-binary</option><option value="PREFER_NOT_TO_SAY">Prefer not to say</option></select></div>
                    <div className="management-form-group"><label htmlFor="request-admin-pincode">Pincode</label><input id="request-admin-pincode" name="pincode" value={formData.pincode} onChange={handleChange} inputMode="numeric" /></div>
                    <div className="management-form-group"><label htmlFor="request-admin-aadhaar">Aadhaar Number *</label><input id="request-admin-aadhaar" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} required /></div>
                    <div className="management-form-group"><label htmlFor="request-admin-pan">PAN Number</label><input id="request-admin-pan" name="panNumber" value={formData.panNumber} onChange={handleChange} /></div>
                    <div className="management-form-group full-width"><label htmlFor="request-admin-address">Address</label><textarea id="request-admin-address" name="address" value={formData.address} onChange={handleChange} rows="3" /></div>
                    <div className="management-form-actions full-width"><button type="submit" className="primary-action-btn" disabled={saving}>{saving ? "Submitting…" : "Submit access request"}</button></div>
                </form>
            </section>
        </ManagementLayout>
    );
};

export default AdminRequest;

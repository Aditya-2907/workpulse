import { useEffect, useState } from "react";
import ManagementLayout from "../components/management/ManagementLayout";
import WorkPulseLogo from "../components/WorkPulseLogo";
import { getManagementProfile, updateManagementProfile } from "../services/api";

const editableValues = (profile) => ({
    phone: profile?.phone || "",
    email: profile?.email || "",
    address: profile?.address || "",
    pincode: profile?.pincode || "",
});

export default function Profile() {
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState(editableValues(null));
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const loadProfile = async () => {
            try {
                setLoading(true); setError("");
                const response = await getManagementProfile();
                setProfile(response.profile);
                setForm(editableValues(response.profile));
            } catch (loadError) {
                setError(loadError.message || "Unable to load your profile.");
            } finally { setLoading(false); }
        };
        loadProfile();
    }, []);

    const cancelEdit = () => { setForm(editableValues(profile)); setEditing(false); setError(""); };
    const saveProfile = async (event) => {
        event.preventDefault();
        try {
            setSaving(true); setError(""); setMessage("");
            await updateManagementProfile(form);
            const response = await getManagementProfile();
            setProfile(response.profile); setForm(editableValues(response.profile)); setEditing(false); setMessage("Profile updated successfully.");
            const sessionUser = JSON.parse(sessionStorage.getItem("managementUser") || "{}");
            sessionStorage.setItem("managementUser", JSON.stringify({ ...sessionUser, fullName: response.profile.fullName, phone: response.profile.phone, email: response.profile.email }));
        } catch (saveError) { setError(saveError.message || "Unable to update profile."); } finally { setSaving(false); }
    };

    return <ManagementLayout><div className="management-page profile-page">
        <header className="management-page-header"><div><span className="dashboard-eyebrow">ACCOUNT</span><h1>My Profile</h1><p>Review your work profile and update your contact information.</p></div>{profile && !editing && <button type="button" className="management-primary-button" onClick={() => setEditing(true)}>Edit profile</button>}</header>
        {message && <div className="management-success-message" role="status">{message}</div>}
        {error && <div className="management-error" role="alert">{error}</div>}
        {loading ? <div className="management-empty-state">Loading your profile…</div> : profile && <section className="profile-card">
            <aside className="profile-summary"><div className="profile-avatar">{profile.profilePhotoPath ? <img className="profile-avatar-photo" src={profile.profilePhotoPath} alt="" /> : <WorkPulseLogo variant="mark" className="profile-brand-mark" alt="WorkPulse" />}</div><h2>{profile.fullName}</h2><span>{profile.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span><p>{profile.employeeCode || "No employee code"}</p></aside>
            <div className="profile-content">
                <div className="profile-readonly-grid"><div><span>Branch</span><strong>{profile.branchCode ? `${profile.branchCode} — ` : ""}{profile.branchName || "Not assigned"}</strong></div><div><span>Department</span><strong>{profile.departmentCode ? `${profile.departmentCode} — ` : ""}{profile.departmentName || "Not assigned"}</strong></div><div><span>Designation</span><strong>{profile.designation || "Not specified"}</strong></div><div><span>Employee/Admin code</span><strong>{profile.employeeCode || "—"}</strong></div></div>
                {!editing ? <div className="profile-contact-grid"><div><span>Phone</span><strong>{profile.phone || "—"}</strong></div><div><span>Email</span><strong>{profile.email || "—"}</strong></div><div className="profile-full"><span>Address</span><strong>{profile.address || "—"}</strong></div><div><span>Pincode</span><strong>{profile.pincode || "—"}</strong></div></div> : <form className="management-form-grid profile-form" onSubmit={saveProfile}>
                    <div className="management-form-group"><label htmlFor="profile-phone">Phone *</label><input id="profile-phone" name="phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required /></div>
                    <div className="management-form-group"><label htmlFor="profile-email">Email</label><input id="profile-email" type="email" name="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div>
                    <div className="management-form-group full-width"><label htmlFor="profile-address">Address</label><textarea id="profile-address" name="address" rows="3" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></div>
                    <div className="management-form-group"><label htmlFor="profile-pincode">Pincode</label><input id="profile-pincode" name="pincode" value={form.pincode} onChange={(event) => setForm((current) => ({ ...current, pincode: event.target.value }))} /></div>
                    <div className="management-form-actions full-width"><button type="button" className="management-secondary-button" onClick={cancelEdit} disabled={saving}>Cancel</button><button type="submit" className="management-primary-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
                </form>}
            </div>
        </section>}
    </div></ManagementLayout>;
}

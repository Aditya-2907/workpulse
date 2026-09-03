import { useState } from "react";
import {
    attendanceLogin,
    validateAttendanceLocation,
} from "../services/api";

function AttendanceLogin() {
    const [phone, setPhone] = useState("");
    const [employeeData, setEmployeeData] = useState(null);
    const [attendanceToken, setAttendanceToken] =
        useState("");
    const [nextAction, setNextAction] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [locationLoading, setLocationLoading] =
        useState(false);

    const [locationStatus, setLocationStatus] =
        useState(null);

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");

        const cleanPhone = phone.trim();

        if (!cleanPhone) {
            setError("Registered mobile number দিন।");
            return;
        }

        if (!/^[0-9]{10}$/.test(cleanPhone)) {
            setError("Valid 10-digit mobile number দিন।");
            return;
        }

        try {
            setLoading(true);

            const data = await attendanceLogin(cleanPhone);

            setEmployeeData(data.user);
            setAttendanceToken(data.attendanceToken);
            setNextAction(data.nextAction);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleContinueAttendance = () => {
        setError("");
        setLocationStatus(null);

        if (!navigator.geolocation) {
            setError(
                "Location service is not supported on this device."
            );
            return;
        }

        setLocationLoading(true);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const latitude =
                        position.coords.latitude;

                    const longitude =
                        position.coords.longitude;

                    const data =
                        await validateAttendanceLocation(
                            attendanceToken,
                            latitude,
                            longitude
                        );

                    setLocationStatus({
                        valid: true,
                        message: data.message,
                        distanceMeters:
                            data.distanceMeters,
                    });
                } catch (error) {
                    setError(error.message);
                } finally {
                    setLocationLoading(false);
                }
            },

            (geoError) => {
                setLocationLoading(false);

                if (geoError.code === 1) {
                    setError(
                        "Location permission denied. Please allow location access to mark attendance."
                    );
                } else if (geoError.code === 2) {
                    setError(
                        "Your current location could not be detected."
                    );
                } else if (geoError.code === 3) {
                    setError(
                        "Location request timed out. Please try again."
                    );
                } else {
                    setError(
                        "Unable to access your location."
                    );
                }
            },

            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
            }
        );
    };

    const handleCancel = () => {
        setPhone("");
        setEmployeeData(null);
        setAttendanceToken("");
        setNextAction("");
        setError("");
    };

    if (employeeData) {
        return (
            <main className="attendance-page">
                <section className="attendance-card">
                    <div className="brand-section">
                        <div className="brand-logo">W</div>

                        <div>
                            <h1>WorkPulse</h1>
                            <p>Employee Attendance</p>
                        </div>
                    </div>

                    <div className="employee-section">
                        <div className="avatar">
                            {employeeData.fullName
                                ?.charAt(0)
                                .toUpperCase()}
                        </div>

                        <h2>{employeeData.fullName}</h2>

                        <p className="employee-code">
                            {employeeData.employeeCode}
                        </p>

                        <div className="employee-info">
                            <div>
                                <span>Branch</span>
                                <strong>
                                    {employeeData.branchName}
                                </strong>
                            </div>

                            <div>
                                <span>Department</span>
                                <strong>
                                    {employeeData.departmentName ||
                                        "Not Assigned"}
                                </strong>
                            </div>

                            <div>
                                <span>Designation</span>
                                <strong>
                                    {employeeData.designation ||
                                        "Not Assigned"}
                                </strong>
                            </div>

                            <div>
                                <span>Duty Time</span>
                                <strong>
                                    {employeeData.dutyStartTime} -{" "}
                                    {employeeData.dutyEndTime}
                                </strong>
                            </div>
                        </div>

                        {nextAction === "CHECK_IN" && (
                            <button
                                className="primary-btn"
                                type="button"
                                onClick={handleContinueAttendance}
                                disabled={locationLoading}
                            >
                                {locationLoading
                                    ? "Verifying Location..."
                                    : "Continue to Check In"}
                            </button>
                        )}

                        {nextAction === "CHECK_OUT" && (
                            <button
                                className="primary-btn"
                                type="button"
                                onClick={handleContinueAttendance}
                                disabled={locationLoading}
                            >
                                {locationLoading
                                    ? "Verifying Location..."
                                    : "Continue to Check Out"}
                            </button>
                        )}

                        {locationStatus?.valid && (
                            <div className="location-success">
                                <strong>Location Verified</strong>

                                <span>
                                    You are {locationStatus.distanceMeters}m
                                    from the attendance point.
                                </span>
                            </div>
                        )}

                        {error && (
                            <p className="error-message">
                                {error}
                            </p>
                        )}

                        {nextAction === "COMPLETED" && (
                            <div className="completed-message">
                                Today's attendance is already
                                completed.
                            </div>
                        )}

                        <button
                            className="secondary-btn"
                            type="button"
                            onClick={handleCancel}
                        >
                            Not You? Go Back
                        </button>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="attendance-page">
            <section className="attendance-card">
                <div className="brand-section">
                    <div className="brand-logo">W</div>

                    <div>
                        <h1>WorkPulse</h1>
                        <p>Employee Attendance</p>
                    </div>
                </div>

                <div className="login-section">
                    <h2>Mark Your Attendance</h2>

                    <p className="description">
                        Enter your registered mobile number to
                        continue.
                    </p>

                    <form onSubmit={handleSubmit}>
                        <label htmlFor="phone">
                            Registered Mobile Number
                        </label>

                        <div className="phone-input-wrapper">
                            <span>+91</span>

                            <input
                                id="phone"
                                type="tel"
                                inputMode="numeric"
                                maxLength="10"
                                placeholder="98765 43210"
                                value={phone}
                                onChange={(event) => {
                                    const value =
                                        event.target.value.replace(
                                            /\D/g,
                                            ""
                                        );

                                    setPhone(value);
                                }}
                            />
                        </div>

                        {error && (
                            <p className="error-message">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="primary-btn"
                            disabled={loading}
                        >
                            {loading
                                ? "Checking..."
                                : "Continue"}
                        </button>
                    </form>

                    <div className="security-note">
                        Use the registered office attendance
                        device to mark attendance.
                    </div>
                </div>
            </section>
        </main>
    );
}

export default AttendanceLogin;
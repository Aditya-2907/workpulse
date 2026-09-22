import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    attendanceLogin,
    validateAttendanceLocation,
    submitCheckIn,
    submitCheckOut,
} from "../services/api";
import WorkPulseLogo from "../components/WorkPulseLogo";

function AttendanceLogin() {
    const navigate = useNavigate();
    const [phone, setPhone] = useState("");
    const [employeeData, setEmployeeData] = useState(null);
    const [attendanceToken, setAttendanceToken] = useState("");
    const [nextAction, setNextAction] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [locationLoading, setLocationLoading] =
        useState(false);

    const [locationStatus, setLocationStatus] =
        useState(null);

    const [cameraOpen, setCameraOpen] = useState(false);
    const [capturedPhoto, setCapturedPhoto] =
        useState(null);

    const [remarks, setRemarks] = useState("");

    const [submittingAttendance, setSubmittingAttendance] =
        useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const cameraStreamRef = useRef(null);

    useEffect(() => {
        document.title = employeeData ? "WorkPulse - Attendance" : "WorkPulse - Login";
    }, [employeeData]);

    // =====================================================
    // PHONE LOGIN
    // =====================================================

    const dataUrlToBlob = async (dataUrl) => {
        const response = await fetch(dataUrl);
        return await response.blob();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");

        const cleanPhone = phone.trim();

        if (!cleanPhone) {
            setError("Please enter your registered mobile number.");
            return;
        }

        if (!/^[0-9]{10}$/.test(cleanPhone)) {
            setError("Please enter a valid 10-digit mobile number.");
            return;
        }

        try {
            setLoading(true);

            const data = await attendanceLogin(cleanPhone);

            setEmployeeData(data.user);
            setAttendanceToken(data.attendanceToken);
            setNextAction(data.nextAction);

            setLocationStatus(null);
            setCapturedPhoto(null);
            setRemarks("");
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // =====================================================
    // CAMERA
    // =====================================================

    const startCamera = async () => {
        try {
            setError("");

            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {
                setError(
                    "Camera is not supported on this device or browser."
                );
                return;
            }

            // Stop any previous camera stream
            if (cameraStreamRef.current) {
                cameraStreamRef.current
                    .getTracks()
                    .forEach((track) => track.stop());

                cameraStreamRef.current = null;
            }

            const stream =
                await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "user",
                    },
                    audio: false,
                });

            cameraStreamRef.current = stream;

            setCameraOpen(true);
            setCapturedPhoto(null);

            // Wait for video element to render
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;

                    videoRef.current
                        .play()
                        .catch(() => {
                            // autoplay handling
                        });
                }
            }, 100);
        } catch (error) {
            console.error("Camera error:", error);

            setCameraOpen(false);

            if (error.name === "NotAllowedError") {
                setError(
                    "Camera permission denied. Please allow camera access to mark attendance."
                );
            } else if (
                error.name === "NotFoundError" ||
                error.name === "DevicesNotFoundError"
            ) {
                setError(
                    "No camera was found on this device."
                );
            } else {
                setError(
                    "Camera access failed. Please allow camera permission and try again."
                );
            }
        }
    };

    const stopCamera = () => {
        if (cameraStreamRef.current) {
            cameraStreamRef.current
                .getTracks()
                .forEach((track) => track.stop());

            cameraStreamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setCameraOpen(false);
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) {
            setError("Camera is not ready yet.");
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video.videoWidth || !video.videoHeight) {
            setError(
                "Camera is still loading. Please wait a moment and try again."
            );
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");

        if (!context) {
            setError("Unable to capture photo.");
            return;
        }

        context.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );

        const photoData = canvas.toDataURL(
            "image/jpeg",
            0.85
        );

        setCapturedPhoto(photoData);

        stopCamera();

        setError("");
    };

    const retakePhoto = async () => {
        setCapturedPhoto(null);
        setError("");

        await startCamera();
    };

    // =====================================================
    // GPS VALIDATION
    // =====================================================

    const handleContinueAttendance = () => {
        setError("");
        setLocationStatus(null);
        setCapturedPhoto(null);

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
                        latitude,
                        longitude,
                    });

                    // GPS verified -> automatically open camera
                    await startCamera();
                } catch (error) {
                    setLocationStatus(null);
                    setError(error.message);
                } finally {
                    setLocationLoading(false);
                }
            },

            (geoError) => {
                setLocationLoading(false);
                setLocationStatus(null);

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
                        "Unable to access your current location."
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

    // =====================================================
    // CANCEL / RESET SESSION
    // =====================================================

    const handleCancel = () => {
        stopCamera();

        setPhone("");
        setEmployeeData(null);
        setAttendanceToken("");
        setNextAction("");

        setError("");
        setLocationStatus(null);

        setCapturedPhoto(null);
        setRemarks("");

        setLocationLoading(false);
        setSubmittingAttendance(false);
    };

    // =====================================================
    // TEMPORARY CONFIRM HANDLER
    // Final backend submission will be connected next
    // =====================================================

    const handleConfirmAttendance = async () => {
        if (!capturedPhoto) {
            setError(
                "Please capture your attendance photo first."
            );
            return;
        }

        if (!locationStatus?.valid) {
            setError(
                "Location verification is required."
            );
            return;
        }

        try {
            setSubmittingAttendance(true);
            setError("");

            const photoBlob =
                await dataUrlToBlob(capturedPhoto);

            let data;

            if (nextAction === "CHECK_IN") {
                data = await submitCheckIn({
                    attendanceToken,
                    latitude:
                        locationStatus.latitude,
                    longitude:
                        locationStatus.longitude,
                    remarks,
                    photoBlob,
                });
            } else if (
                nextAction === "CHECK_OUT"
            ) {
                data = await submitCheckOut({
                    attendanceToken,
                    latitude:
                        locationStatus.latitude,
                    longitude:
                        locationStatus.longitude,
                    remarks,
                    photoBlob,
                });
            } else {
                throw new Error(
                    "Attendance action is not available."
                );
            }

            alert(data.message);

            stopCamera();

            setPhone("");
            setEmployeeData(null);
            setAttendanceToken("");
            setNextAction("");
            setLocationStatus(null);
            setCapturedPhoto(null);
            setRemarks("");
        } catch (error) {
            setError(error.message);
        } finally {
            setSubmittingAttendance(false);
        }
    };

    // =====================================================
    // EMPLOYEE ATTENDANCE SCREEN
    // =====================================================

    if (employeeData) {
        return (
            <main className="attendance-page">
                <section className="attendance-card">
                    <div className="brand-section">
                        <WorkPulseLogo className="attendance-state-logo" />
                    </div>

                    <div className="employee-section">
                        <div className="avatar">
                            {employeeData.fullName
                                ?.charAt(0)
                                .toUpperCase()}
                        </div>

                        <h2>
                            {employeeData.fullName}
                        </h2>

                        <p className="employee-code">
                            {employeeData.employeeCode}
                        </p>

                        <div className="employee-info">
                            <div>
                                <span>Branch</span>

                                <strong>
                                    {
                                        employeeData.branchName
                                    }
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
                                <span>
                                    Designation
                                </span>

                                <strong>
                                    {employeeData.designation ||
                                        "Not Assigned"}
                                </strong>
                            </div>

                            <div>
                                <span>Duty Time</span>

                                <strong>
                                    {
                                        employeeData.dutyStartTime
                                    }{" "}
                                    -{" "}
                                    {
                                        employeeData.dutyEndTime
                                    }
                                </strong>
                            </div>
                        </div>

                        {/* CHECK IN BUTTON */}

                        {nextAction === "CHECK_IN" &&
                            !cameraOpen &&
                            !capturedPhoto && (
                                <button
                                    className="primary-btn"
                                    type="button"
                                    onClick={
                                        handleContinueAttendance
                                    }
                                    disabled={
                                        locationLoading
                                    }
                                >
                                    {locationLoading
                                        ? "Verifying Location..."
                                        : "Continue to Check In"}
                                </button>
                            )}

                        {/* CHECK OUT BUTTON */}

                        {nextAction === "CHECK_OUT" &&
                            !cameraOpen &&
                            !capturedPhoto && (
                                <button
                                    className="primary-btn"
                                    type="button"
                                    onClick={
                                        handleContinueAttendance
                                    }
                                    disabled={
                                        locationLoading
                                    }
                                >
                                    {locationLoading
                                        ? "Verifying Location..."
                                        : "Continue to Check Out"}
                                </button>
                            )}

                        {/* LOCATION VERIFIED */}

                        {locationStatus?.valid && (
                            <div className="location-success">
                                <strong>
                                    Location Verified
                                </strong>

                                <span>
                                    You are{" "}
                                    {
                                        locationStatus.distanceMeters
                                    }
                                    m from the attendance
                                    point.
                                </span>
                            </div>
                        )}

                        {/* LIVE CAMERA */}

                        {cameraOpen && (
                            <div className="camera-section">
                                <h3>
                                    {nextAction ===
                                        "CHECK_OUT"
                                        ? "Take Check-Out Photo"
                                        : "Take Check-In Photo"}
                                </h3>

                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="camera-preview"
                                />

                                <button
                                    type="button"
                                    className="primary-btn"
                                    onClick={
                                        capturePhoto
                                    }
                                >
                                    Capture Photo
                                </button>
                            </div>
                        )}

                        {/* Hidden canvas used for snapshot */}

                        <canvas
                            ref={canvasRef}
                            style={{
                                display: "none",
                            }}
                        />

                        {/* CAPTURED PHOTO */}

                        {capturedPhoto && (
                            <div className="camera-section">
                                <h3>
                                    Captured Photo
                                </h3>

                                <img
                                    src={capturedPhoto}
                                    alt="Attendance capture"
                                    className="captured-photo"
                                />

                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={retakePhoto}
                                >
                                    Retake Photo
                                </button>

                                <label
                                    htmlFor="attendanceRemarks"
                                >
                                    Remarks
                                    (Optional)
                                </label>

                                <textarea
                                    id="attendanceRemarks"
                                    value={remarks}
                                    onChange={(
                                        event
                                    ) =>
                                        setRemarks(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Add remarks if needed..."
                                    className="remarks-input"
                                    rows="3"
                                />

                                <button
                                    type="button"
                                    className="primary-btn"
                                    onClick={
                                        handleConfirmAttendance
                                    }
                                    disabled={
                                        submittingAttendance
                                    }
                                >
                                    {submittingAttendance
                                        ? "Submitting..."
                                        : nextAction ===
                                            "CHECK_OUT"
                                            ? "Confirm Check Out"
                                            : "Confirm Check In"}
                                </button>
                            </div>
                        )}

                        {/* ERROR */}

                        {error && (
                            <p className="error-message">
                                {error}
                            </p>
                        )}

                        {/* COMPLETED */}

                        {nextAction ===
                            "COMPLETED" && (
                                <div className="completed-message">
                                    Today's attendance is
                                    already completed.
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

    // =====================================================
    // PHONE LOGIN SCREEN
    // =====================================================

    return (
        <main className="attendance-page attendance-login-page">
            <div className="attendance-login-atmosphere" aria-hidden="true">
                <span className="attendance-orb attendance-orb-teal" />
                <span className="attendance-orb attendance-orb-blue" />
                <span className="attendance-grid" />
                <span className="attendance-ring attendance-ring-one" />
                <span className="attendance-ring attendance-ring-two" />
            </div>
            <section className="attendance-login-shell" aria-label="Employee attendance access">
                <div className="attendance-login-brand-panel">
                    <WorkPulseLogo className="attendance-login-logo" alt="WorkPulse" />
                    <div className="attendance-brand-copy">
                        <p className="attendance-eyebrow">WORKPLACE ATTENDANCE</p>
                        <h1>Simple, secure attendance access.</h1>
                        <p>Check in or check out from your registered office attendance device.</p>
                    </div>
                    <ul className="attendance-login-benefits" aria-label="Attendance access benefits">
                        <li><span aria-hidden="true">{"\u2713"}</span> Fast check-in and check-out</li>
                        <li><span aria-hidden="true">{"\u2713"}</span> Secure workplace access</li>
                        <li><span aria-hidden="true">{"\u2713"}</span> Location-aware attendance</li>
                    </ul>
                </div>

                <section className="attendance-access-card">
                    <div className="attendance-access-heading">
                        <p>EMPLOYEE ATTENDANCE</p>
                        <h2>Mark Your Attendance</h2>
                        <span>Enter your registered mobile number to continue.</span>
                    </div>

                    <form className="attendance-login-form" onSubmit={handleSubmit}>
                        <label htmlFor="phone">Registered Mobile Number</label>

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
                            <p className="error-message" role="alert">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="primary-btn attendance-continue-button"
                            disabled={loading}
                        >
                            {loading
                                ? "Checking..."
                                : <>Continue <span aria-hidden="true">{"\u2192"}</span></>}
                        </button>
                    </form>

                    <div className="security-note attendance-security-note">
                        <span className="attendance-security-icon" aria-hidden="true">{"\u25c8"}</span>
                        <p>Use the registered office attendance device to mark attendance.</p>
                    </div>

                    <div className="attendance-management-access">
                        <span>Management access?</span>
                        <button className="attendance-management-link" type="button" onClick={() => navigate("/management/login")}>
                            Management sign in <span aria-hidden="true">{"\u2192"}</span>
                        </button>
                    </div>
                </section>
            </section>
        </main>
    );
}

export default AttendanceLogin;

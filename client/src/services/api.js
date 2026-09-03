const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000/api";

export const attendanceLogin = async (phone) => {
    const response = await fetch(
        `${API_BASE_URL}/attendance/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ phone }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Attendance login failed"
        );
    }

    return data;
};

export const validateAttendanceLocation = async (
    attendanceToken,
    latitude,
    longitude
) => {
    const response = await fetch(
        `${API_BASE_URL}/attendance/validate-location`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${attendanceToken}`,
            },
            body: JSON.stringify({
                latitude,
                longitude,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Location verification failed"
        );
    }

    return data;
};

export const submitCheckIn = async ({
    attendanceToken,
    latitude,
    longitude,
    remarks,
    photoBlob,
}) => {
    const formData = new FormData();

    formData.append("latitude", latitude);
    formData.append("longitude", longitude);
    formData.append("remarks", remarks || "");
    formData.append(
        "photo",
        photoBlob,
        `check-in-${Date.now()}.jpg`
    );

    const response = await fetch(
        `${API_BASE_URL}/attendance/check-in`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${attendanceToken}`,
            },
            body: formData,
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Check-in failed"
        );
    }

    return data;
};

export const submitCheckOut = async ({
    attendanceToken,
    latitude,
    longitude,
    remarks,
    photoBlob,
}) => {
    const formData = new FormData();

    formData.append("latitude", latitude);
    formData.append("longitude", longitude);
    formData.append("remarks", remarks || "");

    formData.append(
        "photo",
        photoBlob,
        `check-out-${Date.now()}.jpg`
    );

    const response = await fetch(
        `${API_BASE_URL}/attendance/check-out`,
        {
            method: "POST",
            headers: {
                Authorization:
                    `Bearer ${attendanceToken}`,
            },
            body: formData,
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Check-out failed"
        );
    }

    return data;
};
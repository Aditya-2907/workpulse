const API_BASE_URL = "http://localhost:5000/api";

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
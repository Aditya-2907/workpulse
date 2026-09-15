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

export const managementLogin = async (phone, password) => {
    const response = await fetch(
        `${API_BASE_URL}/auth/management/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                phone,
                password,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Management login failed"
        );
    }

    return data;
};

export const changeManagementPassword = async (passwordData) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/auth/management/change-password`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(passwordData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to change password"
        );
    }

    return data;
};

export const getSuperAdminDashboard = async () => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/dashboard/super-admin`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to load dashboard data"
        );
    }

    return data;
};

export const getBranches = async () => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/branches`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to load branches"
        );
    }

    return data;
};


export const createBranch = async (branchData) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/branches`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(branchData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to create branch"
        );
    }

    return data;
};


export const updateBranch = async (
    branchId,
    branchData
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/branches/${branchId}`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(branchData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to update branch"
        );
    }

    return data;
};


export const updateBranchStatus = async (
    branchId,
    status
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/branches/${branchId}/status`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Failed to update branch status"
        );
    }

    return data;
};

export const getDepartments = async () => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/departments`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to load departments"
        );
    }

    return data;
};

export const createDepartment = async (departmentName) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/departments`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ departmentName }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to create department"
        );
    }

    return data;
};

export const updateDepartment = async (
    departmentId,
    departmentName
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/departments/${departmentId}`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ departmentName }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to update department"
        );
    }

    return data;
};

export const updateDepartmentStatus = async (
    departmentId,
    status
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/departments/${departmentId}/status`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Failed to update department status"
        );
    }

    return data;
};

export const getAdmins = async () => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/admins`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to load admins"
        );
    }

    return data;
};


export const createAdmin = async (adminData) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/admins`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(adminData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to create admin"
        );
    }

    return data;
};


export const updateAdminStatus = async (
    adminId,
    status
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/admins/${adminId}/status`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Failed to update admin status"
        );
    }

    return data;
};

export const resetAdminPassword = async (
    adminId,
    passwordData
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/admins/${adminId}/reset-password`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(passwordData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to reset admin password"
        );
    }

    return data;
};

export const getAdminById = async (adminId) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/admins/${adminId}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to load admin details"
        );
    }

    return data;
};

export const updateAdmin = async (
    adminId,
    adminData
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/admins/${adminId}`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(adminData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to update admin"
        );
    }

    return data;
};

export const requestAdminCreation = async (adminData) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/admin-approvals/request`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(adminData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Failed to submit admin request"
        );
    }

    return data;
};


export const getAdminApprovalRequests = async () => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/admin-approvals`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Failed to load admin approval requests"
        );
    }

    return data;
};


export const reviewAdminApprovalRequest = async (
    requestId,
    action,
    reviewNote = ""
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/admin-approvals/${requestId}/review`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                action,
                reviewNote,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Failed to review admin request"
        );
    }

    return data;
};

// ======================================================
// EMPLOYEE MANAGEMENT
// ======================================================

export const getEmployees = async () => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/employees`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to load employees"
        );
    }

    return data;
};


export const createEmployee = async (employeeData) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/employees`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(employeeData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to create employee"
        );
    }

    return data;
};


export const getEmployeeById = async (employeeId) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/employees/${employeeId}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to load employee details"
        );
    }

    return data;
};


export const updateEmployee = async (
    employeeId,
    employeeData
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/employees/${employeeId}`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(employeeData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to update employee"
        );
    }

    return data;
};


export const updateEmployeeStatus = async (
    employeeId,
    status
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/employees/${employeeId}/status`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                status,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Failed to update employee status"
        );
    }

    return data;
};


export const transferEmployeeBranch = async (
    employeeId,
    branchId
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/employees/${employeeId}/transfer-branch`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                branchId,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Failed to transfer employee"
        );
    }

    return data;
};

// ======================================================
// ATTENDANCE MANAGEMENT
// ======================================================

export const getManagementAttendance = async (filters = {}) => {
    const token = sessionStorage.getItem("managementToken");

    const params = new URLSearchParams();

    if (filters.startDate) {
        params.append("startDate", filters.startDate);
    }

    if (filters.endDate) {
        params.append("endDate", filters.endDate);
    }

    if (filters.employeeId) {
        params.append("employeeId", filters.employeeId);
    }

    if (filters.status) {
        params.append("status", filters.status);
    }

    if (filters.branchId) {
        params.append("branchId", filters.branchId);
    }

    if (filters.departmentId) {
        params.append("departmentId", filters.departmentId);
    }

    const queryString = params.toString();

    const url = queryString
        ? `${API_BASE_URL}/attendance/management?${queryString}`
        : `${API_BASE_URL}/attendance/management`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Failed to load attendance records"
        );
    }

    return data;
};

export const getAttendanceReport = async (filters = {}) => {
    const token = sessionStorage.getItem("managementToken");
    const params = new URLSearchParams();

    [
        "startDate",
        "endDate",
        "branchId",
        "departmentId",
        "employeeId",
        "status",
        "role",
        "late",
        "early",
        "minAttendancePercent",
        "maxAttendancePercent",
        "minWorkedMinutes",
        "maxWorkedMinutes",
        "checkInFrom",
        "checkInTo",
        "searchEmployee",
    ].forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
            params.append(key, filters[key]);
        }
    });

    const response = await fetch(
        `${API_BASE_URL}/reports/attendance?${params.toString()}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to generate attendance report"
        );
    }

    return data;
};

export const exportAttendanceReportExcel = async (filters = {}) => {
    const token = sessionStorage.getItem("managementToken");
    const params = new URLSearchParams();

    [
        "startDate",
        "endDate",
        "branchId",
        "departmentId",
        "employeeId",
        "status",
        "role",
        "late",
        "early",
        "minAttendancePercent",
        "maxAttendancePercent",
        "minWorkedMinutes",
        "maxWorkedMinutes",
        "checkInFrom",
        "checkInTo",
        "searchEmployee",
    ].forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
            params.append(key, filters[key]);
        }
    });

    const response = await fetch(
        `${API_BASE_URL}/reports/attendance/excel?${params.toString()}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        let message = "Failed to export attendance report";
        try {
            const data = await response.json();
            message = data.message || message;
        } catch {
            // Keep the default message when the API returns a non-JSON error.
        }
        throw new Error(message);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    const fallbackFilename = filters.startDate && filters.endDate
        ? `WorkPulse_Attendance_Report_${filters.startDate}_to_${filters.endDate}.xlsx`
        : "WorkPulse_Attendance_Report.xlsx";
    const filename = filenameMatch?.[1] || fallbackFilename;

    return { blob, filename };
};

export const exportAttendanceReportPdf = async (filters = {}) => {
    const token = sessionStorage.getItem("managementToken");
    const params = new URLSearchParams();

    [
        "startDate",
        "endDate",
        "branchId",
        "departmentId",
        "employeeId",
        "status",
        "role",
        "late",
        "early",
        "minAttendancePercent",
        "maxAttendancePercent",
        "minWorkedMinutes",
        "maxWorkedMinutes",
        "checkInFrom",
        "checkInTo",
        "searchEmployee",
    ].forEach((key) => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "") {
            params.append(key, filters[key]);
        }
    });

    const response = await fetch(
        `${API_BASE_URL}/reports/attendance/pdf?${params.toString()}`,
        {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
        }
    );

    if (!response.ok) {
        let message = "Failed to export attendance PDF";
        try {
            const data = await response.json();
            message = data.message || message;
        } catch {
            // Keep the default message when the API returns a non-JSON error.
        }
        throw new Error(message);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1] || (
        filters.startDate && filters.endDate
            ? `WorkPulse_Attendance_Report_${filters.startDate}_to_${filters.endDate}.pdf`
            : "WorkPulse_Attendance_Report.pdf"
    );

    return { blob, filename };
};

// ======================================================
// LEAVE MANAGEMENT
// ======================================================

export const getLeaves = async (filters = {}) => {
    const token = sessionStorage.getItem("managementToken");

    const params = new URLSearchParams();

    if (filters.startDate) {
        params.append("startDate", filters.startDate);
    }

    if (filters.endDate) {
        params.append("endDate", filters.endDate);
    }

    if (filters.employeeId) {
        params.append("employeeId", filters.employeeId);
    }

    if (filters.status) {
        params.append("status", filters.status);
    }

    if (filters.branchId) {
        params.append("branchId", filters.branchId);
    }

    const queryString = params.toString();

    const url = queryString
        ? `${API_BASE_URL}/leaves?${queryString}`
        : `${API_BASE_URL}/leaves`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to load leaves"
        );
    }

    return data;
};

export const createLeave = async (leaveData) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/leaves`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(leaveData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to create leave"
        );
    }

    return data;
};

export const cancelLeave = async (leaveId) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/leaves/${leaveId}/cancel`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to cancel leave"
        );
    }

    return data;
};

// ======================================================
// HOLIDAY MANAGEMENT
// ======================================================

export const getHolidays = async (filters = {}) => {
    const token = sessionStorage.getItem("managementToken");

    const params = new URLSearchParams();

    if (filters.startDate) {
        params.append("startDate", filters.startDate);
    }

    if (filters.endDate) {
        params.append("endDate", filters.endDate);
    }

    const queryString = params.toString();

    const url = queryString
        ? `${API_BASE_URL}/holidays?${queryString}`
        : `${API_BASE_URL}/holidays`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to load holidays"
        );
    }

    return data;
};

export const createHoliday = async (holidayData) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/holidays`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(holidayData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to create holiday"
        );
    }

    return data;
};

export const updateHoliday = async (
    holidayId,
    holidayData
) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/holidays/${holidayId}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(holidayData),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to update holiday"
        );
    }

    return data;
};

export const deleteHoliday = async (holidayId) => {
    const token = sessionStorage.getItem("managementToken");

    const response = await fetch(
        `${API_BASE_URL}/holidays/${holidayId}`,
        {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to delete holiday"
        );
    }

    return data;
};

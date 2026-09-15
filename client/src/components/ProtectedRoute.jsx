import { Navigate } from "react-router-dom";

function ProtectedRoute({
    children,
    allowedRoles = [],
}) {
    const token = sessionStorage.getItem(
        "managementToken"
    );

    const userData = sessionStorage.getItem(
        "managementUser"
    );

    if (!token || !userData) {
        return (
            <Navigate
                to="/management/login"
                replace
            />
        );
    }

    let user;

    try {
        user = JSON.parse(userData);
    } catch {
        sessionStorage.removeItem(
            "managementToken"
        );

        sessionStorage.removeItem(
            "managementUser"
        );

        return (
            <Navigate
                to="/management/login"
                replace
            />
        );
    }

    if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(user.role)
    ) {
        if (user.role === "SUPER_ADMIN") {
            return (
                <Navigate
                    to="/super-admin/dashboard"
                    replace
                />
            );
        }

        if (user.role === "ADMIN") {
            return (
                <Navigate
                    to="/admin/dashboard"
                    replace
                />
            );
        }

        return (
            <Navigate
                to="/management/login"
                replace
            />
        );
    }

    return children;
}

export default ProtectedRoute;
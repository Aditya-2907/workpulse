import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";

import AttendanceLogin from "./pages/AttendanceLogin";
import ManagementLogin from "./pages/ManagementLogin";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Branches from "./pages/Branches";
import Departments from "./pages/Departments";
import Admins from "./pages/Admins";
import AdminRequest from "./pages/AdminRequest";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import Holidays from "./pages/Holidays";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AlertCenter from "./pages/AlertCenter";
import AuditLogs from "./pages/AuditLogs";
import OrganizationSettings from "./pages/OrganizationSettings";
import EmployeeImport from "./pages/EmployeeImport";

const PAGE_TITLES = {
  "/": "Login",
  "/management/login": "Login",
  "/forgot-password": "Forgot Password",
  "/reset-password": "Reset Password",
  "/management/force-password-change": "Change Password",
  "/super-admin/dashboard": "Dashboard",
  "/admin/dashboard": "Dashboard",
  "/super-admin/profile": "My Profile",
  "/admin/profile": "My Profile",
  "/super-admin/branches": "Branches",
  "/super-admin/departments": "Departments",
  "/super-admin/admins": "Admins",
  "/admin/admin-request": "Admin Request",
  "/super-admin/employees": "Employees",
  "/admin/employees": "Employees",
  "/super-admin/employees/import": "Import Employees",
  "/super-admin/attendance": "Attendance",
  "/admin/attendance": "Attendance",
  "/employee/attendance": "Attendance",
  "/super-admin/leaves": "Leaves",
  "/admin/leaves": "Leaves",
  "/super-admin/holidays": "Holidays",
  "/super-admin/reports": "Reports",
  "/admin/reports": "Reports",
  "/super-admin/alerts": "Alerts",
  "/admin/alerts": "Alerts",
  "/super-admin/audit-logs": "Audit Logs",
  "/super-admin/settings": "Organization Settings",
};

function RouteTitle() {
  const { pathname } = useLocation();
  const pageTitle = PAGE_TITLES[pathname];

  useEffect(() => {
    document.title = pageTitle ? `WorkPulse - ${pageTitle}` : "WorkPulse";
  }, [pageTitle]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <RouteTitle />
      <Routes>
        <Route
          path="/"
          element={<AttendanceLogin />}
        />

        <Route
          path="/management/login"
          element={<ManagementLogin />}
        />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/management/force-password-change"
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN"]}
              allowPasswordChangeRequired
            >
              <ForcePasswordChange />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={[
                "SUPER_ADMIN",
              ]}
            >
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/branches"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN"]}
            >
              <Branches />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={[
                "ADMIN",
              ]}
            >
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/super-admin/profile" element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]}><Profile /></ProtectedRoute>} />
        <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={["ADMIN"]}><Profile /></ProtectedRoute>} />

        <Route
          path="/super-admin/departments"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN"]}
            >
              <Departments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/admins"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN"]}
            >
              <Admins />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/admin-request"
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN"]}
            >
              <AdminRequest />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/employees"
          element={
            <ProtectedRoute
              allowedRoles={["SUPER_ADMIN"]}
            >
              <Employees />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN"]}
            >
              <Employees />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/attendance"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
              <Attendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/attendance"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Attendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/leaves"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
              <Leaves />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/leaves"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Leaves />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/holidays"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
              <Holidays />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin/reports"
          element={
            <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route path="/super-admin/alerts" element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]}><AlertCenter /></ProtectedRoute>} />
        <Route path="/admin/alerts" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AlertCenter /></ProtectedRoute>} />
        <Route path="/super-admin/audit-logs" element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]}><AuditLogs /></ProtectedRoute>} />
        <Route path="/super-admin/settings" element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]}><OrganizationSettings /></ProtectedRoute>} />
        <Route path="/super-admin/employees/import" element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]}><EmployeeImport /></ProtectedRoute>} />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

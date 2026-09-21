const PAGE_METADATA = {
    "/super-admin/dashboard": {
        title: "Dashboard",
        subtitle: "Welcome back to WorkPulse",
    },
    "/super-admin/profile": {
        title: "My Profile",
        subtitle: "View and manage your profile",
    },
    "/super-admin/branches": {
        title: "Branches",
        subtitle: "Manage office branches",
    },
    "/super-admin/departments": {
        title: "Departments",
        subtitle: "Manage departments and their codes",
    },
    "/super-admin/admins": {
        title: "Admins",
        subtitle: "Manage branch administrators and access",
    },
    "/super-admin/employees": {
        title: "Employees",
        subtitle: "Manage your workforce records",
    },
    "/super-admin/attendance": {
        title: "Attendance Management",
        subtitle: "Review and filter workforce attendance",
    },
    "/super-admin/leaves": {
        title: "Leave Management",
        subtitle: "Review employee leave requests",
    },
    "/super-admin/holidays": {
        title: "Holidays",
        subtitle: "Manage organization holidays",
    },
    "/super-admin/reports": {
        title: "Reports",
        subtitle: "Generate and export attendance reports",
    },
    "/admin/dashboard": {
        title: "Dashboard",
        subtitle: "Welcome back to WorkPulse",
    },
    "/admin/profile": {
        title: "My Profile",
        subtitle: "View and manage your profile",
    },
    "/admin/employees": {
        title: "Employees",
        subtitle: "Manage your branch workforce",
    },
    "/admin/admin-request": {
        title: "Request Admin",
        subtitle: "Request an additional branch administrator",
    },
    "/admin/attendance": {
        title: "Attendance Management",
        subtitle: "Review and filter branch attendance",
    },
    "/admin/leaves": {
        title: "Leave Management",
        subtitle: "Review branch leave requests",
    },
    "/admin/reports": {
        title: "Reports",
        subtitle: "Generate and export branch attendance reports",
    },
};

const DEFAULT_PAGE_META = {
    title: "WorkPulse",
    subtitle: "Workforce management",
};

export const getManagementPageMeta = (pathname) => {
    if (PAGE_METADATA[pathname]) {
        return PAGE_METADATA[pathname];
    }

    const nestedMatch = Object.entries(PAGE_METADATA)
        .sort(([firstPath], [secondPath]) => secondPath.length - firstPath.length)
        .find(([path]) => pathname.startsWith(`${path}/`));

    return nestedMatch ? nestedMatch[1] : DEFAULT_PAGE_META;
};

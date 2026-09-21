const COLORS = {
    present: "var(--wp-chart-present)",
    late: "var(--wp-chart-late)",
    leave: "var(--wp-chart-leave)",
    absent: "var(--wp-chart-absent)",
};

const number = (value) => Number(value || 0);
const DONUT_RADIUS = 74;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function EmptyChart({ children }) {
    return <div className="dashboard-chart-empty">{children}</div>;
}

function AttendanceDistribution({ attendance, totalEmployees }) {
    const scopeTotal = number(totalEmployees);
    const leave = number(attendance.leave);
    const absent = number(attendance.absent);
    // KPI groups can overlap when an employee has both an approved leave and
    // a check-in. The chart must be an exclusive distribution, so leave takes
    // precedence here and the remaining in-scope employees are working.
    const working = Math.max(scopeTotal - leave - absent, 0);
    const segments = [
        { label: "Present / working", value: working, color: COLORS.present },
        { label: "On leave", value: leave, color: COLORS.leave },
        { label: "Absent", value: absent, color: COLORS.absent },
    ];
    const late = number(attendance.late);
    const totalStates = segments.reduce((sum, item) => sum + item.value, 0);
    const displayedTotal = scopeTotal || totalStates;
    let progress = 0;

    return <article className="dashboard-chart-card attendance-distribution-card">
        <div className="dashboard-chart-heading">
            <div>
                <h3>Today&apos;s attendance</h3>
                <p>Exclusive employee states. Approved leave takes precedence; late arrivals are included in Present.</p>
            </div>
        </div>

        {totalStates === 0 ? <EmptyChart>No attendance data is available for today.</EmptyChart> : (
            <div className="attendance-donut-layout">
                <div className="attendance-donut" role="img" aria-label={`${displayedTotal} employees in the current dashboard scope`}>
                    <svg viewBox="0 0 200 200" aria-hidden="true">
                        <circle className="attendance-donut-track" cx="100" cy="100" r={DONUT_RADIUS} transform="rotate(-90 100 100)" />
                        {segments.map((segment) => {
                            const length = (segment.value / totalStates) * DONUT_CIRCUMFERENCE;
                            const gap = segment.value ? Math.min(7, length * 0.34) : 0;
                            const visibleLength = Math.max(length - gap, 0);
                            const offset = -(progress * DONUT_CIRCUMFERENCE);
                            progress += segment.value / totalStates;

                            return segment.value ? (
                                <circle
                                    className="attendance-donut-segment"
                                    key={segment.label}
                                    cx="100"
                                    cy="100"
                                    r={DONUT_RADIUS}
                                    transform="rotate(-90 100 100)"
                                    stroke={segment.color}
                                    strokeDasharray={`${visibleLength} ${DONUT_CIRCUMFERENCE - visibleLength}`}
                                    strokeDashoffset={offset}
                                >
                                    <title>{`${segment.label}: ${segment.value}`}</title>
                                </circle>
                            ) : null;
                        })}
                    </svg>
                    <div className="attendance-donut-center">
                        <strong>{displayedTotal}</strong>
                        <span>Employees</span>
                    </div>
                </div>

                <ul className="attendance-donut-legend" aria-label="Today&apos;s attendance legend">
                    {segments.map((item) => (
                        <li key={item.label} title={`${item.label}: ${item.value}`}>
                            <span style={{ backgroundColor: item.color }} />
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                        </li>
                    ))}
                    <li className="attendance-late-indicator" title={`Late arrivals: ${late}. This is included in Present.`}>
                        <span style={{ backgroundColor: COLORS.late }} />
                        <span>Late arrivals (KPI)</span>
                        <strong>{late}</strong>
                    </li>
                </ul>
            </div>
        )}
    </article>;
}

function TrendBarChart({ rows }) {
    const maxValue = Math.max(...rows.map((row) => number(row.present)), 1);

    return <article className="dashboard-chart-card">
        <div className="dashboard-chart-heading"><div><h3>Recent attendance trend</h3><p>Employees checked in during the last seven days.</p></div></div>
        {!rows.length ? <EmptyChart>No attendance data is available yet.</EmptyChart> : <div className="dashboard-bar-chart" role="img" aria-label="Recent attendance trend">
            {rows.map((row) => {
                const value = number(row.present);
                return <div className="dashboard-bar-item" key={row.attendanceDate || row.label} title={`${row.label}: ${value} present employees`}>
                    <strong>{value}</strong><div className="dashboard-bar-track"><div className="dashboard-bar-fill" style={{ height: `${Math.max((value / maxValue) * 100, value ? 8 : 0)}%` }} /></div><span>{row.label}</span>
                </div>;
            })}
        </div>}
    </article>;
}

function DepartmentAttendance({ rows }) {
    const departments = [...rows].sort((first, second) => (
        number(second.present) - number(first.present)
        || String(first.name || "").localeCompare(String(second.name || ""))
    ));
    const maxValue = Math.max(...departments.map((department) => number(department.present)), 1);

    return <article className="dashboard-chart-card department-attendance-card">
        <div className="dashboard-chart-heading"><div><h3>Department attendance</h3><p>Present employees by department today.</p></div></div>
        {!departments.length ? <EmptyChart>No department attendance data is available.</EmptyChart> : (
            <div className="department-attendance-list" role="img" aria-label="Present employees by department today">
                {departments.map((department) => {
                    const value = number(department.present);
                    const percentage = (value / maxValue) * 100;
                    const name = department.name || "Unnamed department";

                    return <div className="department-attendance-row" key={name} title={`${name}. Present employees: ${value}`}>
                        <span className="department-attendance-name" title={name}>{name}</span>
                        <span className="department-attendance-track"><span className="department-attendance-fill" style={{ width: `${percentage}%` }} /></span>
                        <strong>{value}</strong>
                    </div>;
                })}
            </div>
        )}
    </article>;
}

export default function DashboardCharts({ attendance, analytics, totalEmployees }) {
    return <section className="dashboard-charts-grid" aria-label="Attendance visualizations">
        <AttendanceDistribution attendance={attendance} totalEmployees={totalEmployees} />
        <TrendBarChart rows={analytics?.trend || []} />
        <DepartmentAttendance rows={analytics?.departments || []} />
    </section>;
}

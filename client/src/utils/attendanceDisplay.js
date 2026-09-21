export const formatWorkedDuration = (minutes) => {
    if (minutes === null || minutes === undefined || minutes === "") {
        return "--";
    }

    const totalMinutes = Number(minutes);

    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
        return "--";
    }

    const roundedMinutes = Math.floor(totalMinutes);
    const hours = Math.floor(roundedMinutes / 60);
    const remainingMinutes = roundedMinutes % 60;

    if (hours === 0) return `${remainingMinutes} min`;
    if (remainingMinutes === 0) return `${hours} hr`;

    return `${hours} hr ${remainingMinutes} min`;
};

export const formatAttendanceTime = (value) => {
    if (!value) return "--";

    const match = String(value).match(
        /(?:^|[T\s])(\d{1,2}):(\d{2})(?::\d{2})?/
    );

    if (!match) return "--";

    const hour = Number(match[1]);
    const minute = match[2];

    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        return "--";
    }

    return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
};

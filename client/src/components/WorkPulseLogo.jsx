import { useState } from "react";

const FULL_LOGO = "/branding/workpulse-logo.png";
const MARK_LOGO = "/branding/workpulse-mark.png";

export default function WorkPulseLogo({
    variant = "full",
    className = "",
    alt = "WorkPulse — People • Work • Progress",
}) {
    const [source, setSource] = useState(
        variant === "mark" ? MARK_LOGO : FULL_LOGO
    );
    const [failed, setFailed] = useState(false);

    const handleError = () => {
        if (variant === "mark" && source !== FULL_LOGO) {
            setSource(FULL_LOGO);
            return;
        }
        setFailed(true);
    };

    if (failed) {
        return <span className={`workpulse-logo-fallback ${className}`}>
            <strong>WorkPulse</strong>
            <span>People • Work • Progress</span>
        </span>;
    }

    return <img
        className={`workpulse-logo-image ${className}`}
        src={source}
        alt={alt}
        onError={handleError}
    />;
}

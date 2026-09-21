-- Additive production-operations foundation. Apply through the accompanying
-- idempotent helper after inspecting the target schema; do not rerun blindly.

CREATE TABLE IF NOT EXISTS attendance_corrections (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    attendance_record_id BIGINT UNSIGNED NOT NULL,
    corrected_by BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(500) NOT NULL,
    original_data JSON NOT NULL,
    corrected_data JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_correction_record FOREIGN KEY (attendance_record_id)
        REFERENCES attendance_records(id) ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_correction_actor FOREIGN KEY (corrected_by)
        REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_attendance_correction_record (attendance_record_id),
    INDEX idx_attendance_correction_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS attendance_devices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    device_token_hash CHAR(64) NOT NULL UNIQUE,
    status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    created_by BIGINT UNSIGNED NOT NULL,
    last_used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    CONSTRAINT fk_attendance_device_creator FOREIGN KEY (created_by)
        REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_attendance_device_status (status)
);

-- =========================================================
-- 1. BRANCHES
-- =========================================================

CREATE TABLE IF NOT EXISTS branches (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    branch_code VARCHAR(50) NOT NULL UNIQUE,
    branch_name VARCHAR(150) NOT NULL,

    address TEXT NOT NULL,
    pincode VARCHAR(10) NOT NULL,

    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,

    status ENUM('ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);


-- =========================================================
-- 2. DEPARTMENTS
-- Only Super Admin will create/manage departments
-- =========================================================

CREATE TABLE IF NOT EXISTS departments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    department_code VARCHAR(50) NOT NULL UNIQUE,

    department_name VARCHAR(150) NOT NULL UNIQUE,

    status ENUM('ACTIVE', 'INACTIVE')
        NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);


-- =========================================================
-- 3. USERS
-- EMPLOYEE / ADMIN / SUPER_ADMIN
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employee_code VARCHAR(50) UNIQUE,

    full_name VARCHAR(150) NOT NULL,

    date_of_birth DATE NULL,
    gender ENUM('FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY') NULL,

    phone VARCHAR(20) NOT NULL UNIQUE,

    email VARCHAR(150) NULL UNIQUE,

    password_hash VARCHAR(255) NULL,

    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,

    token_version INT UNSIGNED NOT NULL DEFAULT 0,

    role ENUM(
        'EMPLOYEE',
        'ADMIN',
        'SUPER_ADMIN'
    ) NOT NULL,

    account_status ENUM(
        'PENDING_APPROVAL',
        'ACTIVE',
        'INACTIVE',
        'REJECTED'
    ) NOT NULL DEFAULT 'ACTIVE',

    branch_id BIGINT UNSIGNED NULL,

    department_id BIGINT UNSIGNED NULL,

    designation VARCHAR(150) NULL,

    address TEXT NULL,

    pincode VARCHAR(10) NULL,

    qualification VARCHAR(255) NULL,

    computer_skill BOOLEAN NOT NULL DEFAULT FALSE,

    aadhaar_number VARCHAR(20) NULL,

    pan_number VARCHAR(20) NULL,

    duty_start_time TIME NULL,

    duty_end_time TIME NULL,

    joining_date DATE NULL,

    leaving_date DATE NULL,

    profile_photo_path VARCHAR(500) NULL,

    created_by BIGINT UNSIGNED NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_users_department
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_users_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    UNIQUE KEY uq_users_aadhaar (aadhaar_number),

    INDEX idx_users_role (role),
    INDEX idx_users_branch (branch_id),
    INDEX idx_users_department (department_id),
    INDEX idx_users_status (account_status)
);


-- =========================================================
-- 4. ATTENDANCE RECORDS
-- Maximum one attendance record per user per day
-- =========================================================

CREATE TABLE IF NOT EXISTS attendance_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    branch_id BIGINT UNSIGNED NOT NULL,

    attendance_date DATE NOT NULL,


    -- -------------------------
    -- CHECK IN
    -- -------------------------

    check_in_time DATETIME NULL,

    check_in_photo_path VARCHAR(500) NULL,

    check_in_photo_public_id VARCHAR(500) NULL,

    check_in_latitude DECIMAL(10, 8) NULL,

    check_in_longitude DECIMAL(11, 8) NULL,

    check_in_distance_meters DECIMAL(10, 2) NULL,

    check_in_remarks TEXT NULL,


    -- -------------------------
    -- CHECK OUT
    -- -------------------------

    check_out_time DATETIME NULL,

    check_out_photo_path VARCHAR(500) NULL,

    check_out_photo_public_id VARCHAR(500) NULL,

    check_out_latitude DECIMAL(10, 8) NULL,

    check_out_longitude DECIMAL(11, 8) NULL,

    check_out_distance_meters DECIMAL(10, 2) NULL,

    check_out_remarks TEXT NULL,


    -- -------------------------
    -- CALCULATED ATTENDANCE
    -- -------------------------

    worked_minutes INT UNSIGNED NULL,

    required_minutes INT UNSIGNED NULL,

    attendance_percentage DECIMAL(6, 2) NULL,

    is_late BOOLEAN NOT NULL DEFAULT FALSE,

    is_early_departure BOOLEAN NOT NULL DEFAULT FALSE,

    attendance_status ENUM(
        'PENDING',
        'FULL_DAY',
        'PARTIAL_DAY',
        'INSUFFICIENT_ATTENDANCE',
        'ABSENT',
        'LEAVE',
        'HOLIDAY',
        'INCOMPLETE'
    ) NOT NULL DEFAULT 'PENDING',


    -- -------------------------
    -- PHOTO RETENTION
    -- -------------------------

    check_in_photo_deleted_at DATETIME NULL,

    check_out_photo_deleted_at DATETIME NULL,


    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,


    CONSTRAINT fk_attendance_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    UNIQUE KEY uq_user_attendance_date (
        user_id,
        attendance_date
    ),

    INDEX idx_attendance_date (attendance_date),

    INDEX idx_attendance_branch (
        branch_id,
        attendance_date
    ),

    INDEX idx_attendance_status (
        attendance_status
    )
);


-- =========================================================
-- 5. LEAVES
-- Admin / Super Admin marks employee leave
-- Reason mandatory
-- =========================================================

CREATE TABLE IF NOT EXISTS leaves (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    from_date DATE NOT NULL,

    to_date DATE NOT NULL,

    reason TEXT NOT NULL,

    approved_by BIGINT UNSIGNED NOT NULL,

    status ENUM(
        'APPROVED',
        'CANCELLED'
    ) NOT NULL DEFAULT 'APPROVED',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_leave_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_leave_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_leave_user (user_id),

    INDEX idx_leave_dates (
        from_date,
        to_date
    )
);


-- =========================================================
-- 6. HOLIDAYS
-- Super Admin only
-- Company-wide
-- =========================================================

CREATE TABLE IF NOT EXISTS holidays (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    holiday_date DATE NOT NULL UNIQUE,

    purpose VARCHAR(255) NOT NULL,

    created_by BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_holiday_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);


-- =========================================================
-- 7. ADMIN APPROVAL REQUESTS
-- Admin-created Admin requires Super Admin approval
-- =========================================================

CREATE TABLE IF NOT EXISTS admin_approval_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    admin_user_id BIGINT UNSIGNED NOT NULL,

    requested_by BIGINT UNSIGNED NOT NULL,

    status ENUM(
        'PENDING',
        'APPROVED',
        'REJECTED'
    ) NOT NULL DEFAULT 'PENDING',

    reviewed_by BIGINT UNSIGNED NULL,

    review_note TEXT NULL,

    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    reviewed_at DATETIME NULL,

    CONSTRAINT fk_admin_request_user
        FOREIGN KEY (admin_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_admin_request_requested_by
        FOREIGN KEY (requested_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_admin_request_reviewed_by
        FOREIGN KEY (reviewed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    INDEX idx_admin_request_status (status)
);


-- =========================================================
-- 8. AUDIT LOGS
-- Important changes will be recorded here
-- =========================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    performed_by BIGINT UNSIGNED NULL,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(100) NOT NULL,

    entity_id BIGINT UNSIGNED NULL,

    old_data JSON NULL,

    new_data JSON NULL,

    ip_address VARCHAR(45) NULL,

    user_agent TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_performed_by
        FOREIGN KEY (performed_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    INDEX idx_audit_performed_by (performed_by),

    INDEX idx_audit_entity (
        entity_type,
        entity_id
    ),

    INDEX idx_audit_created_at (created_at)
);

-- =========================================================
-- 9. BRANCH WEEKLY OFFS
-- =========================================================

CREATE TABLE IF NOT EXISTS branch_weekly_offs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    branch_id BIGINT UNSIGNED NOT NULL,
    weekday ENUM(
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY'
    ) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_branch_weekly_offs_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    UNIQUE KEY uq_branch_weekly_offs_day (branch_id, weekday)
);

-- =========================================================
-- 10. PASSWORD RESET TOKENS
-- =========================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    requested_ip VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_reset_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    INDEX idx_password_reset_tokens_lookup (token_hash, expires_at, consumed_at),
    INDEX idx_password_reset_tokens_user (user_id, created_at)
);

-- =========================================================
-- 11. ORGANIZATION SETTINGS
-- Single-row operational settings; historical attendance is never rewritten.
-- =========================================================

CREATE TABLE IF NOT EXISTS organization_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    organization_name VARCHAR(150) NOT NULL,
    organization_address TEXT NULL,
    organization_phone VARCHAR(30) NULL,
    organization_email VARCHAR(150) NULL,
    timezone_name VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    attendance_alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    photo_retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 90,
    missing_checkout_grace_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    device_enforcement_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    setup_completed_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_organization_settings_single_row CHECK (id = 1)
);

-- =========================================================
-- 12. ATTENDANCE CORRECTION HISTORY AND OPTIONAL DEVICES
-- =========================================================

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

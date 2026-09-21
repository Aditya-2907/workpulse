-- Apply once after the existing department-code migration. All changes are additive.
ALTER TABLE users
    ADD COLUMN date_of_birth DATE NULL AFTER full_name,
    ADD COLUMN gender ENUM('FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY') NULL AFTER date_of_birth;

CREATE TABLE organization_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    organization_name VARCHAR(150) NOT NULL,
    setup_completed_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_organization_settings_single_row CHECK (id = 1)
);

CREATE TABLE password_reset_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    requested_ip VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_password_reset_tokens_lookup (token_hash, expires_at, consumed_at),
    INDEX idx_password_reset_tokens_user (user_id, created_at)
);

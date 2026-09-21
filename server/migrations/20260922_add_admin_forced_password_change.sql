-- Apply once. Existing accounts retain normal access; newly created or
-- approved Admins are explicitly marked for a one-time password change.
ALTER TABLE users
    ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE
    AFTER password_hash;

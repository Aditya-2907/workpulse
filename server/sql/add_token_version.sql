-- Run once for existing WorkPulse databases before deploying password management.
ALTER TABLE users
ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0;

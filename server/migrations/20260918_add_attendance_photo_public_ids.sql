ALTER TABLE attendance_records
    ADD COLUMN check_in_photo_public_id VARCHAR(500) NULL
        AFTER check_in_photo_path,
    ADD COLUMN check_out_photo_public_id VARCHAR(500) NULL
        AFTER check_out_photo_path;
-- Add immutable, human-readable department codes without changing existing department IDs.
-- Apply once to databases created before department codes were introduced.

ALTER TABLE departments
    ADD COLUMN department_code VARCHAR(50) NULL AFTER id;

UPDATE departments
SET department_code = CONCAT('DP', LPAD(id, 3, '0'))
WHERE department_code IS NULL
   OR TRIM(department_code) = '';

ALTER TABLE departments
    MODIFY COLUMN department_code VARCHAR(50) NOT NULL;

ALTER TABLE departments
    ADD CONSTRAINT uq_departments_department_code
    UNIQUE (department_code);

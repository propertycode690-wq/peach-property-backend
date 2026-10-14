-- ============================================================
-- PEACH STATE RESIDENCES — ALTER EXISTING TABLES
-- phpMyAdmin → peachstate_db → SQL tab → Paste → Go
-- ============================================================

-- 1. TENANTS TABLE
--    Email pe UNIQUE constraint — duplicate tenants rukenge
ALTER TABLE `tenants` 
  ADD UNIQUE KEY `unique_email` (`email`);


-- 2. LEASES TABLE
--    Rent review dates add karo (UK landlord requirement)
ALTER TABLE `leases`
  ADD COLUMN `rent_review_date`        date        DEFAULT NULL
    COMMENT 'Next scheduled rent review date'        AFTER `end_date`,
  ADD COLUMN `review_frequency_months` int(11)     DEFAULT 12
    COMMENT '12 = yearly, 36 = every 3 years'        AFTER `rent_review_date`,
  ADD COLUMN `break_clause_date`       date        DEFAULT NULL
    COMMENT 'Break clause date if applicable'         AFTER `review_frequency_months`,
  ADD COLUMN `notes`                   text        DEFAULT NULL
    COMMENT 'Landlord internal notes about lease'     AFTER `break_clause_date`,
  ADD INDEX `idx_rent_review_date` (`rent_review_date`),
  ADD INDEX `idx_end_date`         (`end_date`);


-- 3. INVOICES TABLE — Performance indexes
ALTER TABLE `invoices`
  ADD INDEX `idx_due_date` (`due_date`),
  ADD INDEX `idx_inv_status` (`status`);


-- Verify: check leases columns
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'leases' AND TABLE_SCHEMA = 'peachstate_db';

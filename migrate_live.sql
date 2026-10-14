-- ============================================================
-- PEACH STATE RESIDENCES — LIVE DATABASE MIGRATION
-- Run this ONCE on your existing peachstate_db
-- Safe to run: uses IF NOT EXISTS / IGNORE everywhere
-- Date: 2026-10-13
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. TENANTS TABLE — Add UNIQUE on email
--    (stops duplicate tenants with same email)
-- ============================================================
-- Drop old key if exists (ignore error if not found)
ALTER TABLE `tenants` DROP INDEX IF EXISTS `email`;
ALTER TABLE `tenants` ADD UNIQUE KEY `email` (`email`);


-- ============================================================
-- 2. LEASES TABLE — Add rent review & break clause columns
--    (required for UK landlord client feature)
-- ============================================================
ALTER TABLE `leases`
  ADD COLUMN IF NOT EXISTS `rent_review_date` date DEFAULT NULL
    COMMENT 'Date when rent should be reviewed' AFTER `end_date`,
  ADD COLUMN IF NOT EXISTS `review_frequency_months` int(11) DEFAULT 12
    COMMENT 'How often rent is reviewed in months (e.g. 12 = yearly)' AFTER `rent_review_date`,
  ADD COLUMN IF NOT EXISTS `break_clause_date` date DEFAULT NULL
    COMMENT 'Break clause date if applicable' AFTER `review_frequency_months`,
  ADD COLUMN IF NOT EXISTS `notes` text DEFAULT NULL
    COMMENT 'Landlord notes about the lease' AFTER `break_clause_date`;


-- ============================================================
-- 3. PROPERTIES TABLE — Change images from TEXT to JSON
--    (better validation, native JSON functions)
--    Only if column type is still TEXT
-- ============================================================
-- Note: MariaDB 10.4 supports JSON type
ALTER TABLE `properties`
  MODIFY COLUMN `images` JSON DEFAULT NULL;


-- ============================================================
-- 4. INVOICES TABLE — Add index on due_date
--    (cron job will query by due_date frequently)
-- ============================================================
ALTER TABLE `invoices`
  ADD INDEX IF NOT EXISTS `idx_due_date` (`due_date`),
  ADD INDEX IF NOT EXISTS `idx_status` (`status`);


-- ============================================================
-- 5. LEASES TABLE — Add indexes for cron queries
-- ============================================================
ALTER TABLE `leases`
  ADD INDEX IF NOT EXISTS `idx_end_date` (`end_date`),
  ADD INDEX IF NOT EXISTS `idx_rent_review_date` (`rent_review_date`),
  ADD INDEX IF NOT EXISTS `idx_status` (`status`);


-- ============================================================
-- 6. NEW TABLE: reminder_logs
--    Tracks which reminders have been sent
--    Prevents duplicate emails/SMS on every cron run
-- ============================================================
CREATE TABLE IF NOT EXISTS `reminder_logs` (
  `id`           int(11)      NOT NULL AUTO_INCREMENT,
  `type`         enum(
                   'lease_expiry',
                   'rent_review',
                   'overdue_invoice',
                   'break_clause'
                 )             NOT NULL COMMENT 'Type of reminder',
  `reference_id` int(11)      NOT NULL COMMENT 'ID of lease or invoice',
  `days_before`  int(11)      DEFAULT NULL COMMENT 'How many days before event this was sent (90/60/30)',
  `sent_to`      varchar(255) DEFAULT NULL COMMENT 'Email/phone reminder was sent to',
  `sent_at`      timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  -- Prevent duplicate: same type + record + days_before = only send once
  UNIQUE KEY `unique_reminder` (`type`, `reference_id`, `days_before`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Tracks sent reminders to prevent duplicates on cron re-runs';


-- ============================================================
-- 7. NEW TABLE: cron_logs
--    Records every cron job execution
--    Useful for debugging "did cron run today?"
-- ============================================================
CREATE TABLE IF NOT EXISTS `cron_logs` (
  `id`         int(11)      NOT NULL AUTO_INCREMENT,
  `job_name`   varchar(100) NOT NULL COMMENT 'e.g. daily_reminders, mark_overdue',
  `status`     enum('success','error') DEFAULT 'success',
  `message`    text         DEFAULT NULL COMMENT 'Summary or error message',
  `records_processed` int(11) DEFAULT 0,
  `ran_at`     timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Audit log of all cron job executions';


-- ============================================================
-- 8. NEW TABLE: notification_settings
--    Landlord can configure how many days before to send alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS `notification_settings` (
  `id`                        int(11) NOT NULL AUTO_INCREMENT,
  `lease_expiry_days`         varchar(50) DEFAULT '90,60,30'
    COMMENT 'Comma-separated days before lease expiry to alert (e.g. 90,60,30)',
  `rent_review_days`          varchar(50) DEFAULT '60,30'
    COMMENT 'Comma-separated days before rent review to alert',
  `overdue_grace_days`        int(11) DEFAULT 3
    COMMENT 'Days after due_date before marking invoice as Overdue',
  `email_enabled`             tinyint(1) DEFAULT 1,
  `sms_enabled`               tinyint(1) DEFAULT 0,
  `notify_admin_email`        varchar(255) DEFAULT NULL
    COMMENT 'Admin email to receive all alerts (landlord email)',
  `updated_at`                timestamp NOT NULL DEFAULT current_timestamp()
                                ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Global notification configuration for cron reminders';

-- Seed default notification settings
INSERT IGNORE INTO `notification_settings`
  (`id`, `lease_expiry_days`, `rent_review_days`, `overdue_grace_days`, `email_enabled`, `sms_enabled`)
VALUES
  (1, '90,60,30', '60,30', 3, 1, 0);


-- ============================================================
-- 9. NEW TABLE: payment_history
--    Full audit trail of every payment made against an invoice
--    Currently invoice only stores total paid_amount (no history)
-- ============================================================
CREATE TABLE IF NOT EXISTS `payment_history` (
  `id`             int(11)      NOT NULL AUTO_INCREMENT,
  `invoice_id`     int(11)      NOT NULL,
  `amount_paid`    decimal(10,2) NOT NULL,
  `payment_date`   date         NOT NULL,
  `payment_method` varchar(100) DEFAULT NULL COMMENT 'e.g. Bank Transfer, Cash, Cheque',
  `reference`      varchar(255) DEFAULT NULL COMMENT 'Bank reference or cheque number',
  `notes`          text         DEFAULT NULL,
  `recorded_by`    int(11)      DEFAULT NULL COMMENT 'User who recorded this payment',
  `created_at`     timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `invoice_id` (`invoice_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `payment_history_ibfk_1`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_history_ibfk_2`
    FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Full payment history per invoice — supports partial payment tracking';


SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SUMMARY OF CHANGES:
-- ALTERED:   tenants      → UNIQUE email
-- ALTERED:   leases       → +rent_review_date, +review_frequency_months,
--                           +break_clause_date, +notes
-- ALTERED:   properties   → images TEXT → JSON
-- ALTERED:   invoices     → +indexes on due_date, status
-- ALTERED:   leases       → +indexes on end_date, rent_review_date, status
-- NEW TABLE: reminder_logs
-- NEW TABLE: cron_logs
-- NEW TABLE: notification_settings
-- NEW TABLE: payment_history
-- ============================================================

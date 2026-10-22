-- ============================================================
-- PEACH STATE RESIDENCES — COMPLETE DATABASE SCHEMA
-- Version: 2.0  |  Date: 2026-10-13
-- Engine: InnoDB  |  Charset: utf8mb4
-- Compatible: MySQL 5.7.8+ / MariaDB 10.2.7+
--
-- CHANGELOG v2.0 vs v1.0:
--   + properties.state, zip_code, images (JSON)
--   + invoices.paid_amount, type, Partial status
--   + leases.rent_review_date, review_frequency_months,
--     break_clause_date, notes
--   + tenants.email UNIQUE constraint
--   + Indexes on frequently queried date/status columns
--   + NEW: reminder_logs table
--   + NEW: cron_logs table
--   + NEW: notification_settings table
--   + NEW: payment_history table
--   * Admin seed: real bcrypt hash (password: Admin@123)
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- DROP EXISTING TABLES (safe fresh install)
-- ============================================================
DROP TABLE IF EXISTS `payment_history`;
DROP TABLE IF EXISTS `reminder_logs`;
DROP TABLE IF EXISTS `cron_logs`;
DROP TABLE IF EXISTS `notification_settings`;
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `documents`;
DROP TABLE IF EXISTS `document_categories`;
DROP TABLE IF EXISTS `expenses`;
DROP TABLE IF EXISTS `expense_categories`;
DROP TABLE IF EXISTS `invoices`;
DROP TABLE IF EXISTS `maintenance`;
DROP TABLE IF EXISTS `maintenance_categories`;
DROP TABLE IF EXISTS `leases`;
DROP TABLE IF EXISTS `tenants`;
DROP TABLE IF EXISTS `properties`;
DROP TABLE IF EXISTS `property_types`;
DROP TABLE IF EXISTS `settings`;
DROP TABLE IF EXISTS `users`;

-- ============================================================
-- A. LOOKUP / CATEGORY TABLES
-- ============================================================

-- 1. Property Types
CREATE TABLE `property_types` (
  `id`   int(11)      NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `property_types` (`name`) VALUES
  ('Apartment'), ('Air BnB'), ('Private Room'),
  ('House'), ('Townhouse'), ('Office Space'),
  ('Commercial Property');


-- 2. Maintenance Categories
CREATE TABLE `maintenance_categories` (
  `id`   int(11)      NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `maintenance_categories` (`name`) VALUES
  ('Plumbing'), ('Electrical'), ('AC'),
  ('General'), ('Painting'), ('Cleaning');


-- 3. Expense Categories
CREATE TABLE `expense_categories` (
  `id`   int(11)      NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `expense_categories` (`name`) VALUES
  ('Repairs'), ('Utilities'), ('Tax'),
  ('Insurance'), ('Cleaning'), ('Other');


-- 4. Document Categories
CREATE TABLE `document_categories` (
  `id`   int(11)      NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `document_categories` (`name`) VALUES
  ('Lease'), ('Legal'), ('Maintenance'), ('Financial');


-- ============================================================
-- B. SETTINGS TABLE (SMTP / Twilio / Integrations)
-- ============================================================
CREATE TABLE `settings` (
  `id`         int(11)      NOT NULL AUTO_INCREMENT,
  `key`        varchar(100) NOT NULL,
  `value`      text         DEFAULT NULL,
  `updated_at` timestamp    NOT NULL DEFAULT current_timestamp()
               ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `settings` (`key`, `value`) VALUES
  ('twilio_sid',   ''),
  ('twilio_token', ''),
  ('twilio_phone', ''),
  ('smtp_host',    ''),
  ('smtp_port',    '587'),
  ('smtp_email',   ''),
  ('smtp_pass',    '');


-- ============================================================
-- C. NOTIFICATION SETTINGS
-- ============================================================
CREATE TABLE `notification_settings` (
  `id`                    int(11)      NOT NULL AUTO_INCREMENT,
  `lease_expiry_days`     varchar(50)  DEFAULT '90,60,30'
    COMMENT 'Comma-separated days before lease expiry to alert',
  `rent_review_days`      varchar(50)  DEFAULT '60,30'
    COMMENT 'Comma-separated days before rent review to alert',
  `overdue_grace_days`    int(11)      DEFAULT 3
    COMMENT 'Days after due_date before marking invoice Overdue',
  `email_enabled`         tinyint(1)   DEFAULT 1,
  `sms_enabled`           tinyint(1)   DEFAULT 0,
  `notify_admin_email`    varchar(255) DEFAULT NULL
    COMMENT 'Landlord/admin email to receive all system alerts',
  `updated_at`            timestamp    NOT NULL DEFAULT current_timestamp()
                          ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `notification_settings`
  (`id`, `lease_expiry_days`, `rent_review_days`, `overdue_grace_days`, `email_enabled`, `sms_enabled`)
VALUES
  (1, '90,60,30', '60,30', 3, 1, 0);


-- ============================================================
-- D. USERS TABLE
-- ============================================================
CREATE TABLE `users` (
  `id`         int(11)      NOT NULL AUTO_INCREMENT,
  `name`       varchar(100) NOT NULL,
  `email`      varchar(100) NOT NULL,
  `password`   varchar(255) NOT NULL,
  `role`       enum('admin','manager') DEFAULT 'manager',
  `created_at` timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed admin account
-- Email: admin@peachstate.com  |  Password: Admin@123
-- Hash generated with bcrypt rounds=12
INSERT INTO `users` (`name`, `email`, `password`, `role`) VALUES
  ('System Admin', 'admin@peachstate.com',
   '$2a$12$AlbyjMdfz6y6csNjZzTWEeitBVmMU/rO5pfruTosRFLZdo3s6vdRC',
   'admin');


-- ============================================================
-- E. PROPERTIES TABLE
-- ============================================================
CREATE TABLE `properties` (
  `id`          int(11)      NOT NULL AUTO_INCREMENT,
  `name`        varchar(150) NOT NULL,
  `address`     text         NOT NULL,
  `city`        varchar(100) NOT NULL,
  `state`       varchar(100) DEFAULT NULL,
  `zip_code`    varchar(20)  DEFAULT NULL,
  `type`        varchar(100) NOT NULL
    COMMENT 'Stores value from property_types.name',
  `total_units` int(11)      NOT NULL DEFAULT 1,
  `status`      enum('Active','Inactive') DEFAULT 'Active',
  `image`       varchar(255) DEFAULT NULL
    COMMENT 'Primary image path',
  `images`      JSON         DEFAULT NULL
    COMMENT 'JSON array of all image paths',
  `added_by`    int(11)      DEFAULT NULL,
  `created_at`  timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `added_by` (`added_by`),
  CONSTRAINT `properties_ibfk_1`
    FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- F. TENANTS TABLE
-- ============================================================
CREATE TABLE `tenants` (
  `id`           int(11)      NOT NULL AUTO_INCREMENT,
  `full_name`    varchar(150) NOT NULL,
  `email`        varchar(100) NOT NULL,
  `phone`        varchar(20)  NOT NULL,
  `property_id`  int(11)      DEFAULT NULL,
  `unit_number`  varchar(50)  DEFAULT NULL,
  `move_in_date` date         DEFAULT NULL,
  `status`       enum('Active','Inactive') DEFAULT 'Active',
  `id_document`  varchar(255) DEFAULT NULL
    COMMENT 'Path to ID document upload',
  `added_by`     int(11)      DEFAULT NULL,
  `created_at`   timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `property_id` (`property_id`),
  KEY `added_by` (`added_by`),
  CONSTRAINT `tenants_ibfk_1`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tenants_ibfk_2`
    FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- G. LEASES TABLE  (v2.0 — adds rent review fields)
-- ============================================================
CREATE TABLE `leases` (
  `id`                      int(11)        NOT NULL AUTO_INCREMENT,
  `tenant_id`               int(11)        NOT NULL,
  `property_id`             int(11)        NOT NULL,
  `start_date`              date           NOT NULL,
  `end_date`                date           NOT NULL,
  -- v2.0: Rent review fields (required for UK landlord)
  `rent_review_date`        date           DEFAULT NULL
    COMMENT 'Next scheduled rent review date',
  `review_frequency_months` int(11)        DEFAULT 12
    COMMENT 'Review frequency: 12=yearly, 36=every 3 years',
  `break_clause_date`       date           DEFAULT NULL
    COMMENT 'Break clause date if lease has one',
  --
  `monthly_rent`            decimal(10,2)  NOT NULL,
  `security_deposit`        decimal(10,2)  DEFAULT 0.00,
  `agreement_file`          varchar(255)   DEFAULT NULL,
  `status`  enum('active','expired','terminated','month-to-month') DEFAULT 'active',
  `notes`                   text           DEFAULT NULL
    COMMENT 'Landlord internal notes',
  `added_by`                int(11)        DEFAULT NULL,
  `created_at`              timestamp      NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `property_id` (`property_id`),
  KEY `added_by` (`added_by`),
  KEY `idx_end_date` (`end_date`),
  KEY `idx_rent_review_date` (`rent_review_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `leases_ibfk_1`
    FOREIGN KEY (`tenant_id`)   REFERENCES `tenants`    (`id`) ON DELETE CASCADE,
  CONSTRAINT `leases_ibfk_2`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leases_ibfk_3`
    FOREIGN KEY (`added_by`)    REFERENCES `users`      (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- H. INVOICES TABLE
-- ============================================================
CREATE TABLE `invoices` (
  `id`             int(11)        NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50)    NOT NULL,
  `tenant_id`      int(11)        NOT NULL,
  `lease_id`       int(11)        NOT NULL,
  `amount`         decimal(10,2)  NOT NULL,
  `due_date`       date           NOT NULL,
  `paid_date`      date           DEFAULT NULL,
  `status`  enum('Unpaid','Paid','Overdue','Partial') DEFAULT 'Unpaid',
  `type`    enum('Rent','Deposit') DEFAULT 'Rent',
  `paid_amount`    decimal(10,2)  DEFAULT 0.00,
  `added_by`       int(11)        DEFAULT NULL,
  `created_at`     timestamp      NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `tenant_id` (`tenant_id`),
  KEY `lease_id` (`lease_id`),
  KEY `added_by` (`added_by`),
  KEY `idx_due_date` (`due_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `invoices_ibfk_1`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoices_ibfk_2`
    FOREIGN KEY (`lease_id`)  REFERENCES `leases`  (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoices_ibfk_3`
    FOREIGN KEY (`added_by`)  REFERENCES `users`   (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- I. PAYMENT HISTORY TABLE (NEW v2.0)
--    Full audit trail for every payment made on an invoice
-- ============================================================
CREATE TABLE `payment_history` (
  `id`             int(11)       NOT NULL AUTO_INCREMENT,
  `invoice_id`     int(11)       NOT NULL,
  `amount_paid`    decimal(10,2) NOT NULL,
  `payment_date`   date          NOT NULL,
  `payment_method` varchar(100)  DEFAULT NULL
    COMMENT 'e.g. Bank Transfer, Cash, Cheque',
  `reference`      varchar(255)  DEFAULT NULL
    COMMENT 'Bank reference or cheque number',
  `notes`          text          DEFAULT NULL,
  `recorded_by`    int(11)       DEFAULT NULL,
  `created_at`     timestamp     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `invoice_id` (`invoice_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `payment_history_ibfk_1`
    FOREIGN KEY (`invoice_id`)  REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payment_history_ibfk_2`
    FOREIGN KEY (`recorded_by`) REFERENCES `users`    (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- J. MAINTENANCE TABLE
-- ============================================================
CREATE TABLE `maintenance` (
  `id`          int(11)      NOT NULL AUTO_INCREMENT,
  `title`       varchar(200) NOT NULL,
  `description` text         DEFAULT NULL,
  `property_id` int(11)      NOT NULL,
  `tenant_id`   int(11)      DEFAULT NULL,
  `category`    varchar(100) DEFAULT NULL
    COMMENT 'Stores value from maintenance_categories.name',
  `priority`    enum('Low','Medium','High','Emergency') DEFAULT 'Medium',
  `status`      enum('pending','in_progress','resolved') DEFAULT 'pending',
  `added_by`    int(11)      DEFAULT NULL,
  `created_at`  timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `property_id` (`property_id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `added_by` (`added_by`),
  CONSTRAINT `maintenance_ibfk_1`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `maintenance_ibfk_2`
    FOREIGN KEY (`tenant_id`)   REFERENCES `tenants`    (`id`) ON DELETE SET NULL,
  CONSTRAINT `maintenance_ibfk_3`
    FOREIGN KEY (`added_by`)    REFERENCES `users`      (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- K. EXPENSES TABLE
-- ============================================================
CREATE TABLE `expenses` (
  `id`             int(11)       NOT NULL AUTO_INCREMENT,
  `property_id`    int(11)       NOT NULL,
  `category`       varchar(100)  DEFAULT NULL
    COMMENT 'Stores value from expense_categories.name',
  `amount`         decimal(10,2) NOT NULL,
  `expense_date`   date          NOT NULL,
  `description`    text          DEFAULT NULL,
  `receipt_status` enum('Yes','No') DEFAULT 'No',
  `bill_file`      varchar(255)  DEFAULT NULL,
  `added_by`       int(11)       DEFAULT NULL,
  `created_at`     timestamp     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `property_id` (`property_id`),
  KEY `added_by` (`added_by`),
  CONSTRAINT `expenses_ibfk_1`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE CASCADE,
  CONSTRAINT `expenses_ibfk_2`
    FOREIGN KEY (`added_by`)    REFERENCES `users`      (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- L. DOCUMENTS TABLE
-- ============================================================
CREATE TABLE `documents` (
  `id`            int(11)      NOT NULL AUTO_INCREMENT,
  `document_name` varchar(200) NOT NULL,
  `file_name`     varchar(255) NOT NULL,
  `category`      varchar(100) DEFAULT NULL
    COMMENT 'Stores value from document_categories.name',
  `property_id`   int(11)      DEFAULT NULL,
  `notes`         text         DEFAULT NULL,
  `source`        enum('system','uploaded') DEFAULT 'uploaded',
  `file_path`     varchar(255) DEFAULT NULL,
  `uploaded_by`   int(11)      DEFAULT NULL,
  `created_at`    timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `property_id` (`property_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `documents_ibfk_1`
    FOREIGN KEY (`property_id`) REFERENCES `properties` (`id`) ON DELETE SET NULL,
  CONSTRAINT `documents_ibfk_2`
    FOREIGN KEY (`uploaded_by`) REFERENCES `users`      (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- M. ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE `activity_logs` (
  `id`        int(11)      NOT NULL AUTO_INCREMENT,
  `action`    varchar(255) NOT NULL,
  `details`   text         DEFAULT NULL,
  `user_id`   int(11)      DEFAULT NULL,
  `timestamp` timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_timestamp` (`timestamp`),
  CONSTRAINT `activity_logs_ibfk_1`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- N. REMINDER LOGS TABLE (NEW v2.0)
--    Tracks which reminders were sent — prevents duplicates
-- ============================================================
CREATE TABLE `reminder_logs` (
  `id`           int(11)      NOT NULL AUTO_INCREMENT,
  `type`         enum(
                   'lease_expiry',
                   'rent_review',
                   'overdue_invoice',
                   'break_clause'
                 )             NOT NULL,
  `reference_id` int(11)      NOT NULL
    COMMENT 'ID of the lease or invoice',
  `days_before`  int(11)      DEFAULT NULL
    COMMENT 'e.g. 30 = sent when 30 days remain',
  `sent_to`      varchar(255) DEFAULT NULL
    COMMENT 'Email or phone number alerted',
  `sent_at`      timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_reminder` (`type`, `reference_id`, `days_before`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================
-- O. CRON LOGS TABLE (NEW v2.0)
--    Audit log of every cron job run
-- ============================================================
CREATE TABLE `cron_logs` (
  `id`                int(11)      NOT NULL AUTO_INCREMENT,
  `job_name`          varchar(100) NOT NULL
    COMMENT 'e.g. daily_reminders, mark_overdue',
  `status`            enum('success','error') DEFAULT 'success',
  `message`           text         DEFAULT NULL,
  `records_processed` int(11)      DEFAULT 0,
  `ran_at`            timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

-- ============================================================
-- HOW TO USE:
--
-- FRESH INSTALL (new server):
--   Run this entire schema.sql once in phpMyAdmin or CLI:
--   mysql -u root -p peachstate_db < schema.sql
--   Then login: admin@peachstate.com / Admin@123
--
-- EXISTING DB (live server with data):
--   DO NOT run schema.sql (it drops all tables!)
--   Run migrate_live.sql instead — it only ALTERs and adds.
--
-- TABLES OVERVIEW:
--   users                 — Admin & Manager accounts
--   properties            — Property portfolio
--   tenants               — Tenant profiles
--   leases                — Lease agreements (incl. rent review)
--   invoices              — Rent & deposit invoices
--   payment_history  NEW  — Full payment audit trail
--   maintenance           — Maintenance tickets
--   expenses              — Property expenses
--   documents             — Uploaded documents
--   activity_logs         — User action audit log
--   settings              — SMTP / Twilio config
--   notification_settings NEW — Reminder day config
--   reminder_logs    NEW  — Prevents duplicate reminder sends
--   cron_logs        NEW  — Cron job execution audit
--   property_types        — Dynamic property type list
--   maintenance_categories— Dynamic maintenance category list
--   expense_categories    — Dynamic expense category list
--   document_categories   — Dynamic document category list
-- ============================================================

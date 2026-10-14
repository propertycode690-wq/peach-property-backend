-- ============================================================
-- PEACH STATE RESIDENCES — 4 NEW TABLES ONLY
-- phpMyAdmin me:  peachstate_db → SQL tab → Paste → Go
-- ============================================================

-- 1. PAYMENT HISTORY
--    Har invoice ki payment ka full record
CREATE TABLE IF NOT EXISTS `payment_history` (
  `id`             int(11)       NOT NULL AUTO_INCREMENT,
  `invoice_id`     int(11)       NOT NULL,
  `amount_paid`    decimal(10,2) NOT NULL,
  `payment_date`   date          NOT NULL,
  `payment_method` varchar(100)  DEFAULT NULL,
  `reference`      varchar(255)  DEFAULT NULL,
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


-- 2. REMINDER LOGS
--    Track karta hai kaunsa reminder send ho chuka — duplicate nahi jayega
CREATE TABLE IF NOT EXISTS `reminder_logs` (
  `id`           int(11)      NOT NULL AUTO_INCREMENT,
  `type`         enum('lease_expiry','rent_review','overdue_invoice','break_clause') NOT NULL,
  `reference_id` int(11)      NOT NULL,
  `days_before`  int(11)      DEFAULT NULL,
  `sent_to`      varchar(255) DEFAULT NULL,
  `sent_at`      timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_reminder` (`type`,`reference_id`,`days_before`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- 3. CRON LOGS
--    Roz ki cron job run ka record
CREATE TABLE IF NOT EXISTS `cron_logs` (
  `id`                int(11)      NOT NULL AUTO_INCREMENT,
  `job_name`          varchar(100) NOT NULL,
  `status`            enum('success','error') DEFAULT 'success',
  `message`           text         DEFAULT NULL,
  `records_processed` int(11)      DEFAULT 0,
  `ran_at`            timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- 4. NOTIFICATION SETTINGS
--    Landlord configure kar sake — kitne din pehle reminder chahiye
CREATE TABLE IF NOT EXISTS `notification_settings` (
  `id`                 int(11)      NOT NULL AUTO_INCREMENT,
  `lease_expiry_days`  varchar(50)  DEFAULT '90,60,30',
  `rent_review_days`   varchar(50)  DEFAULT '60,30',
  `overdue_grace_days` int(11)      DEFAULT 3,
  `email_enabled`      tinyint(1)   DEFAULT 1,
  `sms_enabled`        tinyint(1)   DEFAULT 0,
  `notify_admin_email` varchar(255) DEFAULT NULL,
  `updated_at`         timestamp    NOT NULL DEFAULT current_timestamp()
                       ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Default row insert karo
INSERT IGNORE INTO `notification_settings`
  (`id`,`lease_expiry_days`,`rent_review_days`,`overdue_grace_days`,`email_enabled`,`sms_enabled`)
VALUES
  (1, '90,60,30', '60,30', 3, 1, 0);

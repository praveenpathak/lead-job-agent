-- Database Schema for Lead & Job Generator Agent
-- Supports local XAMPP MySQL and cloud MySQL / MariaDB

CREATE DATABASE IF NOT EXISTS `lead_job_agent` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `lead_job_agent`;

-- Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(64) DEFAULT '',
  `password_hash` VARCHAR(255) NOT NULL,
  `salt` VARCHAR(64) NOT NULL,
  `profile` LONGTEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pitches & Applications Table
CREATE TABLE IF NOT EXISTS `applications` (
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `kind` VARCHAR(32) DEFAULT 'lead',
  `title` VARCHAR(255) DEFAULT '',
  `company` VARCHAR(255) DEFAULT '',
  `location` VARCHAR(255) DEFAULT '',
  `status` VARCHAR(64) DEFAULT 'Pitched',
  `deal` VARCHAR(128) DEFAULT '',
  `notes` TEXT NULL,
  `contact_email` VARCHAR(255) DEFAULT '',
  `contact_phone` VARCHAR(64) DEFAULT '',
  `raw_data` LONGTEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_url` (`user_id`, `url`(250)),
  INDEX `idx_app_user` (`user_id`),
  INDEX `idx_app_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Discovered Leads Cache Table
CREATE TABLE IF NOT EXISTS `leads` (
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `name` VARCHAR(255) DEFAULT '',
  `category` VARCHAR(64) DEFAULT '',
  `location` VARCHAR(255) DEFAULT '',
  `phone` VARCHAR(64) DEFAULT '',
  `email` VARCHAR(255) DEFAULT '',
  `tech_stack` VARCHAR(255) DEFAULT '',
  `cms` VARCHAR(64) DEFAULT '',
  `raw_data` LONGTEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lead_url` (`url`(250)),
  INDEX `idx_lead_cat` (`category`),
  INDEX `idx_lead_loc` (`location`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `action` VARCHAR(64) NOT NULL,
  `details` TEXT NULL,
  `ip_address` VARCHAR(64) DEFAULT '',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_log_user` (`user_id`),
  INDEX `idx_log_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

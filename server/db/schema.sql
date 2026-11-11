-- CSL Forum — Phase 1 schema (User & Account Foundation)
-- MySQL 8 / MariaDB 10.5+, InnoDB, utf8mb4
-- Run:  mysql -u root -p < server/db/schema.sql

CREATE DATABASE IF NOT EXISTS csl_forum
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE csl_forum;

-- ---------------------------------------------------------------
-- users: login identity + account state
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username           VARCHAR(30)  NOT NULL,
  email              VARCHAR(255) NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,

  -- Role the user CLAIMED at signup. Privileges depend on school_verified_at too.
  role               ENUM('student','teacher','moderator','admin') NOT NULL DEFAULT 'student',

  -- active = normal, banned = Phase 7 bans, deleted = soft-deleted (Phase 1)
  status             ENUM('active','banned','deleted') NOT NULL DEFAULT 'active',

  email_verified_at  DATETIME NULL,   -- NULL = email not verified yet
  school_verified_at DATETIME NULL,   -- NULL = student/teacher not verified by admin yet

  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- "account creation date"
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at         DATETIME NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- profiles: public-facing info, 1-to-1 with users
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  user_id          BIGINT UNSIGNED NOT NULL,
  display_name     VARCHAR(50)  NOT NULL,
  bio              VARCHAR(500) NULL,
  avatar_url       VARCHAR(255) NULL,

  -- "School identity" (kept as plain text for now; Phase 2 adds an organizations table)
  school_id_number VARCHAR(30)  NULL,
  program          VARCHAR(50)  NULL,       -- e.g. BSCS, CRIM
  year_level       TINYINT UNSIGNED NULL,   -- 1-4 (students)

  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id),
  UNIQUE KEY uq_profiles_school_id (school_id_number),
  CONSTRAINT fk_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- email_tokens: one table for "verify email" and "reset password"
-- Store only the SHA-256 HASH of the token, never the raw token.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  type        ENUM('verify_email','reset_password') NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_email_tokens_hash (token_hash),
  KEY idx_email_tokens_user_type (user_id, type),
  CONSTRAINT fk_email_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- school_verification_requests: student/teacher verification (admin approves)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_verification_requests (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  school_id_number  VARCHAR(30)  NOT NULL,
  note              VARCHAR(500) NULL,        -- optional message from the user
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by       BIGINT UNSIGNED NULL,     -- admin who decided
  reviewed_at       DATETIME NULL,
  reject_reason     VARCHAR(255) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_svr_status (status, created_at),
  KEY idx_svr_user (user_id),
  CONSTRAINT fk_svr_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_svr_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Account deletion (soft delete) — done in application code, not SQL:
--   users:    status='deleted', deleted_at=NOW(),
--             email='deleted_<id>@deleted.local', username='deleted_<id>'
--   profiles: display_name='[deleted]', bio=NULL, avatar_url=NULL, school_id_number=NULL
-- Rows stay so later phases (posts, comments) keep valid foreign keys,
-- and the original username/email become free to register again.
-- ---------------------------------------------------------------
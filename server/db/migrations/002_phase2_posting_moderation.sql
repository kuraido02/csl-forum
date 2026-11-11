-- CSL Forum — Phase 2: Core posting and moderation
-- Requires the Phase 1 schema (server/db/schema.sql) to be installed first.
-- MySQL 8 / MariaDB 10.5+, InnoDB, utf8mb4
-- Run from the project root:
--   mysql -u root -p csl_forum < server/db/migrations/002_phase2_posting_moderation.sql
--
-- The names below are placeholders from the API contract. Replace them with
-- the school's official course, department, and organization names before use.

USE csl_forum;

-- ---------------------------------------------------------------
-- departments and courses: a user's course determines the department
-- responsible for reviewing that user's posts.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id  BIGINT UNSIGNED NOT NULL,
  code           VARCHAR(20) NOT NULL,
  name           VARCHAR(100) NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_code (code),
  KEY idx_courses_department (department_id),
  CONSTRAINT fk_courses_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing Phase 1 profiles.program remains intact for compatibility.
-- New and updated profiles should use course_id as the canonical relation.
ALTER TABLE profiles
  ADD COLUMN course_id BIGINT UNSIGNED NULL,
  ADD COLUMN school_year CHAR(9) NULL,
  ADD KEY idx_profiles_course (course_id),
  ADD CONSTRAINT fk_profiles_course
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT;

-- Fixed post organization tags. They are independent of the author's course.
CREATE TABLE IF NOT EXISTS organizations (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizations_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Placeholder seed records. INSERT IGNORE preserves any existing admin edits.
INSERT IGNORE INTO departments (code, name) VALUES
  ('CS', 'Computer Science Department'),
  ('CRIM', 'Criminology Department'),
  ('BA', 'Business Administration Department'),
  ('ACCT', 'Accountancy Department'),
  ('EDUC', 'Education Department');

INSERT IGNORE INTO courses (department_id, code, name)
SELECT d.id, seed.code, seed.name
FROM departments d
JOIN (
  SELECT 'CS' AS department_code, 'BSCS' AS code, 'BS Computer Science' AS name
  UNION ALL SELECT 'CRIM', 'CRIM', 'BS Criminology'
  UNION ALL SELECT 'BA', 'BSBA', 'BS Business Administration'
  UNION ALL SELECT 'ACCT', 'BSA', 'BS Accountancy'
  UNION ALL SELECT 'EDUC', 'BSED', 'BS Education'
) AS seed ON seed.department_code = d.code;

INSERT IGNORE INTO organizations (code, name) VALUES
  ('BSCS', 'BS Computer Science'),
  ('CRIM', 'BS Criminology'),
  ('BSBA', 'BS Business Administration'),
  ('BSA', 'BS Accountancy'),
  ('BSED', 'BS Education');

-- ---------------------------------------------------------------
-- department_moderators: office assignments grant moderation powers;
-- moderator status is not a separate signup role.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS department_moderators (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id  BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  office         ENUM('president','vice_president') NOT NULL,
  assigned_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_moderator_office (department_id, office),
  UNIQUE KEY uq_moderator_user (user_id),
  CONSTRAINT fk_moderators_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_moderators_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- posts: content plus the author-course department used for review routing.
-- The app sets department_id from the author's profile.course_id; clients
-- must not supply or override it. New posts start pending.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_id        BIGINT UNSIGNED NOT NULL,
  department_id    BIGINT UNSIGNED NOT NULL,
  organization_id  BIGINT UNSIGNED NOT NULL,
  title            VARCHAR(200) NOT NULL,
  body             TEXT NULL,
  link_url         VARCHAR(2048) NULL,
  image_url        VARCHAR(255) NULL,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  published_at     DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_posts_feed (status, deleted_at, published_at, id),
  KEY idx_posts_author (author_id, deleted_at, created_at),
  KEY idx_posts_moderation (department_id, status, deleted_at, created_at),
  KEY idx_posts_organization (organization_id, status, deleted_at, published_at),
  CONSTRAINT fk_posts_author
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_posts_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_posts_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- post_reviews: append-only decision history. Each approval/rejection stores
-- the reviewer, decision, optional note, and organization tag before/after.
-- A post's current status and tag remain on posts; the newest review is the
-- current review shown by the API.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_reviews (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id                 BIGINT UNSIGNED NOT NULL,
  reviewer_id             BIGINT UNSIGNED NOT NULL,
  decision                ENUM('approved','rejected') NOT NULL,
  organization_id_before  BIGINT UNSIGNED NOT NULL,
  organization_id_after   BIGINT UNSIGNED NOT NULL,
  note                    VARCHAR(500) NULL,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_post_reviews_post (post_id, created_at, id),
  KEY idx_post_reviews_reviewer (reviewer_id, created_at),
  CONSTRAINT fk_post_reviews_post
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_post_reviews_reviewer
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_post_reviews_org_before
    FOREIGN KEY (organization_id_before) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_post_reviews_org_after
    FOREIGN KEY (organization_id_after) REFERENCES organizations(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


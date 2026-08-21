-- ---------------------------------------------------------------------------
-- 009 — Authentication, sessions and login throttling.
--
-- Until this migration the API had no identity at all: `GET /api/buyer/:id`
-- accepted any id from anyone, and 008 stored issued passwords in plaintext by
-- its own admission. Everything here exists to close that.
--
-- Three ideas, in order:
--
--  1. `users` grows the columns an account needs to be signed in to — a hashed
--     secret, a status, a lockout, and a token version that revokes every live
--     session for that user by being incremented.
--  2. `sessions` holds refresh tokens, hashed. An access token is short-lived
--     and stateless; a refresh token is long-lived, so it must be revocable,
--     which means it must be stored. It is stored as a SHA-256 digest for the
--     same reason a password is: a database dump must not be a set of keys.
--  3. `login_attempts` is the audit and the throttle. Every attempt lands here,
--     successful or not, so "who tried to get in" is answerable and so the
--     rate limiter can count failures per identifier and per IP.
--
-- `login_email` rather than reusing `email`: emails in the seed are not unique
-- and some are NULL, so a UNIQUE index on `email` would fail on real data. The
-- backfill below claims only the emails that are already unambiguous; anything
-- ambiguous is left NULL for an operator to resolve with scripts/set-password.
-- ---------------------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN login_email    VARCHAR(191) NULL AFTER email,
  ADD COLUMN password_hash  VARCHAR(255) NULL AFTER login_email,
  ADD COLUMN password_set_at DATETIME(3) NULL AFTER password_hash,
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password_set_at,
  ADD COLUMN status         VARCHAR(16)  NOT NULL DEFAULT 'active' AFTER role,
  ADD COLUMN token_version  INT          NOT NULL DEFAULT 1 AFTER status,
  ADD COLUMN failed_attempts INT         NOT NULL DEFAULT 0,
  ADD COLUMN locked_until   DATETIME(3)  NULL,
  ADD COLUMN last_login_at  DATETIME(3)  NULL;

-- Claim the emails that identify exactly one account. Duplicates and NULLs are
-- left for an operator: an ambiguous login is worse than no login.
UPDATE users u
  JOIN (
    SELECT LOWER(TRIM(email)) AS e
      FROM users
     WHERE email IS NOT NULL AND TRIM(email) <> ''
     GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) = 1
  ) d ON LOWER(TRIM(u.email)) = d.e
   SET u.login_email = d.e;

CREATE UNIQUE INDEX uq_users_login_email ON users (login_email);
CREATE INDEX idx_users_status ON users (status);

-- ---------------------------------------------------------------------------
-- Refresh tokens.
--
-- One row per signed-in device. `token_hash` is SHA-256 of the opaque token we
-- handed out — never the token itself. Rotation replaces the row's hash on every
-- refresh and records `rotated_from`, so a token presented twice (the classic
-- signal that one was stolen and replayed) is detectable: the second use finds
-- a revoked row and we kill the whole family.
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id       VARCHAR(64)  NOT NULL,
  token_hash    CHAR(64)     NOT NULL,
  family_id     VARCHAR(64)  NOT NULL,      -- survives rotation, identifies one device
  rotated_from  VARCHAR(64)  NULL,
  issued_at     DATETIME(3)  NOT NULL,
  expires_at    DATETIME(3)  NOT NULL,
  last_used_at  DATETIME(3)  NULL,
  revoked_at    DATETIME(3)  NULL,
  revoked_reason VARCHAR(64) NULL,
  user_agent    VARCHAR(255) NULL,
  ip            VARCHAR(64)  NULL,
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id, revoked_at),
  KEY idx_sessions_family (family_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Every attempt to sign in, good or bad.
-- ---------------------------------------------------------------------------
CREATE TABLE login_attempts (
  id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(191) NOT NULL,          -- what was typed, lowercased
  user_id    VARCHAR(64)  NULL,              -- resolved account, when there was one
  ip         VARCHAR(64)  NULL,
  user_agent VARCHAR(255) NULL,
  outcome    VARCHAR(32)  NOT NULL,          -- ok | bad_password | unknown_user | locked | suspended | throttled
  at         DATETIME(3)  NOT NULL,
  KEY idx_login_attempts_id_at (identifier, at),
  KEY idx_login_attempts_ip_at (ip, at),
  KEY idx_login_attempts_user (user_id, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Anything the server does on its own — closing an auction, expiring a payment
-- window — needs somewhere to say it ran and what it touched. The scheduler
-- writes here; /api/admin reads it so an operator can see the machine's work
-- next to everybody else's.
-- ---------------------------------------------------------------------------
CREATE TABLE job_runs (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  job          VARCHAR(64)  NOT NULL,
  started_at   DATETIME(3)  NOT NULL,
  finished_at  DATETIME(3)  NULL,
  outcome      VARCHAR(16)  NULL,            -- ok | error | skipped
  affected     INT          NOT NULL DEFAULT 0,
  detail       TEXT         NULL,
  error        TEXT         NULL,
  KEY idx_job_runs_job_started (job, started_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 008 issued temporary passwords in the clear. Keep the audit row (who reset
-- whose password, and when) but stop keeping the secret itself.
UPDATE password_resets SET password = NULL WHERE password IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Two columns the scheduler needs, and one thing they reveal.
--
-- `catalogues.paused` did not exist. An operator pausing a live sale was
-- session state in one browser — so the pause was invisible to everyone else
-- and, once a server-side scheduler exists, invisible to the thing that closes
-- lots. A pause that the closer cannot see is a pause that does not stop the
-- close. It is a column now.
--
-- `delivery_orders.overdue_at` records that a payment window passed, WITHOUT
-- inventing a new `stage`: the frontend's AuctionStatusStage union is a closed
-- set, and a stage it has never heard of renders as a broken tracker. The
-- machine may note the fact; only a person moves the stage.
-- ---------------------------------------------------------------------------
ALTER TABLE catalogues
  ADD COLUMN paused    TINYINT(1)  NOT NULL DEFAULT 0,
  ADD COLUMN paused_at DATETIME(3) NULL,
  ADD COLUMN paused_by VARCHAR(64) NULL;

ALTER TABLE delivery_orders
  ADD COLUMN overdue_at DATETIME(3) NULL;

CREATE INDEX idx_do_overdue ON delivery_orders (stage, lifting_by);

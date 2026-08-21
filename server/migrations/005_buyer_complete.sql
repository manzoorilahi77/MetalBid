-- 005 — everything else the homepage and buyer workspace read.
--
-- Completes the two areas so no screen in them needs the frontend fixtures:
-- notifications, disputes, the money-in/money-out records, inspection bookings,
-- catalogue attachments, and the lot and catalogue columns the shared
-- components read but the homepage did not need.
--
-- Same conventions as 002/004: DATETIME(3) in UTC, DECIMAL for money, explicit
-- utf8mb4, no server-side time defaults.

-- Columns the buyer screens and shared components read.
ALTER TABLE catalogues
  ADD COLUMN assigned_field_exec_id VARCHAR(64) NULL,
  ADD COLUMN inspection_contact JSON NULL;

ALTER TABLE lots
  ADD COLUMN sale_basis           VARCHAR(32)  NULL,
  ADD COLUMN known_seller         TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN inspection_report_id VARCHAR(64)  NULL,
  ADD COLUMN inspection_waived    TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN waived_by            VARCHAR(64)  NULL,
  ADD COLUMN waived_reason        TEXT         NULL,
  ADD COLUMN waived_at            DATETIME(3)  NULL,
  ADD COLUMN seller_decision      VARCHAR(16)  NULL,
  ADD COLUMN overrides            JSON         NULL;

-- Files attached to a catalogue (terms PDF, lot list, photos archive).
CREATE TABLE catalogue_documents (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  catalogue_id VARCHAR(64)  NOT NULL,
  name         VARCHAR(255) NOT NULL,
  type         VARCHAR(16)  NOT NULL,
  size         VARCHAR(32)  NULL,
  position     INT          NOT NULL DEFAULT 0,
  KEY idx_cat_docs (catalogue_id, position),
  CONSTRAINT fk_cat_docs_catalogue FOREIGN KEY (catalogue_id) REFERENCES catalogues (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- user_id NULL means a broadcast to everyone, so no foreign key here: the row
-- is deliberately allowed to belong to nobody.
CREATE TABLE notifications (
  id      VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id VARCHAR(64)  NULL,
  kind    VARCHAR(32)  NOT NULL,
  title   VARCHAR(255) NOT NULL,
  body    TEXT         NULL,
  at      DATETIME(3)  NOT NULL,
  is_read TINYINT(1)   NOT NULL DEFAULT 0,
  href    VARCHAR(255) NULL,
  KEY idx_notifications_user_at (user_id, at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- `messages` is a conversation read and written whole, never queried per line.
CREATE TABLE disputes (
  id             VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id        VARCHAR(64)  NOT NULL,
  subject        VARCHAR(255) NOT NULL,
  category       VARCHAR(24)  NOT NULL,
  lot_id         VARCHAR(64)  NULL,
  status         VARCHAR(16)  NOT NULL,
  created_at     DATETIME(3)  NOT NULL,
  messages       JSON         NULL,
  assigned_to_id VARCHAR(64)  NULL,
  outcome        VARCHAR(24)  NULL,
  resolution     TEXT         NULL,
  resolved_at    DATETIME(3)  NULL,
  resolved_by_id VARCHAR(64)  NULL,
  refund_id      VARCHAR(64)  NULL,
  KEY idx_disputes_user (user_id, created_at DESC),
  CONSTRAINT fk_disputes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Only the last four digits of an account number are ever persisted; the masked
-- string is display-ready. The full number is never stored, here or anywhere.
CREATE TABLE bank_accounts (
  id                    VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id               VARCHAR(64)  NOT NULL,
  bank_name             VARCHAR(191) NOT NULL,
  ifsc                  VARCHAR(16)  NOT NULL,
  account_holder_name   VARCHAR(191) NOT NULL,
  last4                 CHAR(4)      NOT NULL,
  account_number_masked VARCHAR(64)  NOT NULL,
  status                VARCHAR(16)  NOT NULL,
  rejection_reason      TEXT         NULL,
  created_at            DATETIME(3)  NOT NULL,
  KEY idx_bank_accounts_user (user_id),
  CONSTRAINT fk_bank_accounts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The platform's own accounts, shown to buyers so they know where to transfer.
CREATE TABLE company_bank_accounts (
  id                    VARCHAR(64)  NOT NULL PRIMARY KEY,
  bank                  VARCHAR(191) NOT NULL,
  account_number_masked VARCHAR(64)  NOT NULL,
  ifsc                  VARCHAR(16)  NOT NULL,
  purpose               VARCHAR(191) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE deposit_claims (
  id               VARCHAR(64)   NOT NULL PRIMARY KEY,
  user_id          VARCHAR(64)   NOT NULL,
  amount           DECIMAL(16,2) NOT NULL,
  utr              VARCHAR(128)  NOT NULL,
  transfer_date    DATETIME(3)   NULL,
  proof_filename   VARCHAR(255)  NULL,
  status           VARCHAR(16)   NOT NULL,
  rejection_reason TEXT          NULL,
  created_at       DATETIME(3)   NOT NULL,
  decided_at       DATETIME(3)   NULL,
  decided_by       VARCHAR(64)   NULL,
  KEY idx_deposit_claims_user (user_id, created_at DESC),
  CONSTRAINT fk_deposit_claims_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Maker-checker: above a configured amount the user who reviewed a withdrawal
-- may not also be the one who released it, so both are recorded separately.
CREATE TABLE withdrawal_requests (
  id              VARCHAR(64)   NOT NULL PRIMARY KEY,
  user_id         VARCHAR(64)   NOT NULL,
  amount          DECIMAL(16,2) NOT NULL,
  bank_account_id VARCHAR(64)   NULL,
  ref             VARCHAR(128)  NULL,
  status          VARCHAR(24)   NOT NULL,
  reason          TEXT          NULL,
  requested_at    DATETIME(3)   NOT NULL,
  decided_at      DATETIME(3)   NULL,
  reviewed_by     VARCHAR(64)   NULL,
  reviewed_at     DATETIME(3)   NULL,
  processed_by    VARCHAR(64)   NULL,
  KEY idx_withdrawals_user (user_id, requested_at DESC),
  CONSTRAINT fk_withdrawals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE inspection_slots (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  catalogue_id VARCHAR(64)  NOT NULL,
  user_id      VARCHAR(64)  NOT NULL,
  slot_date    DATETIME(3)  NULL,
  window_label VARCHAR(64)  NULL,
  persons      INT          NOT NULL DEFAULT 1,
  status       VARCHAR(16)  NOT NULL,
  pass_code    VARCHAR(32)  NULL,
  KEY idx_slots_catalogue (catalogue_id),
  KEY idx_slots_user (user_id),
  CONSTRAINT fk_slots_catalogue FOREIGN KEY (catalogue_id) REFERENCES catalogues (id) ON DELETE CASCADE,
  CONSTRAINT fk_slots_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE demand_drafts (
  id            VARCHAR(64)   NOT NULL PRIMARY KEY,
  do_id         VARCHAR(64)   NOT NULL,
  dd_number     VARCHAR(64)   NOT NULL,
  issuing_bank  VARCHAR(191)  NULL,
  amount        DECIMAL(16,2) NOT NULL,
  issued_at     DATETIME(3)   NOT NULL,
  issued_by     VARCHAR(64)   NULL,
  KEY idx_dd_do (do_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Platform configuration that screens read but nobody edits per-row: the
-- withdrawal window, finance thresholds. One JSON document per key, so adding a
-- setting never needs a migration.
CREATE TABLE app_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  value       JSON        NOT NULL,
  updated_at  DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

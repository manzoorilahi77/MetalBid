-- 007 — the auction floor and the finance desk.
--
-- Auction Manager: announcements, and the three escalations that need someone
-- else's signature before they take effect (cancel a live auction, void a bid,
-- refer an unsold lot to STA), plus the result confirmation that closes a sale.
--
-- Finance: invoices, refunds, EMD forfeitures, the bank statement being
-- reconciled against them, and the CEO queue that gates the large ones.
--
-- Shared: the audit trail, which both roles read and neither owns.
--
-- Same conventions as before: DATETIME(3) in UTC, DECIMAL for money, explicit
-- utf8mb4, no server-side time defaults.

CREATE TABLE announcements (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  scope        VARCHAR(16)  NOT NULL,
  catalogue_id VARCHAR(64)  NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT         NULL,
  at           DATETIME(3)  NOT NULL,
  severity     VARCHAR(16)  NOT NULL,
  KEY idx_announcements_at (at DESC),
  KEY idx_announcements_catalogue (catalogue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Cancelling a published auction is not the Auction Manager's to do alone; the
-- request sits here until a Sub Admin or Super Admin signs it.
CREATE TABLE cancellation_requests (
  id            VARCHAR(64) NOT NULL PRIMARY KEY,
  catalogue_id  VARCHAR(64) NOT NULL,
  reason        TEXT        NULL,
  requested_by  VARCHAR(64) NOT NULL,
  requested_at  DATETIME(3) NOT NULL,
  status        VARCHAR(16) NOT NULL,
  decided_by    VARCHAR(64) NULL,
  decided_at    DATETIME(3) NULL,
  decision_note TEXT        NULL,
  KEY idx_cancellations_catalogue (catalogue_id),
  CONSTRAINT fk_cancellations_catalogue FOREIGN KEY (catalogue_id) REFERENCES catalogues (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Two-stage: a bid is 'flagged' by whoever noticed it, and only becomes
-- 'requested' when someone puts their name to voiding it. Both actors are kept
-- because the audit has to show that they were different people.
CREATE TABLE bid_void_requests (
  id            VARCHAR(64) NOT NULL PRIMARY KEY,
  bid_id        VARCHAR(64) NOT NULL,
  lot_id        VARCHAR(64) NOT NULL,
  catalogue_id  VARCHAR(64) NOT NULL,
  reason        TEXT        NULL,
  notes         TEXT        NULL,
  raised_by     VARCHAR(64) NOT NULL,
  raised_at     DATETIME(3) NOT NULL,
  stage         VARCHAR(16) NOT NULL,
  requested_by  VARCHAR(64) NULL,
  requested_at  DATETIME(3) NULL,
  status        VARCHAR(16) NOT NULL,
  decided_by    VARCHAR(64) NULL,
  decided_at    DATETIME(3) NULL,
  decision_note TEXT        NULL,
  KEY idx_bid_voids_bid (bid_id),
  KEY idx_bid_voids_catalogue (catalogue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Keyed on the catalogue, not an id of its own: a sale is confirmed once or not
-- at all, and the frontend type has no id field for exactly that reason.
CREATE TABLE result_confirmations (
  catalogue_id VARCHAR(64)   NOT NULL PRIMARY KEY,
  confirmed_by VARCHAR(64)   NOT NULL,
  confirmed_at DATETIME(3)   NOT NULL,
  lots_sold    INT           NOT NULL DEFAULT 0,
  lots_unsold  INT           NOT NULL DEFAULT 0,
  realisation  DECIMAL(16,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_result_conf_catalogue FOREIGN KEY (catalogue_id) REFERENCES catalogues (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A lot that did not clear its reserve, referred for a negotiated sale.
CREATE TABLE sta_referrals (
  id           VARCHAR(64) NOT NULL PRIMARY KEY,
  lot_id       VARCHAR(64) NOT NULL,
  catalogue_id VARCHAR(64) NOT NULL,
  note         TEXT        NULL,
  referred_by  VARCHAR(64) NOT NULL,
  referred_at  DATETIME(3) NOT NULL,
  KEY idx_sta_lot (lot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE refund_requests (
  id            VARCHAR(64)   NOT NULL PRIMARY KEY,
  user_id       VARCHAR(64)   NOT NULL,
  amount        DECIMAL(16,2) NOT NULL,
  source        VARCHAR(32)   NOT NULL,
  reason        TEXT          NULL,
  lot_id        VARCHAR(64)   NULL,
  catalogue_id  VARCHAR(64)   NULL,
  dispute_id    VARCHAR(64)   NULL,
  status        VARCHAR(24)   NOT NULL,
  raised_by     VARCHAR(64)   NOT NULL,
  raised_at     DATETIME(3)   NOT NULL,
  decided_by    VARCHAR(64)   NULL,
  decided_at    DATETIME(3)   NULL,
  decision_note TEXT          NULL,
  processed_by  VARCHAR(64)   NULL,
  processed_at  DATETIME(3)   NULL,
  KEY idx_refunds_user (user_id),
  KEY idx_refunds_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE emd_forfeitures (
  id            VARCHAR(64)   NOT NULL PRIMARY KEY,
  buyer_id      VARCHAR(64)   NOT NULL,
  lot_id        VARCHAR(64)   NOT NULL,
  catalogue_id  VARCHAR(64)   NOT NULL,
  amount        DECIMAL(16,2) NOT NULL,
  reason        TEXT          NULL,
  status        VARCHAR(24)   NOT NULL,
  raised_by     VARCHAR(64)   NOT NULL,
  raised_at     DATETIME(3)   NOT NULL,
  decided_by    VARCHAR(64)   NULL,
  decided_at    DATETIME(3)   NULL,
  decision_note TEXT          NULL,
  KEY idx_forfeitures_buyer (buyer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- An invoice is never edited. A correction supersedes it and points back via
-- supersedes_id, so the trail of what was sent to a customer stays intact.
CREATE TABLE invoices (
  id            VARCHAR(64)   NOT NULL PRIMARY KEY,
  number        VARCHAR(64)   NOT NULL,
  kind          VARCHAR(32)   NOT NULL,
  party_id      VARCHAR(64)   NOT NULL,
  catalogue_id  VARCHAR(64)   NOT NULL,
  lot_id        VARCHAR(64)   NULL,
  do_id         VARCHAR(64)   NULL,
  issued_at     DATETIME(3)   NOT NULL,
  issued_by     VARCHAR(64)   NULL,
  taxable       DECIMAL(16,2) NOT NULL,
  gst           DECIMAL(16,2) NOT NULL DEFAULT 0,
  tcs           DECIMAL(16,2) NOT NULL DEFAULT 0,
  total         DECIMAL(16,2) NOT NULL,
  status        VARCHAR(16)   NOT NULL,
  supersedes_id VARCHAR(64)   NULL,
  note          TEXT          NULL,
  UNIQUE KEY uq_invoices_number (number),
  KEY idx_invoices_party (party_id),
  KEY idx_invoices_catalogue (catalogue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The bank's own lines, matched against our records during reconciliation.
-- matched_to is a soft reference: it may point at a deposit, a withdrawal, a
-- commission settlement or a payment, so matched_kind says which table.
CREATE TABLE bank_statement_lines (
  id           VARCHAR(64)   NOT NULL PRIMARY KEY,
  at           DATETIME(3)   NOT NULL,
  account_id   VARCHAR(64)   NOT NULL,
  direction    VARCHAR(8)    NOT NULL,
  amount       DECIMAL(16,2) NOT NULL,
  ref          VARCHAR(128)  NULL,
  narration    VARCHAR(512)  NULL,
  status       VARCHAR(16)   NOT NULL,
  matched_to   VARCHAR(64)   NULL,
  matched_kind VARCHAR(24)   NULL,
  matched_by   VARCHAR(64)   NULL,
  matched_at   DATETIME(3)   NULL,
  break_note   TEXT          NULL,
  escalated    TINYINT(1)    NOT NULL DEFAULT 0,
  KEY idx_bank_lines_status (status),
  KEY idx_bank_lines_at (at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Decisions above a configured rupee threshold wait here for the CEO's
-- signature. `payload` carries the change a signature would apply, for the one
-- kind where approving IS the change — a fee or commission edit, held rather
-- than saved.
CREATE TABLE ceo_approvals (
  id            VARCHAR(64)   NOT NULL PRIMARY KEY,
  kind          VARCHAR(48)   NOT NULL,
  ref_id        VARCHAR(64)   NOT NULL,
  amount        DECIMAL(16,2) NOT NULL DEFAULT 0,
  summary       VARCHAR(512)  NULL,
  reason        TEXT          NULL,
  requested_by  VARCHAR(64)   NOT NULL,
  requested_at  DATETIME(3)   NOT NULL,
  status        VARCHAR(24)   NOT NULL,
  info_note     TEXT          NULL,
  info_asked_at DATETIME(3)   NULL,
  payload       JSON          NULL,
  decided_by    VARCHAR(64)   NULL,
  decided_at    DATETIME(3)   NULL,
  decision_note TEXT          NULL,
  KEY idx_ceo_approvals_status (status, requested_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The record. No foreign key on actor_id: the actor may be 'system' for events
-- nobody triggered by hand, and an audit row must never be deleted or blocked
-- by the state of anything it describes.
CREATE TABLE audit_events (
  id       VARCHAR(64)  NOT NULL PRIMARY KEY,
  at       DATETIME(3)  NOT NULL,
  actor_id VARCHAR(64)  NULL,
  action   VARCHAR(96)  NOT NULL,
  target   VARCHAR(191) NULL,
  detail   TEXT         NULL,
  severity VARCHAR(16)  NOT NULL,
  KEY idx_audit_at (at DESC),
  KEY idx_audit_action (action),
  KEY idx_audit_actor (actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

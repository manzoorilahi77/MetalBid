-- 004 — the buyer workspace: money, shortlists, bids and deliveries.
--
-- Same conventions as 002: DATETIME(3) in UTC, DECIMAL for money, explicit
-- utf8mb4, no server-side time defaults.

-- Two columns the homepage did not need but the buyer screens do.
ALTER TABLE catalogues ADD COLUMN terms_set_id VARCHAR(64) NULL;
ALTER TABLE lots       ADD COLUMN result_h1_rate DECIMAL(14,2) NULL;

-- The terms a buyer accepts before bidding. `general` and `special` are ordered
-- lists of clauses; JSON keeps them as one versioned document rather than
-- scattering clause rows nobody ever queries individually.
CREATE TABLE terms_sets (
  id                VARCHAR(64)  NOT NULL PRIMARY KEY,
  name              VARCHAR(191) NOT NULL,
  version           VARCHAR(32)  NOT NULL,
  general           JSON         NOT NULL,
  special           JSON         NOT NULL,
  lot_specific_note TEXT         NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One wallet per user. `balance` is spendable; `emd_locked` is committed against
-- shortlisted lots and cannot be withdrawn. Both are derived from the ledger in
-- principle, but stored explicitly because every screen reads them and no screen
-- wants to sum 1000+ entries.
CREATE TABLE wallets (
  user_id    VARCHAR(64)   NOT NULL PRIMARY KEY,
  balance    DECIMAL(16,2) NOT NULL DEFAULT 0,
  emd_locked DECIMAL(16,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Append-only money trail. Positive amount = credit to available balance.
CREATE TABLE wallet_ledger (
  id           VARCHAR(64)   NOT NULL PRIMARY KEY,
  user_id      VARCHAR(64)   NOT NULL,
  at           DATETIME(3)   NOT NULL,
  type         VARCHAR(32)   NOT NULL,
  amount       DECIMAL(16,2) NOT NULL,
  ref          VARCHAR(128)  NULL,
  lot_id       VARCHAR(64)   NULL,
  catalogue_id VARCHAR(64)   NULL,
  note         VARCHAR(512)  NULL,
  KEY idx_ledger_user_at (user_id, at DESC),
  CONSTRAINT fk_ledger_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Catalogues a buyer starred.
CREATE TABLE watchlist (
  buyer_id     VARCHAR(64) NOT NULL,
  catalogue_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (buyer_id, catalogue_id),
  CONSTRAINT fk_watchlist_buyer FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_watchlist_catalogue FOREIGN KEY (catalogue_id) REFERENCES catalogues (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A buyer's shortlist within one catalogue. The frontend models this as two
-- parallel string arrays (lotIds, emdFundedLotIds); normalised, "funded" is
-- simply a flag on the shortlisted row, which makes the invariant -- you cannot
-- fund a lot you have not shortlisted -- structural rather than a convention.
CREATE TABLE selection_lots (
  buyer_id     VARCHAR(64) NOT NULL,
  catalogue_id VARCHAR(64) NOT NULL,
  lot_id       VARCHAR(64) NOT NULL,
  emd_funded   TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (buyer_id, catalogue_id, lot_id),
  KEY idx_selection_lot (lot_id),
  CONSTRAINT fk_selection_buyer FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_selection_catalogue FOREIGN KEY (catalogue_id) REFERENCES catalogues (id) ON DELETE CASCADE,
  CONSTRAINT fk_selection_lot FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bids (
  id           VARCHAR(64)   NOT NULL PRIMARY KEY,
  lot_id       VARCHAR(64)   NOT NULL,
  catalogue_id VARCHAR(64)   NOT NULL,
  bidder_id    VARCHAR(64)   NOT NULL,
  rate         DECIMAL(14,2) NOT NULL,
  at           DATETIME(3)   NOT NULL,
  type         VARCHAR(16)   NOT NULL,
  status       VARCHAR(8)    NOT NULL DEFAULT 'valid',
  KEY idx_bids_lot_rate (lot_id, rate DESC),
  KEY idx_bids_bidder_at (bidder_id, at DESC),
  KEY idx_bids_catalogue (catalogue_id),
  CONSTRAINT fk_bids_lot FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE,
  CONSTRAINT fk_bids_bidder FOREIGN KEY (bidder_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE auto_bids (
  buyer_id VARCHAR(64)   NOT NULL,
  lot_id   VARCHAR(64)   NOT NULL,
  max_rate DECIMAL(14,2) NOT NULL,
  active   TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (buyer_id, lot_id),
  CONSTRAINT fk_autobid_buyer FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_autobid_lot FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE emd_exemption_requests (
  id               VARCHAR(64)  NOT NULL PRIMARY KEY,
  buyer_id         VARCHAR(64)  NOT NULL,
  catalogue_id     VARCHAR(64)  NOT NULL,
  reason           TEXT         NULL,
  status           VARCHAR(16)  NOT NULL,
  created_at       DATETIME(3)  NOT NULL,
  decided_at       DATETIME(3)  NULL,
  decided_by       VARCHAR(64)  NULL,
  rejection_reason TEXT         NULL,
  KEY idx_emd_exempt_buyer (buyer_id, catalogue_id),
  CONSTRAINT fk_emd_exempt_buyer FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_emd_exempt_catalogue FOREIGN KEY (catalogue_id) REFERENCES catalogues (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- What a buyer won and how it gets collected. `lifting_checklist` is a short
-- fixed set of steps carried as JSON; it is read and written whole, never queried
-- item by item.
CREATE TABLE delivery_orders (
  id                     VARCHAR(64)   NOT NULL PRIMARY KEY,
  lot_id                 VARCHAR(64)   NOT NULL,
  catalogue_id           VARCHAR(64)   NOT NULL,
  buyer_id               VARCHAR(64)   NOT NULL,
  stage                  VARCHAR(32)   NOT NULL,
  h1_rate                DECIMAL(14,2) NOT NULL,
  awarded_qty            DECIMAL(14,3) NOT NULL,
  uom                    VARCHAR(8)    NOT NULL,
  material_value         DECIMAL(16,2) NOT NULL,
  gst_amount             DECIMAL(16,2) NOT NULL DEFAULT 0,
  tcs_amount             DECIMAL(16,2) NOT NULL DEFAULT 0,
  paid_amount            DECIMAL(16,2) NOT NULL DEFAULT 0,
  lifting_by             DATETIME(3)   NULL,
  created_at             DATETIME(3)   NOT NULL,
  dd_id                  VARCHAR(64)   NULL,
  lifting_checklist      JSON          NULL,
  weighed_qty            DECIMAL(14,3) NULL,
  weighed_by_id          VARCHAR(64)   NULL,
  weighed_at             DATETIME(3)   NULL,
  handover_confirmed_at  DATETIME(3)   NULL,
  handover_confirmed_by  VARCHAR(64)   NULL,
  handover_note          TEXT          NULL,
  KEY idx_do_buyer_stage (buyer_id, stage),
  KEY idx_do_lot (lot_id),
  CONSTRAINT fk_do_lot FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE,
  CONSTRAINT fk_do_buyer FOREIGN KEY (buyer_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

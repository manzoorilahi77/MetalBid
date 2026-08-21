-- 006 — the seller workspace.
--
-- The seller reads catalogues, lots, bids and users, which 002/004/005 already
-- cover. Two entities are new: the field inspection report attached to a lot,
-- and the commission the seller settles with the platform after a sale clears.
--
-- Same conventions as before: DATETIME(3) in UTC, DECIMAL for money, explicit
-- utf8mb4, no server-side time defaults.

-- What the field executive found in the yard. `checklist` is a short fixed list
-- of pass/fail items, read and written whole, so it stays JSON rather than
-- becoming a child table nobody would ever query a single row of.
--
-- No foreign key to lots: a report is written against a lot that exists, but
-- lots can be deleted from a draft catalogue and the report is the evidence
-- record -- it should outlive the row it describes rather than cascade away
-- with it. The seller screens join on lot_id and tolerate a miss.
CREATE TABLE inspection_reports (
  id            VARCHAR(64)   NOT NULL PRIMARY KEY,
  lot_id        VARCHAR(64)   NOT NULL,
  inspector_id  VARCHAR(64)   NULL,
  inspected_at  DATETIME(3)   NULL,
  measured_qty  DECIMAL(14,3) NULL,
  uom           VARCHAR(8)    NULL,
  -- 'condition' is a MySQL reserved word; named lot_condition to avoid
  -- backquoting it at every call site.
  lot_condition VARCHAR(16)   NULL,
  notes         TEXT          NULL,
  checklist     JSON          NULL,
  photo_count   INT           NOT NULL DEFAULT 0,
  status        VARCHAR(16)   NOT NULL,
  KEY idx_inspection_reports_lot (lot_id),
  KEY idx_inspection_reports_inspector (inspector_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The seller's commission payment on a cleared catalogue, and Finance's side of
-- the same record. `status` is Finance's: 'recorded' = the seller says they
-- paid, 'confirmed' = matched against the bank, 'queried' = the reference did
-- not match and the auction stays in Pending settlement.
CREATE TABLE commission_settlements (
  id           VARCHAR(64)   NOT NULL PRIMARY KEY,
  catalogue_id VARCHAR(64)   NOT NULL,
  seller_id    VARCHAR(64)   NOT NULL,
  amount       DECIMAL(16,2) NOT NULL,
  mode         VARCHAR(16)   NOT NULL,
  settled_at   DATETIME(3)   NOT NULL,
  reference    VARCHAR(128)  NULL,
  status       VARCHAR(16)   NULL,
  confirmed_by VARCHAR(64)   NULL,
  confirmed_at DATETIME(3)   NULL,
  query_note   TEXT          NULL,
  KEY idx_commission_catalogue (catalogue_id),
  KEY idx_commission_seller (seller_id, settled_at DESC),
  CONSTRAINT fk_commission_catalogue FOREIGN KEY (catalogue_id) REFERENCES catalogues (id) ON DELETE CASCADE,
  CONSTRAINT fk_commission_seller FOREIGN KEY (seller_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

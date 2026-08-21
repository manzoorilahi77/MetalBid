-- 002 — the entities the homepage renders: users, catalogues, lots, lot photos.
--
-- Conventions, enforced everywhere in this schema:
--   * DATETIME(3) only, never TIMESTAMP — TIMESTAMP is re-read through the
--     session time zone, and this server's clock is EDT. Values are UTC.
--   * No NOW()/CURRENT_TIMESTAMP defaults — the app supplies UTC instants.
--   * Money as DECIMAL(14,2), never FLOAT. mysql2 returns DECIMAL as a string,
--     so rupee arithmetic never rounds through a double.
--   * CHARSET declared per table, so the utf8mb3 database default is irrelevant.
--   * Ids are the prototype's own string keys ('c-2418', 'u-buyer-1'), kept as
--     VARCHAR so seeded fixtures and frontend links stay stable.

CREATE TABLE users (
  id              VARCHAR(64)  NOT NULL PRIMARY KEY,
  name            VARCHAR(191) NOT NULL,
  firm            VARCHAR(191) NULL,
  phone           VARCHAR(32)  NULL,
  email           VARCHAR(191) NULL,
  role            VARCHAR(32)  NOT NULL,
  kyc_status      VARCHAR(16)  NOT NULL DEFAULT 'none',
  seller_verified TINYINT(1)   NOT NULL DEFAULT 0,
  standing        VARCHAR(16)  NOT NULL DEFAULT 'good',
  city            VARCHAR(96)  NULL,
  gstin           VARCHAR(24)  NULL,
  avatar_hue      SMALLINT     NOT NULL DEFAULT 0,
  bidder_id       VARCHAR(16)  NULL,
  joined_at       DATETIME(3)  NULL,
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE catalogues (
  id                 VARCHAR(64)  NOT NULL PRIMARY KEY,
  code               VARCHAR(32)  NOT NULL,
  title              VARCHAR(255) NOT NULL,
  seller_id          VARCHAR(64)  NOT NULL,
  type               VARCHAR(16)  NOT NULL,
  status             VARCHAR(16)  NOT NULL,
  starts_at          DATETIME(3)  NOT NULL,
  ends_at            DATETIME(3)  NOT NULL,
  emd_deadline       DATETIME(3)  NULL,
  emd_opens_at       DATETIME(3)  NULL,
  inspection_from    DATETIME(3)  NULL,
  inspection_to      DATETIME(3)  NULL,
  inspection_hours   VARCHAR(64)  NULL,
  yard_name          VARCHAR(191) NULL,
  yard_address       VARCHAR(512) NULL,
  region             VARCHAR(128) NULL,
  anti_snipe_minutes INT          NOT NULL DEFAULT 5,
  bid_validity_days  INT          NOT NULL DEFAULT 7,
  description        TEXT         NULL,
  UNIQUE KEY uq_catalogues_code (code),
  KEY idx_catalogues_status_ends (status, ends_at),
  CONSTRAINT fk_catalogues_seller FOREIGN KEY (seller_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE lots (
  id                VARCHAR(64)    NOT NULL PRIMARY KEY,
  lot_no            VARCHAR(32)    NOT NULL,
  catalogue_id      VARCHAR(64)    NULL,
  seller_id         VARCHAR(64)    NOT NULL,
  metal             VARCHAR(64)    NOT NULL,
  category          VARCHAR(48)    NOT NULL,
  grade             VARCHAR(64)    NULL,
  indicative_qty    DECIMAL(14,3)  NOT NULL,
  uom               VARCHAR(8)     NOT NULL,
  yard              VARCHAR(191)   NULL,
  description       TEXT           NULL,
  start_rate        DECIMAL(14,2)  NOT NULL,
  increment         DECIMAL(14,2)  NOT NULL,
  reserve_rate      DECIMAL(14,2)  NOT NULL,   -- never exposed to buyers
  pre_bid_emd       DECIMAL(14,2)  NOT NULL,
  hazardous         TINYINT(1)     NOT NULL DEFAULT 0,
  status            VARCHAR(24)    NOT NULL,
  current_rate      DECIMAL(14,2)  NULL,
  leading_bidder_id VARCHAR(64)    NULL,
  bid_count         INT            NOT NULL DEFAULT 0,
  ends_at           DATETIME(3)    NOT NULL,
  extensions        INT            NOT NULL DEFAULT 0,
  KEY idx_lots_catalogue (catalogue_id),
  KEY idx_lots_status (status),
  CONSTRAINT fk_lots_catalogue FOREIGN KEY (catalogue_id) REFERENCES catalogues (id) ON DELETE SET NULL,
  CONSTRAINT fk_lots_seller FOREIGN KEY (seller_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE lot_photos (
  id       VARCHAR(64)  NOT NULL PRIMARY KEY,
  lot_id   VARCHAR(64)  NOT NULL,
  label    VARCHAR(96)  NOT NULL,
  hue      SMALLINT     NOT NULL,
  position INT          NOT NULL DEFAULT 0,
  KEY idx_lot_photos_lot (lot_id, position),
  CONSTRAINT fk_lot_photos_lot FOREIGN KEY (lot_id) REFERENCES lots (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

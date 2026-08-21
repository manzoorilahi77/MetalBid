-- ---------------------------------------------------------------------------
-- 010 — The CMS, and the section registry.
--
-- Implements the Content Atlas. Two ideas, and they are separate on purpose:
--
--   cms_block         WHAT a section says   — copy, images, links, lists
--   section_registry  WHETHER it appears    — one row per section, per page,
--                                             per role, with an on/off switch
--
-- Keeping them apart is what lets an operator switch a section off without
-- deleting the words in it, and lets them edit words that are currently hidden.
--
-- Ownership follows the roles decision: the **Sub Admin** creates, edits,
-- publishes and switches. The Super Admin is a vendor-held superset and appears
-- nowhere in the routine path. The one gate that remains is the CEO's, on
-- pricing and legal copy, because that copy commits the company in public — and
-- that gate sits between two company roles, so it survives the Super Admin
-- never signing in.
--
-- Versioning: a block row is the CURRENT draft. Every publish snapshots the
-- published value into cms_block_versions, so "roll back" restores a real
-- previous version rather than an empty box.
-- ---------------------------------------------------------------------------

CREATE TABLE cms_block (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  page_key      VARCHAR(64)  NOT NULL,          -- 'home' | 'privacy' | 'buyer_dashboard'
  section_key   VARCHAR(64)  NOT NULL,          -- 'hero' | 'how_it_works'
  block_key     VARCHAR(64)  NOT NULL,          -- 'headline' | 'tracks'
  kind          VARCHAR(24)  NOT NULL,          -- text | richtext | image | link | list | faq | number_label
  locale        VARCHAR(12)  NOT NULL DEFAULT 'en',

  draft_value   JSON         NULL,              -- what an editor is working on
  published_value JSON       NULL,              -- what the public site serves
  status        VARCHAR(16)  NOT NULL DEFAULT 'draft',
                                                -- draft | in_review | ceo_pending | published | returned
  version       INT          NOT NULL DEFAULT 0,

  authored_by   VARCHAR(64)  NULL,
  published_by  VARCHAR(64)  NULL,
  signed_by     VARCHAR(64)  NULL,              -- the CEO, for pricing and legal
  note          TEXT         NULL,              -- why it was returned, or what changed

  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    DATETIME(3)  NOT NULL,
  updated_at    DATETIME(3)  NOT NULL,
  published_at  DATETIME(3)  NULL,

  UNIQUE KEY uq_cms_block (page_key, section_key, block_key, locale),
  KEY idx_cms_block_page (page_key, section_key, sort_order),
  KEY idx_cms_block_status (status, updated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Every published version, kept. Rollback reads from here.
CREATE TABLE cms_block_versions (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  block_id     VARCHAR(64)  NOT NULL,
  version      INT          NOT NULL,
  value        JSON         NULL,
  published_by VARCHAR(64)  NULL,
  signed_by    VARCHAR(64)  NULL,
  published_at DATETIME(3)  NOT NULL,
  note         TEXT         NULL,
  UNIQUE KEY uq_cms_version (block_id, version),
  KEY idx_cms_version_block (block_id, version DESC),
  CONSTRAINT fk_cms_version_block FOREIGN KEY (block_id) REFERENCES cms_block (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Which sections exist, and whether they are switched on.
--
-- One row per section on EVERY page of EVERY portal, not just the public site.
-- `role` is '*' for "every role that can see this page", or a role key to make
-- the switch role-specific. It is NOT NULL and carries a sentinel rather than
-- being nullable because it is part of the primary key, and MySQL will not put
-- NULL in one -- which also spares every query a three-valued comparison.
--
-- `toggleable = 0` is not an oversight, and `locked_reason` is why it exists:
-- a switch that is missing has to say so on the screen, or the next person to
-- look assumes it was forgotten and adds one.
-- ---------------------------------------------------------------------------
CREATE TABLE section_registry (
  section_key   VARCHAR(64)  NOT NULL,
  page_route    VARCHAR(128) NOT NULL,
  role          VARCHAR(32)  NOT NULL DEFAULT '*',
  title         VARCHAR(191) NOT NULL,
  description   VARCHAR(512) NULL,
  source_class  VARCHAR(16)  NOT NULL,          -- cms | portal | api | live | own
  enabled       TINYINT(1)   NOT NULL DEFAULT 1,
  toggleable    TINYINT(1)   NOT NULL DEFAULT 1,
  locked_reason VARCHAR(255) NULL,
  review_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order    INT          NOT NULL DEFAULT 0,
  updated_by    VARCHAR(64)  NULL,
  updated_at    DATETIME(3)  NOT NULL,
  PRIMARY KEY (page_route, section_key, role),
  KEY idx_section_route (page_route, enabled, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Every publish, every toggle, every rollback — with what it was before.
CREATE TABLE content_change_log (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  target      VARCHAR(32)  NOT NULL,            -- cms_block | section_registry | media
  target_id   VARCHAR(191) NOT NULL,
  action      VARCHAR(32)  NOT NULL,            -- edit | publish | unpublish | toggle | rollback | delete
  before_json JSON         NULL,
  after_json  JSON         NULL,
  actor_id    VARCHAR(64)  NULL,
  actor_role  VARCHAR(32)  NULL,
  reason      VARCHAR(512) NULL,
  at          DATETIME(3)  NOT NULL,
  KEY idx_ccl_target (target, target_id, at DESC),
  KEY idx_ccl_at (at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Uploaded files — inspection photos, KYC documents, CMS media.
--
-- The bytes live on disk (or in object storage later); this is the index. Two
-- columns carry the weight:
--
--   `sha256`     the same file uploaded twice is stored once
--   `visibility` who may fetch it. A KYC document and a catalogue photo are
--                both "an upload", and exactly one of them is public.
-- ---------------------------------------------------------------------------
CREATE TABLE uploads (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  kind          VARCHAR(32)  NOT NULL,          -- lot_photo | inspection | kyc | cms_media | dispute | deposit_proof
  visibility    VARCHAR(16)  NOT NULL,          -- public | authenticated | owner | staff
  owner_id      VARCHAR(64)  NULL,              -- who it belongs to, for 'owner'
  entity_type   VARCHAR(32)  NULL,              -- lot | catalogue | dispute | user
  entity_id     VARCHAR(64)  NULL,
  filename      VARCHAR(255) NOT NULL,          -- as uploaded, sanitised
  mime          VARCHAR(96)  NOT NULL,
  bytes         INT          NOT NULL,
  sha256        CHAR(64)     NOT NULL,
  storage_path  VARCHAR(512) NOT NULL,
  width         INT          NULL,
  height        INT          NULL,
  alt_text      VARCHAR(255) NULL,
  uploaded_by   VARCHAR(64)  NULL,
  uploaded_at   DATETIME(3)  NOT NULL,
  deleted_at    DATETIME(3)  NULL,
  KEY idx_uploads_entity (entity_type, entity_id),
  KEY idx_uploads_owner (owner_id),
  KEY idx_uploads_sha (sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Photos were a colour hue in the prototype. Point them at a real file when one
-- exists, and keep the hue as the placeholder it always was.
ALTER TABLE lot_photos
  ADD COLUMN upload_id VARCHAR(64) NULL AFTER lot_id,
  ADD KEY idx_lot_photos_upload (upload_id);

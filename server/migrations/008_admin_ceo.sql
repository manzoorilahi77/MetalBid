-- 008 — Sub Admin, Super Admin and the CEO queue.
--
-- Most of what these three roles read already exists: they supervise the other
-- roles' records rather than owning their own. What is new here is the
-- platform's own SHAPE — which roles exist, which pages each one sees, and the
-- log of every change to that shape — plus the supervisory records (action
-- reviews, shift handover notes, content drafts) and the master data behind the
-- dropdowns.
--
-- Same conventions as before: DATETIME(3) in UTC, DECIMAL for money, explicit
-- utf8mb4, no server-side time defaults.

-- The roles the platform has. Keyed on `key`, not a surrogate id, because every
-- other table refers to a role by that string ('buyer', 'exec_manager').
-- Removed roles are kept with status='removed' rather than deleted: the audit
-- and the change history point at them.
CREATE TABLE role_registry (
  role_key       VARCHAR(48)  NOT NULL PRIMARY KEY,
  label          VARCHAR(96)  NOT NULL,
  home           VARCHAR(128) NULL,
  built_in       TINYINT(1)   NOT NULL DEFAULT 0,
  status         VARCHAR(16)  NOT NULL,
  created_at     DATETIME(3)  NULL,
  created_by     VARCHAR(64)  NULL,
  removed_at     DATETIME(3)  NULL,
  removed_by     VARCHAR(64)  NULL,
  removed_reason TEXT         NULL,
  based_on       VARCHAR(48)  NULL,
  note           TEXT         NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Every page every role can see, and where it appears in the navigation. The
-- Super Admin's Page Manager edits these rows, and the app builds both the top
-- nav and the sub nav from them -- so this table IS the navigation, not a
-- description of it. `active_match` is a short list of path prefixes, carried as
-- JSON because it is read whole and never queried element by element.
CREATE TABLE page_registry (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  role_key      VARCHAR(48)  NOT NULL,
  destination   VARCHAR(191) NOT NULL,
  label         VARCHAR(96)  NOT NULL,
  sub_label     VARCHAR(96)  NULL,
  is_end        TINYINT(1)   NOT NULL DEFAULT 0,
  locked        TINYINT(1)   NOT NULL DEFAULT 0,
  in_top        TINYINT(1)   NOT NULL DEFAULT 0,
  in_sub        TINYINT(1)   NOT NULL DEFAULT 0,
  active_match  JSON         NULL,
  hidden        TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order    INT          NOT NULL DEFAULT 0,
  built_in      TINYINT(1)   NOT NULL DEFAULT 0,
  retained      TINYINT(1)   NOT NULL DEFAULT 0,
  attached_from VARCHAR(48)  NULL,
  category      VARCHAR(96)  NULL,
  KEY idx_page_registry_role (role_key, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Every change to the shape above, with enough of the prior state to undo it.
-- `snapshot` holds the structure as it was, which is what a rollback restores.
CREATE TABLE structural_changes (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  at         DATETIME(3)  NOT NULL,
  by_id      VARCHAR(64)  NOT NULL,
  kind       VARCHAR(48)  NOT NULL,
  target     VARCHAR(191) NULL,
  summary    VARCHAR(512) NULL,
  before_val TEXT         NULL,
  after_val  TEXT         NULL,
  snapshot   JSON         NULL,
  undone_at  DATETIME(3)  NULL,
  undone_by  VARCHAR(64)  NULL,
  KEY idx_structural_changes_at (at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A temporary password issued by an admin, shown to them once so they can pass
-- it on.
--
-- SECURITY: `password` is plaintext, which mirrors what the prototype does and
-- is acceptable ONLY because no real credential has ever been in it (the table
-- seeds empty). Before this platform holds a real account, this must become a
-- single-use, hashed, expiring token -- the admin should be able to trigger a
-- reset without ever being able to read the result.
CREATE TABLE password_resets (
  id       VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id  VARCHAR(64) NOT NULL,
  mode     VARCHAR(16) NOT NULL,
  password VARCHAR(128) NULL,
  at       DATETIME(3) NOT NULL,
  by_id    VARCHAR(64) NOT NULL,
  consumed TINYINT(1)  NOT NULL DEFAULT 0,
  KEY idx_password_resets_user (user_id, at DESC),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Proposed edits to site copy. `before` and `after` are kept side by side so a
-- reviewer sees the change rather than only the result.
CREATE TABLE content_drafts (
  id           VARCHAR(64)  NOT NULL PRIMARY KEY,
  page         VARCHAR(128) NOT NULL,
  section      VARCHAR(128) NOT NULL,
  author_id    VARCHAR(64)  NOT NULL,
  submitted_at DATETIME(3)  NOT NULL,
  before_text  TEXT         NULL,
  after_text   TEXT         NULL,
  status       VARCHAR(16)  NOT NULL,
  needs_ceo    TINYINT(1)   NOT NULL DEFAULT 0,
  note         TEXT         NULL,
  decided_at   DATETIME(3)  NULL,
  decided_by   VARCHAR(64)  NULL,
  KEY idx_content_drafts_status (status, submitted_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The Sub Admin's verdict on something another role did. Points at an audit
-- event rather than at the record itself: what is being reviewed is the ACTION,
-- and the action is what the audit trail holds.
CREATE TABLE action_reviews (
  id            VARCHAR(64) NOT NULL PRIMARY KEY,
  event_id      VARCHAR(64) NOT NULL,
  verdict       VARCHAR(16) NOT NULL,
  note          TEXT        NULL,
  at            DATETIME(3) NOT NULL,
  by_id         VARCHAR(64) NOT NULL,
  escalated_to  VARCHAR(48) NULL,
  KEY idx_action_reviews_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- What the shift before this one left behind.
CREATE TABLE handover_notes (
  id    VARCHAR(64) NOT NULL PRIMARY KEY,
  by_id VARCHAR(64) NOT NULL,
  at    DATETIME(3) NOT NULL,
  body  TEXT        NULL,
  KEY idx_handover_notes_at (at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Master data behind the dropdowns. Built-in rows can be deactivated but not
-- deleted, so `active` is a flag rather than a DELETE.
CREATE TABLE master_categories (
  category_key VARCHAR(48) NOT NULL PRIMARY KEY,
  label        VARCHAR(96) NOT NULL,
  hue          SMALLINT    NOT NULL DEFAULT 0,
  built_in     TINYINT(1)  NOT NULL DEFAULT 0,
  active       TINYINT(1)  NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE master_uoms (
  code      VARCHAR(16) NOT NULL PRIMARY KEY,
  label     VARCHAR(96) NOT NULL,
  precision_note VARCHAR(64) NULL,
  built_in  TINYINT(1)  NOT NULL DEFAULT 0,
  active    TINYINT(1)  NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE master_yards (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  name          VARCHAR(191) NOT NULL,
  region        VARCHAR(128) NULL,
  address       VARCHAR(512) NULL,
  contact_name  VARCHAR(128) NULL,
  contact_phone VARCHAR(32)  NULL,
  built_in      TINYINT(1)   NOT NULL DEFAULT 0,
  active        TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 011 — Testimonials.
--
-- The fourth "from the portals" section named on the Home page brief, and the
-- one the Content Atlas marks as `portal` sourced: a buyer or seller writes
-- it from their own workspace, a Sub Admin moderates it before anyone else
-- sees it, and only then does it reach the marketplace front door.
--
-- Deliberately its own table rather than a CMS block: a CMS block is one
-- thing an editor writes: a testimonial is many things other people write,
-- that an editor only approves or declines. The shape is a moderation queue,
-- not a document.
-- ---------------------------------------------------------------------------

CREATE TABLE testimonials (
  id             VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id        VARCHAR(64)  NOT NULL,
  role           VARCHAR(20)  NOT NULL,          -- 'buyer' | 'seller' at the time of submission
  quote          TEXT         NOT NULL,
  rating         TINYINT      NULL,               -- 1-5, optional
  status         VARCHAR(16)  NOT NULL DEFAULT 'pending',
                                                   -- pending | approved | rejected
  submitted_at   DATETIME(3)  NOT NULL,
  moderated_by   VARCHAR(64)  NULL,
  moderated_at   DATETIME(3)  NULL,
  moderation_note VARCHAR(500) NULL,

  KEY idx_testimonials_status (status, submitted_at DESC),
  KEY idx_testimonials_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

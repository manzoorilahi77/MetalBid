-- 001 — make the database default utf8mb4.
--
-- The database was created as utf8mb3, which cannot store 4-byte UTF-8:
-- emoji and a range of Indic characters error or truncate on insert.
-- Safe to run while the schema is empty (0 tables); it only changes the
-- DEFAULT applied to tables created afterwards and touches no data.
--
-- Scope: our own schema only. Nothing server-wide, no other account affected.

ALTER DATABASE `aspirfxc_ferrobid_dev_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

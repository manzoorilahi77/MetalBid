-- 003 — lots.ends_at becomes nullable.
--
-- A lot's close time is not a property of the lot itself; it is assigned when
-- the lot is scheduled into a published catalogue. Lots that were never
-- scheduled -- and closed lots whose close time was never recorded -- have no
-- meaningful value here, and NOT NULL forced a fabricated one.

ALTER TABLE lots MODIFY COLUMN ends_at DATETIME(3) NULL;

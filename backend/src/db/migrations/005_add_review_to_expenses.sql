-- 005: add the `review` flag to `expenses` (matches the latest schema.sql).
-- Existing rows backfill to 'no' through the column default.
-- `issued_ref_id` is intentionally left untouched: live code reads and
-- writes it (create/list/delete-guard), so dropping it would break the app.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS review VARCHAR(20) NOT NULL DEFAULT 'no';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_review_check'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_review_check CHECK (review IN ('yes', 'no'));
  END IF;
END $$;

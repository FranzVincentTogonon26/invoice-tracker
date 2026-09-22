-- ============================================================
-- RECEIPT MEDIA → EXPENSES
-- ============================================================
-- The Add Expenses save keeps the scanned attachment (`image_url`) and the date
-- printed on the receipt (`receipt_date`) on the `expenses` rows it creates —
-- one value per line — while `receipt` only keeps the OCR line details. A
-- database created before that split still has the columns on `receipt` (and
-- may be missing them on `expenses`), so this migration moves them over.
--
-- Every statement is guarded so the file is safe to re-run.
--
-- NOTE: the two DROP statements delete the superseded `receipt` columns. If you
-- want to keep whatever they hold as historical data, comment them out — nothing
-- in the API reads them.
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS receipt_date TIMESTAMPTZ;

ALTER TABLE receipt
    DROP COLUMN IF EXISTS image_url;

ALTER TABLE receipt
    DROP COLUMN IF EXISTS receipt_date;

-- 006: drop `expenses.issued_ref_id`. Nothing reads or writes it anymore
-- (create/list/validation/delete-guard were all cut in code first), so the
-- column — and the foreign key hanging off it — can go. No data loss beyond
-- the link values themselves; all expense rows are preserved.
ALTER TABLE expenses DROP COLUMN IF EXISTS issued_ref_id;

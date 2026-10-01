-- ============================================================
-- DROP BUDGET_TRANSFER_RECEIVED (single-table transfers)
-- ============================================================
-- `budget_transfer_received` only mirrored `budget_transfer` — the recipient
-- is already `budget_transfer.transfer_to`, so every received total is read
-- from that column instead. Dropping the mirror removes the dual-write and
-- the risk of the two tables disagreeing.
--
-- Every statement is guarded / idempotent so the file is safe to re-run.

DROP TABLE IF EXISTS budget_transfer_received;

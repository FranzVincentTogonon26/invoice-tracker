-- ============================================================
-- EXPENSES: align the table with the Add Expenses form
-- ============================================================
-- 1. `issued_ref_id` was NOT NULL, so no expense could be logged without a
--    budget issuance behind it. An admin filing expenses manually has none,
--    which made every POST /expenses fail. Make the column nullable.
ALTER TABLE expenses
    ALTER COLUMN issued_ref_id DROP NOT NULL;


-- 2. The Add Expenses form collects a date per line, but the table only had
--    `created_at` — whatever date the user picked was silently dropped.
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS expense_date DATE NOT NULL DEFAULT CURRENT_DATE;


-- 3. The expenses page filters/orders by that date.
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date
    ON expenses(expense_date);


-- 4. The Add Expenses form picks a budget reference (SelectSourceFund) to fund
--    the draft, but the table had nowhere to keep it — only `issued_ref_id`
--    (a budget *issuance* to an employee, optional) existed. Store the chosen
--    reference so the ledger can report balance per source like Budget does.
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS reference_id UUID
        REFERENCES budget_reference(reference_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_reference_id
    ON expenses(reference_id);

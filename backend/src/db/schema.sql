CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS

CREATE TABLE IF NOT EXISTS users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password      TEXT NOT NULL,
    role          VARCHAR(50) NOT NULL DEFAULT 'employee'
                  CHECK (role IN ('admin', 'employee')),
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('active', 'inactive', 'pending')),
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTP

CREATE TABLE IF NOT EXISTS otp (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    otp          VARCHAR(255) NOT NULL,
    email        VARCHAR(255) UNIQUE NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CATEGORY

CREATE TABLE IF NOT EXISTS category (
    category_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name  TEXT NOT NULL
);

-- RECEIPT

CREATE TABLE IF NOT EXISTS receipt (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description  TEXT NOT NULL,
    qty          INTEGER NOT NULL DEFAULT 1,
    rate         DECIMAL(12,2) NOT NULL,
    amount       DECIMAL(12,2) NOT NULL,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (qty > 0),
    CHECK (rate >= 0),
    CHECK (amount >= 0)
);

-- BUDGET REFERENCES

CREATE TABLE IF NOT EXISTS budget_reference (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id   UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    label          TEXT,
    balance_amount DECIMAL(12,2),
    notes          TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'cut_off')),
    date_cut_off   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (balance_amount IS NULL OR balance_amount >= 0)
);

-- BUDGET

CREATE TABLE IF NOT EXISTS budget (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id   UUID NOT NULL
                   REFERENCES budget_reference(reference_id)
                   ON DELETE CASCADE,
    amount         DECIMAL(12,2) NOT NULL,
    description    TEXT NOT NULL,
    method         VARCHAR(255) NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'added' 
                   CHECK (
                       status IN (
                           'draft', 
                           'cancelled',
                           'added' 
                       )
                   ),
    approved_by    VARCHAR(255) NOT NULL,
    submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at    TIMESTAMPTZ,
    cancelled_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (amount >= 0)
);

-- BUDGET ISSUED REFERENCES

CREATE TABLE IF NOT EXISTS budget_issued_reference (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id    UUID NOT NULL REFERENCES budget_reference(reference_id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notes           TEXT,
    covered_amount  DECIMAL(12,2),
    status          VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'close')),
    date_cut_off    TIMESTAMPTZ,
    date_forwarded  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        covered_amount IS NULL
        OR covered_amount >= 0
    )
);

-- ISSUED BUDGET

CREATE TABLE IF NOT EXISTS issued_budget (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issued_ref_id UUID NOT NULL REFERENCES budget_issued_reference(id) ON DELETE CASCADE,
    amount        DECIMAL(12,2) NOT NULL,
    description   TEXT NOT NULL,
    method        VARCHAR(255) NOT NULL,
    notes         TEXT,
    isMark        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (amount >= 0)
);

-- TRANSFER BUDGET

CREATE TABLE IF NOT EXISTS transfer_budget (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issued_ref_id UUID NOT NULL REFERENCES budget_issued_reference(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount        DECIMAL(12,2) NOT NULL,
    notes         TEXT,
    method        VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (amount >= 0)
);

-- EXPENSES

CREATE TABLE IF NOT EXISTS expenses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issued_ref_id UUID NOT NULL
                  REFERENCES budget_issued_reference(id)
                  ON DELETE CASCADE,
    description   TEXT NOT NULL,
    category_id   UUID
                  REFERENCES category(category_id)
                  ON DELETE SET NULL,
    total_amount  DECIMAL(12,2) NOT NULL,
    receipt_id    UUID
                  REFERENCES receipt(id)
                  ON DELETE SET NULL,
    discounted    DECIMAL(12,2),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (total_amount >= 0),
    CHECK (
        discounted IS NULL
        OR discounted >= 0
    )
);


-- =========================================================
-- INDEXES
-- =========================================================


-- ---------------------------------------------------------
-- USERS
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_status
    ON users(status);

CREATE INDEX IF NOT EXISTS idx_users_role_status
    ON users(role, status);

CREATE INDEX IF NOT EXISTS idx_users_created_at
    ON users(created_at);


-- ---------------------------------------------------------
-- OTP
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_otp_expires_at
    ON otp(expires_at);


-- ---------------------------------------------------------
-- CATEGORY
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_category_category_name
    ON category(category_name);


-- ---------------------------------------------------------
-- RECEIPT
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_receipt_created_at
    ON receipt(created_at);


-- ---------------------------------------------------------
-- BUDGET REFERENCE
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_budget_reference_status
    ON budget_reference(status);

CREATE INDEX IF NOT EXISTS idx_budget_reference_created_at
    ON budget_reference(created_at);


-- ---------------------------------------------------------
-- BUDGET
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_budget_reference_id
    ON budget(reference_id);

CREATE INDEX IF NOT EXISTS idx_budget_status
    ON budget(status);

CREATE INDEX IF NOT EXISTS idx_budget_submitted_at
    ON budget(submitted_at);

CREATE INDEX IF NOT EXISTS idx_budget_approved_at
    ON budget(approved_at);

CREATE INDEX IF NOT EXISTS idx_budget_created_at
    ON budget(created_at);

CREATE INDEX IF NOT EXISTS idx_budget_reference_status
    ON budget(reference_id, status);


-- ---------------------------------------------------------
-- BUDGET ISSUED REFERENCE
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_reference_id
    ON budget_issued_reference(reference_id);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_user_id
    ON budget_issued_reference(user_id);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_status
    ON budget_issued_reference(status);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_user_status
    ON budget_issued_reference(user_id, status);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_created_at
    ON budget_issued_reference(created_at);


-- ---------------------------------------------------------
-- ISSUED BUDGET
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_issued_budget_issued_ref_id
    ON issued_budget(issued_ref_id);

CREATE INDEX IF NOT EXISTS idx_issued_budget_created_at
    ON issued_budget(created_at);


-- ---------------------------------------------------------
-- TRANSFER BUDGET
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_transfer_budget_issued_ref_id
    ON transfer_budget(issued_ref_id);

CREATE INDEX IF NOT EXISTS idx_transfer_budget_user_id
    ON transfer_budget(user_id);

CREATE INDEX IF NOT EXISTS idx_transfer_budget_user_issued_ref
    ON transfer_budget(user_id, issued_ref_id);

CREATE INDEX IF NOT EXISTS idx_transfer_budget_created_at
    ON transfer_budget(created_at);


-- ---------------------------------------------------------
-- EXPENSES
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_expenses_issued_ref_id
    ON expenses(issued_ref_id);

CREATE INDEX IF NOT EXISTS idx_expenses_category_id
    ON expenses(category_id);

CREATE INDEX IF NOT EXISTS idx_expenses_receipt_id
    ON expenses(receipt_id);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at
    ON expenses(created_at);

CREATE INDEX IF NOT EXISTS idx_expenses_issued_ref_category
    ON expenses(issued_ref_id, category_id);


-- =========================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

DROP TRIGGER IF EXISTS trg_users_updated_at
ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_receipt_updated_at
ON receipt;

CREATE TRIGGER trg_receipt_updated_at
BEFORE UPDATE ON receipt
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_budget_updated_at
ON budget;

CREATE TRIGGER trg_budget_updated_at
BEFORE UPDATE ON budget
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_issued_budget_updated_at
ON issued_budget;

CREATE TRIGGER trg_issued_budget_updated_at
BEFORE UPDATE ON issued_budget
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_transfer_budget_updated_at
ON transfer_budget;

CREATE TRIGGER trg_transfer_budget_updated_at
BEFORE UPDATE ON transfer_budget
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS trg_expenses_updated_at
ON expenses;

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
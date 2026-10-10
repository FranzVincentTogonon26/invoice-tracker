-- ============================================================
-- BUDGET & INVOICE TRACKING SYSTEM
-- PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    email          VARCHAR(255) UNIQUE NOT NULL,
    password       TEXT NOT NULL,
    role           VARCHAR(50) NOT NULL DEFAULT 'employee'
                   CHECK (role IN ('admin', 'employee')),
    status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('active', 'inactive', 'pending')),
    avatar_url     TEXT,
    last_activity  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- OTP
-- ============================================================

CREATE TABLE IF NOT EXISTS otp (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    otp         VARCHAR(255) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GEMINI MODEL
-- ============================================================

CREATE TABLE IF NOT EXISTS geminiModel (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model       VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUDGET REFERENCES
-- ============================================================

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
    CHECK (
        balance_amount IS NULL
        OR balance_amount >= 0
    )
);

-- ============================================================
-- BUDGET
-- ============================================================

CREATE TABLE IF NOT EXISTS budget (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id  UUID NOT NULL
                  REFERENCES budget_reference(reference_id)
                  ON DELETE CASCADE,
    amount        DECIMAL(12,2) NOT NULL,
    description   TEXT NOT NULL,
    method        VARCHAR(255) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'added'
                  CHECK (status IN ('closed', 'cancelled', 'added')),
    approved_by   VARCHAR(255) NOT NULL,
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at   TIMESTAMPTZ,
    cancelled_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (amount >= 0)
);

-- ============================================================
-- BUDGET ISSUED REFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_issued_reference (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id    UUID NOT NULL
                    REFERENCES budget_reference(reference_id)
                    ON DELETE CASCADE,
    user_id         UUID NOT NULL
                    REFERENCES users(user_id)
                    ON DELETE CASCADE,
    notes           TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'close', 'cancel')),
    date_cut_off    TIMESTAMPTZ,
    date_forwarded  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RECEIPT
-- ============================================================

CREATE TABLE IF NOT EXISTS receipt (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id  VARCHAR(255) NOT NULL DEFAULT gen_random_uuid()::TEXT,
    vendor      TEXT,
    description TEXT,
    qty         INTEGER DEFAULT 1,
    rate        DECIMAL(12,2) DEFAULT 0,
    amount      DECIMAL(12,2) DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ISSUED BUDGET
-- ============================================================

CREATE TABLE IF NOT EXISTS issued_budget (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issued_ref_id UUID NOT NULL
                  REFERENCES budget_issued_reference(id)
                  ON DELETE CASCADE,
    amount        DECIMAL(12,2) NOT NULL,
    description   TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'added'
                  CHECK (status IN ('added', 'cancel')),
    method        VARCHAR(255) NOT NULL,
    receipt_id    UUID
                  REFERENCES receipt(id)
                  ON DELETE SET NULL,
    image_url     TEXT,
    receipt_date  TIMESTAMPTZ,
    notes         TEXT,
    isMark        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (amount >= 0)
);

-- ============================================================
-- EMPLOYEE ABONO
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_abono (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id  UUID NOT NULL
                  REFERENCES budget_reference(reference_id)
                  ON DELETE CASCADE,
    issued_ref_id UUID NOT NULL
                  REFERENCES budget_issued_reference(id)
                  ON DELETE CASCADE,
    user_id       UUID NOT NULL
                  REFERENCES users(user_id)
                  ON DELETE CASCADE,
    amount        DECIMAL(12,2) NOT NULL,
    description   TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'settled', 'draft')),
    date_settled  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (amount >= 0)
);

-- ============================================================
-- BUDGET TRANSFER
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_transfer (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id  UUID NOT NULL
                  REFERENCES budget_reference(reference_id)
                  ON DELETE CASCADE,
    issued_ref_id UUID NOT NULL
                  REFERENCES budget_issued_reference(id)
                  ON DELETE CASCADE,
    user_id       UUID NOT NULL
                  REFERENCES users(user_id)
                  ON DELETE CASCADE,
    amount        DECIMAL(12,2) NOT NULL,
    notes         TEXT,
    method        VARCHAR(255) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'success'
                  CHECK (status IN ('success', 'cancel')),
    transfer_to   UUID NOT NULL
                  REFERENCES users(user_id)
                  ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (amount >= 0)
);

-- ============================================================
-- CATEGORY
-- ============================================================

CREATE TABLE IF NOT EXISTS category (
    category_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id   UUID
                   REFERENCES budget_reference(reference_id)
                   ON DELETE SET NULL,
    issued_ref_id  UUID NOT NULL
                   REFERENCES budget_issued_reference(id)
                   ON DELETE CASCADE,
    user_id        UUID NOT NULL
                   REFERENCES users(user_id)
                   ON DELETE CASCADE,
    description    TEXT NOT NULL,
    flag           INTEGER NOT NULL DEFAULT 0
                   CHECK (flag IN (0, 1)),
    category_id    UUID
                   REFERENCES category(category_id)
                   ON DELETE SET NULL,
    total_amount   DECIMAL(12,2) NOT NULL,
    expense_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_id     UUID
                   REFERENCES receipt(id)
                   ON DELETE SET NULL,
    image_url      TEXT,
    receipt_date   TIMESTAMPTZ,
    notes          TEXT,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'cash'
                   CHECK (
                       payment_method IN (
                           'cash',
                           'bank_transfer',
                           'e_wallet',
                           'cheque'
                       )
                   ),
    status         VARCHAR(20) NOT NULL DEFAULT 'paid'
                   CHECK (status IN ('paid', 'draft', 'cancel')),
    review         VARCHAR(20) NOT NULL DEFAULT 'no'
                   CHECK (review IN ('yes', 'no')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (total_amount >= 0)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- USERS
CREATE INDEX IF NOT EXISTS idx_users_role_status
    ON users (role, status);

CREATE INDEX IF NOT EXISTS idx_users_last_activity
    ON users (last_activity DESC);

-- OTP
CREATE INDEX IF NOT EXISTS idx_otp_expires_at
    ON otp (expires_at);

-- BUDGET REFERENCES
CREATE INDEX IF NOT EXISTS idx_budget_reference_status_created
    ON budget_reference (status, created_at DESC);

-- BUDGET
CREATE INDEX IF NOT EXISTS idx_budget_reference_submitted
    ON budget (reference_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_status_submitted
    ON budget (status, submitted_at DESC);

-- BUDGET ISSUED REFERENCES
CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_user_created
    ON budget_issued_reference (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_reference
    ON budget_issued_reference (reference_id);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_status_created
    ON budget_issued_reference (status, created_at DESC);

-- RECEIPT
CREATE INDEX IF NOT EXISTS idx_receipt_receipt_id
    ON receipt (receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_created_at
    ON receipt (created_at DESC);

-- ISSUED BUDGET
CREATE INDEX IF NOT EXISTS idx_issued_budget_ref_created
    ON issued_budget (issued_ref_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_issued_budget_receipt
    ON issued_budget (receipt_id);

CREATE INDEX IF NOT EXISTS idx_issued_budget_status_created
    ON issued_budget (status, created_at DESC);

-- EMPLOYEE ABONO
CREATE INDEX IF NOT EXISTS idx_employee_abono_reference_created
    ON employee_abono (reference_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_abono_issued_ref_created
    ON employee_abono (issued_ref_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_abono_user_created
    ON employee_abono (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_abono_status_created
    ON employee_abono (status, created_at DESC);

-- BUDGET TRANSFER
CREATE INDEX IF NOT EXISTS idx_budget_transfer_reference_created
    ON budget_transfer (reference_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_transfer_issued_ref_created
    ON budget_transfer (issued_ref_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_transfer_user_created
    ON budget_transfer (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_transfer_recipient_created
    ON budget_transfer (transfer_to, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_transfer_status_created
    ON budget_transfer (status, created_at DESC);

-- CATEGORY
CREATE INDEX IF NOT EXISTS idx_category_name
    ON category (category_name);

-- EXPENSES
CREATE INDEX IF NOT EXISTS idx_expenses_reference_date
    ON expenses (reference_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_issued_ref_date
    ON expenses (issued_ref_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date
    ON expenses (user_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_category_date
    ON expenses (category_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_receipt
    ON expenses (receipt_id);

CREATE INDEX IF NOT EXISTS idx_expenses_status_date
    ON expenses (status, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_review_date
    ON expenses (review, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at
    ON expenses (created_at DESC);

-- ============================================================
-- END OF SCHEMA
-- ============================================================
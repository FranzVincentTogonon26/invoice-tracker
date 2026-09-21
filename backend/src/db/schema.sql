-- ============================================================
-- BUDGET & INVOICE TRACKING SYSTEM
-- PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password        TEXT NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
    avatar_url      TEXT,
    last_activity   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    label           TEXT,
    balance_amount  DECIMAL(12,2),
    notes           TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cut_off')),
    date_cut_off    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        balance_amount IS NULL
        OR balance_amount >= 0
    )
);


-- ============================================================
-- BUDGET
-- ============================================================

CREATE TABLE IF NOT EXISTS budget (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id    UUID NOT NULL REFERENCES budget_reference(reference_id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL,
    description     TEXT NOT NULL,
    method          VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'added' CHECK (status IN ('closed','cancelled','added')),
    approved_by     VARCHAR(255) NOT NULL,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (amount >= 0)
);


-- ============================================================
-- BUDGET ISSUED REFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_issued_reference (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id    UUID NOT NULL REFERENCES budget_reference(reference_id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notes           TEXT,
    covered_amount  DECIMAL(12,2),
    status          VARCHAR(20) NOT NULL DEFAULT 'open'CHECK (status IN ('open','close','cancel')),
    date_cut_off    TIMESTAMPTZ,
    date_forwarded  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        covered_amount IS NULL
        OR covered_amount >= 0
    )
);


-- ============================================================
-- ISSUED BUDGET
-- ============================================================

CREATE TABLE IF NOT EXISTS issued_budget (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issued_ref_id   UUID NOT NULL REFERENCES budget_issued_reference(id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL,
    description     TEXT NOT NULL,
    method          VARCHAR(255) NOT NULL,
    notes           TEXT,
    isMark          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (amount >= 0)
);


-- ============================================================
-- BUDGET ADJUSTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_adjustments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issued_ref_id   UUID NOT NULL REFERENCES budget_issued_reference(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL,
    notes           TEXT,
    method          VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (amount >= 0)
);


-- ============================================================
-- CATEGORY
-- ============================================================

CREATE TABLE IF NOT EXISTS category (
    category_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- RECEIPT
-- ============================================================

CREATE TABLE IF NOT EXISTS receipt (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id      VARCHAR(255) NOT NULL,
    vendor          TEXT,
    image_url       TEXT,
    description     TEXT NOT NULL,
    qty             INTEGER NOT NULL DEFAULT 1,
    rate            DECIMAL(12,2) NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    receipt_date    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issued_ref_id   UUID REFERENCES budget_issued_reference(id) ON DELETE CASCADE,
    reference_id    UUID REFERENCES budget_reference(reference_id) ON DELETE SET NULL,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    category_id     UUID REFERENCES category(category_id) ON DELETE SET NULL,
    total_amount    DECIMAL(12,2) NOT NULL,
    expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_id      UUID REFERENCES receipt(id) ON DELETE SET NULL,
    notes           TEXT,
    payment_method  VARCHAR(30) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank_transfer','e_wallet','cheque')),
    status          VARCHAR(20) NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','draft','cancel')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (total_amount >= 0)
);


-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_description TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- ============================================================


-- ------------------------------------------------------------
-- USERS INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_status
    ON users(status);

CREATE INDEX IF NOT EXISTS idx_users_role_status
    ON users(role, status);

CREATE INDEX IF NOT EXISTS idx_users_last_activity
    ON users(last_activity);


-- ------------------------------------------------------------
-- OTP INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_otp_expires_at
    ON otp(expires_at);


-- ------------------------------------------------------------
-- BUDGET REFERENCE INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_budget_reference_status
    ON budget_reference(status);

CREATE INDEX IF NOT EXISTS idx_budget_reference_date_cut_off
    ON budget_reference(date_cut_off);

CREATE INDEX IF NOT EXISTS idx_budget_reference_created_at
    ON budget_reference(created_at);


-- ------------------------------------------------------------
-- BUDGET INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_budget_reference_id
    ON budget(reference_id);

CREATE INDEX IF NOT EXISTS idx_budget_status
    ON budget(status);

CREATE INDEX IF NOT EXISTS idx_budget_submitted_at
    ON budget(submitted_at);

CREATE INDEX IF NOT EXISTS idx_budget_approved_at
    ON budget(approved_at);

CREATE INDEX IF NOT EXISTS idx_budget_cancelled_at
    ON budget(cancelled_at);

CREATE INDEX IF NOT EXISTS idx_budget_reference_status
    ON budget(reference_id, status);


-- ------------------------------------------------------------
-- BUDGET ISSUED REFERENCE INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_reference_id
    ON budget_issued_reference(reference_id);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_user_id
    ON budget_issued_reference(user_id);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_status
    ON budget_issued_reference(status);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_user_status
    ON budget_issued_reference(user_id, status);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_date_cut_off
    ON budget_issued_reference(date_cut_off);

CREATE INDEX IF NOT EXISTS idx_budget_issued_reference_date_forwarded
    ON budget_issued_reference(date_forwarded);


-- ------------------------------------------------------------
-- ISSUED BUDGET INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_issued_budget_issued_ref_id
    ON issued_budget(issued_ref_id);

CREATE INDEX IF NOT EXISTS idx_issued_budget_created_at
    ON issued_budget(created_at);

CREATE INDEX IF NOT EXISTS idx_issued_budget_issued_ref_created
    ON issued_budget(issued_ref_id, created_at);


-- ------------------------------------------------------------
-- BUDGET ADJUSTMENTS INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_budget_adjustments_issued_ref_id
    ON budget_adjustments(issued_ref_id);

CREATE INDEX IF NOT EXISTS idx_budget_adjustments_user_id
    ON budget_adjustments(user_id);

CREATE INDEX IF NOT EXISTS idx_budget_adjustments_created_at
    ON budget_adjustments(created_at);

CREATE INDEX IF NOT EXISTS idx_budget_adjustments_issued_ref_created
    ON budget_adjustments(issued_ref_id, created_at);


-- ------------------------------------------------------------
-- CATEGORY INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_category_name
    ON category(category_name);


-- ------------------------------------------------------------
-- RECEIPT INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_receipt_created_at
    ON receipt(created_at);


-- ------------------------------------------------------------
-- EXPENSE INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_expenses_issued_ref_id
    ON expenses(issued_ref_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id
    ON expenses(user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_category_id
    ON expenses(category_id);

CREATE INDEX IF NOT EXISTS idx_expenses_receipt_id
    ON expenses(receipt_id);

CREATE INDEX IF NOT EXISTS idx_expenses_status
    ON expenses(status);

CREATE INDEX IF NOT EXISTS idx_expenses_payment_method
    ON expenses(payment_method);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at
    ON expenses(created_at);

CREATE INDEX IF NOT EXISTS idx_expenses_expense_date
    ON expenses(expense_date);

CREATE INDEX IF NOT EXISTS idx_expenses_user_status
    ON expenses(user_id, status);

CREATE INDEX IF NOT EXISTS idx_expenses_issued_ref_status
    ON expenses(issued_ref_id, status);

CREATE INDEX IF NOT EXISTS idx_expenses_issued_ref_created
    ON expenses(issued_ref_id, created_at);


-- ------------------------------------------------------------
-- AUDIT LOG INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs(created_at);


-- ============================================================
-- END OF SCHEMA
-- ============================================================
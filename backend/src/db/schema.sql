CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS

CREATE TABLE IF NOT EXISTS users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password        TEXT NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'employee'
                    CHECK (role IN ('admin', 'employee')),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('active', 'inactive', 'pending')),
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTP

CREATE TABLE IF NOT EXISTS otp (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    otp             VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CATEGORY

CREATE TABLE IF NOT EXISTS category (
    category_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name   TEXT NOT NULL
);

-- RECEIPT

CREATE TABLE IF NOT EXISTS receipt (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description     TEXT NOT NULL,
    qty             INTEGER NOT NULL DEFAULT 1,
    rate            DECIMAL(12,2) NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BUDGET

CREATE TABLE IF NOT EXISTS budget (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount          DECIMAL(12,2) NOT NULL,
    description     TEXT NOT NULL,
    method          VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('draft', 'approved', 'cancelled', 'pending')),
    approved_by     VARCHAR(255) NOT NULL,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    date_cancel     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ISSUED BUDGET

CREATE TABLE IF NOT EXISTS issued_budget (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL,
    description     TEXT NOT NULL,
    method          VARCHAR(255) NOT NULL,
    cut_off         BOOLEAN NOT NULL DEFAULT FALSE,
    notes           TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('draft', 'cancelled', 'close', 'pending')),
    isMark          BOOLEAN NOT NULL DEFAULT FALSE,
    date_forwarded  TIMESTAMPTZ,
    date_cut_off    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EXPENSES
-- Moved above sub_issued_budget: sub_issued_budget has an FK to expenses,
-- so expenses must exist first.

CREATE TABLE IF NOT EXISTS expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    budget_id       UUID NOT NULL REFERENCES budget(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    category_id     UUID REFERENCES category(category_id) ON DELETE SET NULL,
    amount          DECIMAL(12,2) NOT NULL,
    receipt_id      UUID REFERENCES receipt(id) ON DELETE SET NULL,
    discounted      DECIMAL(12,2),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SUB ISSUED BUDGET
-- NOTE: budget_id below still references budget(id), matching the original.
-- Given the table name, you may actually want this to reference
-- issued_budget(id) instead -- worth confirming against your intended design.

CREATE TABLE IF NOT EXISTS sub_issued_budget (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id       UUID NOT NULL REFERENCES budget(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expenses_id     UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL,
    notes           TEXT,
    method          VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('draft', 'cancelled', 'close', 'pending')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES

-- Fixed: was "idx_budget_user ON budget(user_id)" but budget has no
-- user_id column. issued_budget is the table that has one.
CREATE INDEX IF NOT EXISTS idx_issued_budget_user
    ON issued_budget(user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user
    ON expenses(user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_budget
    ON expenses(budget_id);

CREATE INDEX IF NOT EXISTS idx_expenses_category
    ON expenses(category_id);

CREATE INDEX IF NOT EXISTS idx_expenses_receipt
    ON expenses(receipt_id);

-- Fixed: originally pointed at a nonexistent "sub_budget" table;
-- the real table is "sub_issued_budget".
CREATE INDEX IF NOT EXISTS idx_sub_issued_budget_user
    ON sub_issued_budget(user_id);

CREATE INDEX IF NOT EXISTS idx_sub_issued_budget_budget
    ON sub_issued_budget(budget_id);

CREATE INDEX IF NOT EXISTS idx_sub_issued_budget_expenses
    ON sub_issued_budget(expenses_id);
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
    user_id         UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    otp             VARCHAR(255) NOT NULL,
    status          INTEGER NOT NULL DEFAULT 0,
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
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL,
    covered_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
    method          TEXT NOT NULL,
    status          INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EXPENSES

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

-- SUB BUDGET

CREATE TABLE IF NOT EXISTS sub_budget (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    budget_id       UUID NOT NULL REFERENCES budget(id) ON DELETE CASCADE,
    expenses_id     UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL,
    covered_cost    DECIMAL(12,2) NOT NULL DEFAULT 0,
    method          TEXT NOT NULL,
    status          INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES

CREATE INDEX IF NOT EXISTS idx_budget_user
    ON budget(user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user
    ON expenses(user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_budget
    ON expenses(budget_id);

CREATE INDEX IF NOT EXISTS idx_expenses_category
    ON expenses(category_id);

CREATE INDEX IF NOT EXISTS idx_expenses_receipt
    ON expenses(receipt_id);

CREATE INDEX IF NOT EXISTS idx_sub_budget_user
    ON sub_budget(user_id);

CREATE INDEX IF NOT EXISTS idx_sub_budget_budget
    ON sub_budget(budget_id);

CREATE INDEX IF NOT EXISTS idx_sub_budget_expenses
    ON sub_budget(expenses_id);
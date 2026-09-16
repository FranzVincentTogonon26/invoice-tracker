# Admin Employees — UI Structure

> Build/reference spec for the **Employees** page (`/admin/employees`).
> Route: `frontend/src/pages/admin/AdminEmployees.jsx`
> Component folder: `frontend/src/components/layout/admin/employees/`

---

## 1. Page Purpose

Admin screen for managing employee accounts. It lets an admin:

- **See the roster** — every `users` row with `role = 'employee'` (all statuses),
  including the budget issued to each employee.
- **Add employees** — provision a new account (name + email + password); the
  account is created `active` so the employee can sign in immediately.
- **Approve / activate / deactivate** — self-registered employees arrive as
  `pending`; approving (→ `active`) or deactivating (→ `inactive`) is one click.
- **Remove** — hard delete with a destructive-confirmation dialog (cascades the
  employee's issued budget references via `users.user_id ON DELETE CASCADE`).

---

## 2. Visual Theme (shared design system)

Everything re-uses the app's design tokens and `components/ui/*` primitives —
**do not introduce new colors/paddings**:

| Token / class | Usage |
|---|---|
| `var(--bg)` / `var(--surface)` / `var(--surface-2)` | Page / card / inset backgrounds |
| `var(--border)` | 1px borders on cards, dividers, table header |
| `var(--ink)` / `var(--ink-muted)` | Primary / secondary text |
| `var(--accent)` / `var(--accent-strong)` / `var(--accent-soft)` | Ring accents, links, highlights |
| `var(--success)` / `var(--warning)` / `var(--danger)` | Status + destructive signaling |
| `shadow-card` / `shadow-hover` | Card elevation / hover lift |
| `font-display`, `tabular-nums` | H1/StatCard digits & money columns |
| `rounded-2xl` / `rounded-3xl` / `rounded-full` | Cards / dialogs / pills & buttons |
| Motion curve `[0.16, 1, 0.3, 1]` | All entrance/exit transitions |

**UI primitives used:** `PageHeader`, `StatCard`, `Card` / `CardHeader` /
`CardTitle` / `CardDescription`, `Badge`, `Button`, `SearchInput`,
`LoadingSkeleton`, `ErrorState`, `EmptyState`, `Pager`.

---

## 3. Page Structure (top → bottom)

```
<AdminEmployees>  (space-y-6)
│
├─ <PageHeader>
│    title="Employees"
│    description="Manage employee accounts and monitor their budget activity."
│    actions → <Button variant="accent">＋ Add Employee</Button>
│              (opens <EmployeesModal>)
│
├─ Stats row          (grid-cols-1 sm:2 lg:4, gap-5)
│    ├─ StatCard ─ Total Budget Issued      (accent, Wallet icon, ₱ money)
│    ├─ StatCard ─ Total Employees          (Users icon)
│    ├─ StatCard ─ Active Employees         (BadgeCheck icon)
│    └─ StatCard ─ Pending Approval         (Clock3 icon)
│
└─ <Card padding="md">  ← "All Employees" panel
     ├─ <CardHeader> title + count <Badge>  ("N employees")
     ├─ Filter toolbar (mb-5, flex-col lg:row)
     │    ├─ Status pills (rounded-full, bg-[var(--ink)] when active)
     │    │    All · Active · Pending · Inactive
     │    └─ <SearchInput> (lg:ml-auto lg:w-[320px]) name/email, ✕ to clear
     ├─ Content:
     │    ├─ isLoading  → <LoadingSkeleton rows={6} showAvatar />
     │    ├─ error      → <ErrorState onRetry={refetch} onClearFilters? />
     │    ├─ empty      → <EmptyState icon={Users} onClear? />
     │    └─ <EmployeesTable>  rows={pageRows} pending={actionPending}
     │                          onAction={handleAction}
     └─ Footer (border-t pt-4):
          "Showing X–Y of N employees"  ··  <Pager>  (when pageCount > 1)

<EmployeesModal>  open={addOpen}  create={create}  onClose={...}
```

---

## 4. EmployeesTable (inside `employees/EmployeesTable.jsx`)

Same conventions as the Budget transaction tables.

**Desktop** — semantic `<table class="table-fixed">`, min-width 1080px, inside an
`overflow-x-auto rounded-2xl` wrapper with the accent hairline on top.

| Column | Width | Cell content |
|---|---|---|
| Employee | 20% | initial avatar + name (+ email muted below) |
| Status | 11% | `EmployeeStatusBadge` (success / warning / neutral dot) |
| Issued Budget | 10% | right-aligned `formatMoney(issued_budget)` |
| Total Spent | 10% | right-aligned `formatMoney(spent)`; "Over budget" in `--danger` when spent > issued |
| Remaining | 15% | `formatMoney(issued − spent)` + animated progress bar + "N% left" caption |
| Transactions | 8% | `issued_references` count |
| Date Added | 9% | `formatDate(created_at)` |
| Actions | 17% | `<EmployeeActions>` (right aligned) |

**Remaining-balance bar.** One shared `RemainingProgress` component drives both
the desktop row and the mobile card:

- `spent` = `employee.total_spent` (or `employee.spent`) when the API sends it,
  otherwise the **`DEFAULT_TOTAL_SPENT = 1000`** placeholder; an employee with
  nothing issued is treated as `0` spent so no row is falsely "over budget".
- `remaining` = `issued − spent` (negative → `--danger` + "Over budget").
- bar width = `remaining / issued × 100`, clamped 0–100 — the same formula, 0–100
  ARIA semantics, `Number(x.toFixed(1))` rounding, accent-hero gradient and
  `[0.16, 1, 0.3, 1]` / 0.7s / 0.2s-delay motion as the Budget page utilization
  bar, so both screens read as one system.

**Mobile** — stacked `EmployeeCard`s (rounded-2xl, border, shadow-card):
avatar/name/status on top, an Issued · Spent · Remaining metric strip, the same
animated bar + "% left" caption, then date added, reference count and actions in
the footer strip.

**Status colors:** `active → success`, `pending → warning`, `inactive →
neutral` (pending is *warning*, not danger — it's a queued, actionable state).

---

## 5. Row Actions (`employees/EmployeeActions.jsx`)

| Account status | Trigger rendered | Action |
|---|---|---|
| `pending` | `Approve` (soft) | `PATCH /employees/:id/status` `{ status: "active" }` |
| `active` | `Deactivate` (outline) | `PATCH … { status: "inactive" }` |
| `inactive` | `Activate` (outline) | `PATCH … { status: "active" }` |
| any | 🗑 trash icon | `DELETE /employees/:id` via alertdialog confirm |

The delete action opens the same **`alertdialog`** shell used by the Budget
actions (dimmed + blurred backdrop, danger icon badge, "Keep" / "Yes, remove"
buttons). Backdrop clicks are ignored while the request is in flight.
---

## 6. Add Employee Modal (`employees/EmployeesModal.jsx`)

- Width `max-w-[500px]`, rounded-3xl surface panel, framer-motion entrance
  (`y:12 → 0, scale .98 → 1`, `[0.16,1,0.3,1]`).
- Fields: **Full name** (`UserRound` icon) · **Email** (`Mail` icon) · **Password**
  (`Lock` icon, min 8 chars).
- Client-side pre-flight validation mirrors `employee.validation.js`:
  name ≥ 2 chars, valid email regex, password ≥ 8 chars.
- On submit → `create.mutateAsync({ name, email, password })`; success →
  `toast.success`, form reset, modal closes. Failures render inline in the
  red `role="alert"` strip (e.g. duplicate email from the 409 conflict).

---

## 7. Data Contract (backend → frontend)

All endpoints under `/api`, admin-only (`authMiddleware` +
`requireAdminAccess`). JSON responses:

| Method / Path | Request | Response |
|---|---|---|
| `GET /employees?status=&search=` | query params (optional) | `{ employees: EmployeeRow[] }` |
| `GET /employees/overview` | — | `{ overview: { totalEmployees, activeEmployees, pendingApproval, inactiveEmployees, totalEmployeeIssued } }` |
| `POST /employees` | `{ name, email, password }` | `201 { employee, message }` |
| `PATCH /employees/:id/status` | `{ status: "active" \| "inactive" }` | `{ employee, message }` |
| `DELETE /employees/:id` | — | `{ employee, message }` |

`EmployeeRow` (safe columns only, never the password hash):

```json
{
  "user_id": "…uuid…",
  "name": "Juan Dela Cruz",
  "email": "juan@company.com",
  "avatar_url": null,
  "role": "employee",
  "status": "active",
  "created_at": "…timestamptz…",
  "issued_budget": 12500.0,
  "issued_references": 2
}
```

Notes:
- `status` filter defaults to **active-only** when omitted — this preserves the
  Budget page's employee picker. Pass `status=all` (or a concrete status) for
  the full roster.
- `issued_budget` = `SUM(issued_budget.amount)` joined through open
  `budget_issued_reference` rows for that user.
- `totalEmployeeIssued` = `SUM(issued_budget.amount)` joined through open
  `budget_issued_reference` rows — the total funding handed out to employees
  (NOT `allocated - issued`, which is the remaining/un-issued budget).
- **`total_spent` is not part of the response yet.** The table therefore falls
  back to `DEFAULT_TOTAL_SPENT = 1000` (see section 4) and picks up a real
  `total_spent` / `spent` field automatically once `GET /employees` returns one
  (e.g. `SUM(expenses.total_amount)` joined through the employee's
  `budget_issued_reference` rows).

---

## 8. State & Data Flow

- `useEmployeesOverview()` — `["employees", "overview"]` query → stat cards.
- `useEmployees({ status, search })` — keyed by params, debounced (300 ms)
  search; data unwraps to `employees[]`.
- `useEmployeesMutations()` — `create` / `updateStatus` / `remove`; every
  mutation invalidates **all** `["employees"]` queries so list + overview
  refresh together.
- `actionPending` disables row actions while any mutation is in flight.

### File map

```
backend/src/models/employee.model.js       — SQL (list, overview, CRUD)
backend/src/controllers/employees.controller.js
backend/src/routes/employees.route.js
backend/src/validations/employee.validation.js

frontend/src/pages/admin/AdminEmployees.jsx              — page assembly
frontend/src/components/layout/admin/employees/
  ├─ EmployeesModal.jsx    — Add Employee dialog
  ├─ EmployeesTable.jsx    — desktop table + mobile cards
  └─ EmployeeActions.jsx   — approve/activate/deactivate + delete dialog
frontend/src/hooks/useEmployees.js
frontend/src/api/employees.js
frontend/src/constants/index.js                 — STATUS.active / .inactive
```
import { getToken } from "../api/auth";
import { store, round2, effectiveStatus } from "./dummyData";

const iso = (d) => d.toISOString();
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

const clientById = (id) => store.clients.find((c) => c.id === id) || null;

const user = {
  id: "user_demo",
  name: "Franz",
  email: "franzvincenttogonon@gmail.com",
  created_at: iso(daysAgo(120)),
};

const getSession = () => {
  const token = getToken();
  if (!token) return null;
  return { user: clone(user), token };
};

function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${dt.getMonth()}`;
}

function lastMonths(n) {
  const now = new Date();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ d, label: d.toLocaleString("en-US", { month: "short" }), ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, key: `${d.getFullYear()}-${d.getMonth()}` });
  }
  return arr;
}

function serInvoiceList(inv) {
  const c = clientById(inv.client_id);
  const { items, ...rest } = inv; // eslint-disable-line no-unused-vars
  return { ...rest, client_name: c?.name || null, client_company: c?.company || "", effective_status: effectiveStatus(inv) };
}

export const mock = {
  // Auth
  auth: {
    async me() {
      await delay();
      const session = getSession();

      if (!session) {
        return Promise.reject({ status: 401, message: "Not Authenticated" });
      }

      return session;
    },
    async login() {
      await delay();
      return { user: clone(user), token: crypto.randomUUID() };
    },
    async register() {
      await delay();
      return { user: clone(user), token: crypto.randomUUID() };
    },
    async logout() {},
    async updateProfile() {},
    async changePassword() {
      await delay();
      return { ok: true };
    },
  },

  /* ── Dashboard ── */
  dashboard: {
    async get() {
      await delay();
      const inv = store.invoices;
      const thisMonth = monthKey(new Date());
      const totalRevenue = round2(
        inv.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0),
      );
      const outstanding = round2(
        inv.filter((i) => i.status !== "paid").reduce((s, i) => s + i.total, 0),
      );
      const paidThisMonth = round2(
        inv
          .filter(
            (i) =>
              i.status === "paid" &&
              monthKey(i.paid_at || i.issue_date) === thisMonth,
          )
          .reduce((s, i) => s + i.total, 0),
      );
      const overdue = inv.filter((i) => effectiveStatus(i) === "overdue");
      const series = lastMonths(6).map((m) => ({
        label: m.label,
        ym: m.ym,
        revenue: round2(
          inv
            .filter(
              (i) =>
                i.status === "paid" &&
                monthKey(i.paid_at || i.issue_date) === m.key,
            )
            .reduce((s, i) => s + i.total, 0),
        ),
        count: inv.filter(
          (i) =>
            i.status === "paid" &&
            monthKey(i.paid_at || i.issue_date) === m.key,
        ).length,
      }));
      const recent = store.invoices
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(serInvoiceList);
      return {
        stats: {
          totalRevenue,
          outstanding,
          paidThisMonth,
          overdueCount: overdue.length,
          overdueTotal: round2(overdue.reduce((s, i) => s + i.total, 0)),
          invoiceCount: inv.length,
          clientCount: store.clients.length,
        },
        revenueSeries: series,
        recentInvoices: recent,
      };
    },
  },
};

import { getToken } from "../api/auth";
import { store, round2, effectiveStatus, nid, computeTotals } from "./dummyData";

const iso = (d) => d.toISOString();
const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const delay = (ms = 280) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));

const clientById = (id) => store.clients.find((c) => c.id === id) || null;
const nowIso = () => new Date().toISOString();

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
    arr.push({
      d,
      label: d.toLocaleString("en-US", { month: "short" }),
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      key: `${d.getFullYear()}-${d.getMonth()}`,
    });
  }
  return arr;
}

function serInvoiceList(inv) {
  const c = clientById(inv.client_id);
  const { items, ...rest } = inv; // eslint-disable-line no-unused-vars
  return {
    ...rest,
    client_name: c?.name || null,
    client_company: c?.company || "",
    effective_status: effectiveStatus(inv),
  };
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

  /* ── Invoices ── */
  invoices: {
    async list(params = {}) {
      await delay();
      const { q, status, client_id } = params || {};

      let rows = store.invoices.slice();

      if (client_id) {
        rows = rows.filter((i) => i.client_id === client_id);
      }
      if (status) {
        rows = rows.filter((i) => effectiveStatus(i) === status);
      }
      if (q && String(q).trim()) {
        const needle = String(q).trim().toLowerCase();
        rows = rows.filter((i) => {
          const c = clientById(i.client_id);
          return [i.invoice_number, c?.name, c?.company]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(needle));
        });
      }

      rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return rows.map(serInvoiceList);
    },

    async get(id) {
      await delay();
      const inv = store.invoices.find((i) => i.id === id);
      if (!inv) throw { status: 404, message: "Invoice not found" };
      const c = clientById(inv.client_id);
      return {
        ...clone(inv),
        client_name: c?.name || null,
        client_company: c?.company || "",
        effective_status: effectiveStatus(inv),
      };
    },

    async create(payload) {
      await delay();
      const taxRate = payload.tax_rate ?? 0;
      const discount = payload.discount ?? 0;
      const totals = computeTotals(payload.items || [], taxRate, discount);
      const inv = {
        id: nid("inv"),
        client_id: payload.client_id || null,
        invoice_number: `INV-${String(store.settings.next_seq).padStart(4, "0")}`,
        status: ["draft", "sent", "paid"].includes(payload.status)
          ? payload.status
          : "draft",
        issue_date: payload.issue_date || ymd(new Date()),
        due_date: payload.due_date || null,
        currency: payload.currency || "USD",
        tax_rate: taxRate,
        discount: totals.discount,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total: totals.total,
        notes: payload.notes || "",
        terms: payload.terms || "",
        paid_at: null,
        created_at: nowIso(),
        items: totals.items.map((it) => ({ id: nid("li"), ...it })),
      };
      store.settings.next_seq += 1;
      store.invoices.unshift(inv);
      const c = clientById(inv.client_id);
      return {
        ...clone(inv),
        client_name: c?.name || null,
        client_company: c?.company || "",
        effective_status: effectiveStatus(inv),
      };
    },

    async update(id, payload) {
      await delay();
      const inv = store.invoices.find((i) => i.id === id);
      if (!inv) throw { status: 404, message: "Invoice not found" };

      const { items, tax_rate, discount, ...rest } = payload || {};
      Object.assign(inv, rest);

      if (items !== undefined || tax_rate !== undefined || discount !== undefined) {
        const nextItems = items !== undefined ? items : inv.items;
        const nextTaxRate = tax_rate !== undefined ? tax_rate : inv.tax_rate;
        const nextDiscount = discount !== undefined ? discount : inv.discount;
        const totals = computeTotals(nextItems, nextTaxRate, nextDiscount);
        inv.items = totals.items.map((it) => ({ id: nid("li"), ...it }));
        inv.tax_rate = nextTaxRate;
        inv.discount = totals.discount;
        inv.subtotal = totals.subtotal;
        inv.tax_amount = totals.taxAmount;
        inv.total = totals.total;
      }

      const c = clientById(inv.client_id);
      return {
        ...clone(inv),
        client_name: c?.name || null,
        client_company: c?.company || "",
        effective_status: effectiveStatus(inv),
      };
    },

    async setStatus(id, status) {
      await delay();
      const inv = store.invoices.find((i) => i.id === id);
      if (!inv) throw { status: 404, message: "Invoice not found" };
      if (!["draft", "sent", "paid"].includes(status)) {
        throw { status: 422, message: `Invalid status: ${status}` };
      }
      inv.status = status;
      if (status === "paid" && !inv.paid_at) inv.paid_at = nowIso();
      if (status !== "paid") inv.paid_at = null;
      const c = clientById(inv.client_id);
      return {
        ...clone(inv),
        client_name: c?.name || null,
        client_company: c?.company || "",
        effective_status: effectiveStatus(inv),
      };
    },

    async remove(id) {
      await delay();
      const before = store.invoices.length;
      store.invoices = store.invoices.filter((i) => i.id !== id);
      if (store.invoices.length === before) {
        throw { status: 404, message: "Invoice not found" };
      }
      return { ok: true };
    },
  },

  /* ── Clients ── */
  clients: {
    async list() {
      await delay();
      return store.clients.map((c) => {
        const invs = store.invoices.filter((i) => i.client_id === c.id);
        return {
          ...clone(c),
          invoice_count: invs.length,
          total_billed: round2(invs.reduce((s, i) => s + i.total, 0)),
          outstanding: round2(
            invs
              .filter((i) => i.status !== "paid")
              .reduce((s, i) => s + i.total, 0),
          ),
        };
      });
    },
    async get(id) {
      await delay();
      const client = clientById(id);
      if (!client) throw { status: 404, message: "Client not found" };
      const invoices = store.invoices
        .filter((i) => i.client_id === id)
        .map((i) => ({
          id: i.id,
          invoice_number: i.invoice_number,
          status: i.status,
          issue_date: i.issue_date,
          due_date: i.due_date,
          total: i.total,
          currency: i.currency,
          created_at: i.created_at,
        }));
      const totalBilled = round2(invoices.reduce((s, i) => s + i.total, 0));
      const outstanding = round2(
        invoices
          .filter((i) => i.status !== "paid")
          .reduce((s, i) => s + i.total, 0),
      );
      return {
        client: clone(client),
        invoices,
        stats: { totalBilled, outstanding, count: invoices.length },
      };
    },
    async create(payload) {
      await delay();
      const client = {
        id: nid("cl"),
        name: payload.name,
        email: payload.email || "",
        company: payload.company || "",
        phone: payload.phone || "",
        address: payload.address || "",
        notes: payload.notes || "",
        created_at: nowIso(),
      };
      store.clients.unshift(client);
      return clone(client);
    },
    async update(id, payload) {
      await delay();
      const client = clientById(id);
      if (!client) throw { status: 404, message: "Client not found" };
      Object.assign(client, payload);
      return clone(client);
    },
    async remove(id) {
      await delay();
      store.clients = store.clients.filter((c) => c.id !== id);
      store.invoices.forEach((i) => {
        if (i.client_id === id) i.client_id = null;
      });
      return { ok: true };
    },
  },
};

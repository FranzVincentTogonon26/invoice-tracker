import {
  ClipboardList,
  HandCoins,
  ReceiptText,
  Wallet,
} from "lucide-react";

// Tab order drives the panel slide direction. Icons mirror the transaction-kind
// vocabulary used across the app (issued → HandCoins, expense →
// ReceiptText, abono → Wallet).
//
// Lives in lib (no components here) so files that render tabs keep working
// with React fast refresh.
export const TAB_META = [
  { value: "employee_transaction", label: "Overview", Icon: ClipboardList },
  { value: "employee_budget", label: "Budget", Icon: HandCoins },
  { value: "employee_expenses", label: "Expenses", Icon: ReceiptText },
  { value: "employee_abono", label: "Abono", Icon: Wallet },
];

// The curve the rest of the app animates with (shells, tab panels, dialogs).
export const PANEL_EASE = [0.16, 1, 0.3, 1];

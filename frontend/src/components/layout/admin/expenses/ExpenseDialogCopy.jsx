import { CircleCheck, RotateCcw, Trash2, XCircle } from "lucide-react";

// Copy for the shared row-action confirmation dialog — one entry per action
// that opens it from the ledger (Delete / Add to draft / Remove from draft /
// Cancel). The dialog shell is shared; only these strings and the icon change.
export const CONFIRM_COPY = {
  delete: {
    icon: <Trash2 size={20} aria-hidden />,
    title: "Delete this expense?",
    description:
      "This permanently removes the expense record — and the receipt image stored with it, unless another expense still uses it. This can't be undone.",
    cancelLabel: "Keep expense",
    confirmLabel: "Yes, delete it",
    pendingLabel: "Deleting…",
  },
  draft: {
    icon: <RotateCcw size={20} aria-hidden />,
    title: "Add this expense to draft?",
    description:
      "The record stays in the employee's ledger, but its status moves back to Draft — only paid expenses count against the employee's balance, so this amount returns to their available balance until it is paid again.",
    cancelLabel: "Keep as paid",
    confirmLabel: "Yes, add to draft",
    pendingLabel: "Moving…",
  },
  restore: {
    icon: <CircleCheck size={20} aria-hidden />,
    title: "Remove this expense from draft?",
    description:
      "The record leaves Draft and counts against the employee's balance again — exactly as it did before it was parked there.",
    cancelLabel: "Keep as draft",
    confirmLabel: "Yes, mark as paid",
    pendingLabel: "Restoring…",
  },
  cancel: {
    icon: <XCircle size={20} aria-hidden />,
    title: "Cancel this expense?",
    description:
      "The record stays in the ledger, but its status moves to Cancelled — it is void and never counts against anyone's balance. Only paid or draft expenses can be spent again afterwards.",
    cancelLabel: "Keep as draft",
    confirmLabel: "Yes, cancel it",
    pendingLabel: "Cancelling…",
  },
};

// Fallback toasts for the same actions when the API answers without a message
// (network failure, timeout, …) — the server's own message always wins.
export const ACTION_ERROR = {
  delete: "Couldn’t delete expense",
  draft: "Couldn’t add expense to draft",
  restore: "Couldn’t mark expense as paid",
  cancel: "Couldn’t cancel expense",
};

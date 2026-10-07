import { Ban, CircleCheck, RotateCcw, Trash2, XCircle } from "lucide-react";

// Copy for the shared row-action confirmation dialog — one entry per action
// that opens it from the ledger. The dialog shell is shared; only these
// strings and the icon change.
export const CONFIRM_COPY = {
  "cancel-budget": {
    icon: <Ban size={20} aria-hidden />,
    title: "Cancel this budget transaction?",
    description:
      "Status moves to Cancelled — the amount stops counting as Money In. You can restore it afterwards.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, cancel it",
    pendingLabel: "Cancelling…",
  },
  "cancel-issued": {
    icon: <Ban size={20} aria-hidden />,
    title: "Cancel this budget issuance?",
    description:
      "Status moves to Cancelled — the amount stops counting as Money Out. You can restore it afterwards.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, cancel it",
    pendingLabel: "Cancelling…",
  },
  "delete-expense": {
    icon: <Trash2 size={20} aria-hidden />,
    title: "Delete this expense?",
    description:
      "Permanently removes the expense record and its receipt. This can't be undone.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, delete it",
    pendingLabel: "Deleting…",
  },
  "delete-budget": {
    icon: <Trash2 size={20} aria-hidden />,
    title: "Delete this budget record?",
    description:
      "Permanently removes the cancelled budget transaction. Only cancelled rows can be deleted — this can't be undone.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, delete it",
    pendingLabel: "Deleting…",
  },
  "delete-issued": {
    icon: <Trash2 size={20} aria-hidden />,
    title: "Delete this issued record?",
    description:
      "Permanently removes the cancelled issuance and its scanned receipt file. Refused when linked expenses exist — this can't be undone.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, delete it",
    pendingLabel: "Deleting…",
  },
  "expense-draft": {
    icon: <RotateCcw size={20} aria-hidden />,
    title: "Move this expense to draft?",
    description:
      "Status moves back to Draft — only paid expenses count as Money Out.",
    cancelLabel: "Keep as paid",
    confirmLabel: "Yes, move to draft",
    pendingLabel: "Moving…",
  },
  "expense-restore": {
    icon: <CircleCheck size={20} aria-hidden />,
    iconClassName: "bg-[var(--success)]/12 text-[var(--success)]",
    title: "Mark this expense as paid?",
    description: "The record leaves Draft and counts as Money Out again.",
    cancelLabel: "Keep as draft",
    confirmLabel: "Yes, mark as paid",
    confirmVariant: "accent",
    pendingLabel: "Restoring…",
  },
  "expense-cancel": {
    icon: <XCircle size={20} aria-hidden />,
    title: "Cancel this expense?",
    description:
      "Status moves to Cancelled — it is void and never counts as Money Out.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, cancel it",
    pendingLabel: "Cancelling…",
  },
  "delete-abono": {
    icon: <Trash2 size={20} aria-hidden />,
    title: "Delete this abono?",
    description:
      "Permanently removes the abono record. Refused when the amount has already been spent.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, delete it",
    pendingLabel: "Deleting…",
  },
  "cancel-transfer": {
    icon: <Ban size={20} aria-hidden />,
    title: "Cancel this transfer?",
    description:
      "Removes both legs of the transfer. Refused when the recipient has already spent the amount.",
    cancelLabel: "Keep",
    confirmLabel: "Yes, cancel it",
    pendingLabel: "Cancelling…",
  },
};

export const ACTION_ERROR = {
  "cancel-budget": "Couldn't cancel budget transaction",
  "restore-budget": "Couldn't restore budget transaction",
  "cancel-issued": "Couldn't cancel budget issuance",
  "restore-issued": "Couldn't restore budget issuance",
  "delete-expense": "Couldn't delete expense",
  "delete-budget": "Couldn't delete budget record",
  "delete-issued": "Couldn't delete issued record",
  "expense-draft": "Couldn't move expense to draft",
  "expense-restore": "Couldn't mark expense as paid",
  "expense-cancel": "Couldn't cancel expense",
  "delete-abono": "Couldn't delete abono",
  "cancel-transfer": "Couldn't cancel transfer",
};

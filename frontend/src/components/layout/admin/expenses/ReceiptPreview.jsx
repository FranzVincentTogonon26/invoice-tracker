import { Trash2 } from "lucide-react";

// Attached-receipt preview card shown once an image is on the receipt state.
// The remove button asks for confirmation when the scan already filled data.
const ReceiptPreview = ({
  receipt,
  scanning,
  hasReceiptData,
  onRemoveRequest,
  onRemove,
}) => (
  <div className="flex w-full items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2.5 sm:gap-3 sm:px-3 sm:py-3 lg:rounded-3xl lg:gap-3 lg:px-4 lg:py-3">
    <img
      src={receipt.imageUrl}
      alt="Receipt preview"
      className="h-14 w-11 shrink-0 rounded-xl border border-[var(--border)] bg-white object-cover shadow-card sm:h-16 sm:w-14 lg:h-20 lg:w-16 lg:rounded-2xl"
    />
    <div className="min-w-0 flex-1">
      <p className="truncate text-base font-semibold tracking-tight text-[var(--ink)]">
        {receipt.fileName || "Receipt attached"}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">
        {scanning ? (
          "Reading the receipt…"
        ) : (
          <>
            <span className="sm:hidden">Tap to replace</span>
            <span className="hidden sm:inline">Click or drop to replace</span>
          </>
        )}
      </p>
      {scanning && (
        <div className="mt-2 h-1.5 w-full max-w-full overflow-hidden rounded-full bg-[var(--surface-2)] sm:max-w-[220px]">
          <div className="h-full w-1/3 animate-[scanbar_1.2s_ease-in-out_infinite] rounded-full bg-[var(--accent)]" />
        </div>
      )}
    </div>
    {!scanning && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasReceiptData) {
            onRemoveRequest();
          } else {
            onRemove();
          }
        }}
        aria-label="Remove attached receipt"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] active:bg-[var(--danger)]/10 active:text-[var(--danger)] sm:h-10 sm:w-10"
      >
        <Trash2 size={16} />
      </button>
    )}
  </div>
);

export default ReceiptPreview;

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
  <div className="flex w-full items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-3.5 py-3.5 sm:gap-4 sm:px-4 sm:py-4 lg:rounded-3xl lg:gap-5 lg:px-5 lg:py-5">
    <img
      src={receipt.imageUrl}
      alt="Receipt preview"
      className="h-16 w-12 shrink-0 rounded-xl border border-[var(--border)] bg-white object-cover shadow-card sm:h-20 sm:w-16 lg:h-24 lg:w-[76px] lg:rounded-2xl"
    />
    <div className="min-w-0 flex-1">
      <p className="truncate text-base font-semibold tracking-tight text-[var(--ink)] sm:text-[15px] lg:text-base">
        {receipt.fileName || "Receipt attached"}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--ink-muted)]">
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
        <div className="mt-3 h-1.5 w-full max-w-full overflow-hidden rounded-full bg-[var(--surface-2)] sm:max-w-[220px]">
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

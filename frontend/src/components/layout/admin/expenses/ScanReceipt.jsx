import { ScanLine, Upload } from "lucide-react";
import { useRef } from "react";
import { MAX_RECEIPT_LABEL } from "../../../../constants";

const ReceiptScanButton = ({ scanning = false, onFile }) => {
  const inputRef = useRef(null);

  return (
    <>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)] disabled:opacity-50 sm:h-10 sm:w-10"
        onClick={() => {
          if (!scanning) inputRef.current?.click();
        }}
        aria-disabled={scanning}
      >
        {scanning ? (
          <ScanLine size={20} className="animate-pulse" />
        ) : (
          <Upload size={20} />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile?.(file);
          }}
          disabled={scanning}
        />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-snug text-[var(--ink)]">
          {/* Mobile has no drag-and-drop — lead with tap-first wording. */}
          <span className="sm:hidden">Tap to upload receipt</span>
          <span className="hidden sm:inline">Drop the receipt here</span>
        </p>
        <p className="mt-0.5 text-xs leading-snug text-[var(--ink-muted)]">
          {scanning ? (
            "Reading the receipt…"
          ) : (
            <>
              <span className="sm:hidden">Tap to pick a photo or PDF</span>
              <span className="hidden sm:inline">
                PNG, JPG, WEBP or PDF · up to {MAX_RECEIPT_LABEL}
              </span>
            </>
          )}
        </p>
      </div>
    </>
  );
};

export default ReceiptScanButton;

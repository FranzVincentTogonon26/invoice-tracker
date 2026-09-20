import { ScanLine, Upload } from "lucide-react";
import { useRef } from "react";

const ReceiptScanButton = ({ scanning = false, onFile }) => {
  const inputRef = useRef(null);

  return (
    <>
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)] disabled:opacity-50 sm:h-12 sm:w-12"
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
        <p className="text-[15px] font-semibold leading-snug text-[var(--ink)] sm:text-sm">
          {/* Mobile has no drag-and-drop — lead with tap-first wording. */}
          <span className="sm:hidden">Tap to upload receipt</span>
          <span className="hidden sm:inline">Drop the receipt here</span>
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-muted)]">
          {scanning ? (
            "Reading the receipt…"
          ) : (
            <>
              <span className="sm:hidden">Tap to pick a photo or PDF</span>
              <span className="hidden sm:inline">
                PNG, JPG, WEBP or PDF · up to 2MB
              </span>
            </>
          )}
        </p>
      </div>
    </>
  );
};

export default ReceiptScanButton;

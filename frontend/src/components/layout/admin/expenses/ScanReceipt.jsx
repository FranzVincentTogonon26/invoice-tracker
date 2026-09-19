import { ScanLine, Upload } from "lucide-react";
import { useRef } from "react";

const ReceiptScanButton = ({ scanning = false, onFile }) => {
  const inputRef = useRef(null);

  return (
    <>
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)] disabled:opacity-50"
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
        <p className="text-sm font-semibold text-[var(--ink)]">
          Drop the receipt here
        </p>
        <p className="text-[12px] text-[var(--ink-muted)]">
          {scanning ? "Reading the receipt…" : "PNG, JPG or WEBP · up to 2MB"}
        </p>
      </div>
    </>
  );
};

export default ReceiptScanButton;

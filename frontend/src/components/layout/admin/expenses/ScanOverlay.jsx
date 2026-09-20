import { ScanLine } from "lucide-react";

// Scan-in-progress overlay: covers the whole panel, swallows every
// interaction so nothing can be touched mid-scan.
const ScanOverlay = () => (
  <div
    aria-live="polite"
    aria-busy="true"
    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-t-3xl bg-[var(--surface)]/80 px-6 text-center backdrop-blur-[3px] sm:rounded-3xl sm:px-0"
  >
    <div className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
      <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent-soft)]" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] sm:h-16 sm:w-16">
        <ScanLine size={28} className="animate-pulse" />
      </span>
    </div>
    <div className="text-center">
      <p className="text-[15px] font-semibold text-[var(--ink)] sm:text-sm">
        Scanning receipt, please wait
      </p>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)] sm:text-[12px]">
        Reading vendor, items and totals — this takes a few seconds.
      </p>
    </div>
  </div>
);

export default ScanOverlay;

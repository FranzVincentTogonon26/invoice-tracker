import { ScanLine } from "lucide-react";
import { Card } from "../../../ui/Card";
import ReceiptPreview from "./ReceiptPreview";
import ReceiptDropzone from "./ReceiptDropzone";
import ReceiptDetails from "./ReceiptDetails";
import ReceiptItems from "./ReceiptItems";

// Placeholder shown before any scan/upload has produced content.
// Mobile copy is tap-first (no drag-and-drop exists there); desktop keeps
// the original "drop" wording.
const EmptyScanPlaceholder = () => (
  <div className="flex items-start gap-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-5 sm:px-5 lg:gap-5 lg:px-6 lg:py-7">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--ink-muted)] shadow-card lg:h-14 lg:w-14">
      <ScanLine size={22} />
    </span>
    <div className="min-w-0 lg:pt-0.5">
      <p className="text-[15px] font-semibold tracking-tight text-[var(--ink)] sm:text-sm lg:text-[15px]">
        No scan yet
      </p>
      <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-[var(--ink-muted)] sm:mt-1 sm:text-[12px] lg:mt-2 lg:text-[13px]">
        <span className="sm:hidden">
          Tap the upload area above to pick a receipt — the extracted lines will
          appear here for review.
        </span>
        <span className="hidden sm:inline">
          No scan action or upload yet — drop a receipt above and the extracted
          lines will appear here for review.
        </span>
      </p>
    </div>
  </div>
);

// The "Scan Receipt" form body: preview/dropzone + the scan-result card
// (details, editable lines, total). Full Details/items/total sections only
// appear once a receipt is attached (or a scan is running) AND the scan
// didn't fail — an error reverts the card to the "No scan yet" placeholder.
// Single-card vertical rhythm on every breakpoint: attachment on top,
// Details below it, then the editable lines, with the live total pinned to
// the card bottom. Desktop just gets more padding + section air so the wide
// card stays readable instead of squeezed.
const Divider = () => (
  <div
    aria-hidden="true"
    className="my-6 border-t border-[var(--border)] sm:my-7 lg:my-8"
  />
);

const ReceiptPanel = ({
  receipt,
  scanning,
  scanFailed,
  hasScannedContent,
  hasReceiptData,
  itemsTotal,
  onSubmit,
  onFilePicked,
  onRemoveRequest,
  onClearReceipt,
  onItemChange,
  onRemoveItem,
  onAddItem,
}) => {
  const attachment =
    receipt.imageUrl && !scanFailed ? (
      <ReceiptPreview
        receipt={receipt}
        scanning={scanning}
        hasReceiptData={hasReceiptData}
        onRemoveRequest={onRemoveRequest}
        onRemove={onClearReceipt}
      />
    ) : (
      <ReceiptDropzone scanning={scanning} onFile={onFilePicked} />
    );

  return (
    <form
      id="receipt-form"
      onSubmit={onSubmit}
      className="space-y-3 sm:space-y-4 lg:space-y-5"
    >
      {/* A failed scan reverts the panel to the dropzone so the receipt can be
          re-scanned — the error shows in the shared alert box. */}
      {!hasScannedContent ? (
        <div className="space-y-3 sm:space-y-4">
          {attachment}
          <Card padding="lg" className="p-4 sm:p-6 lg:p-7">
            <EmptyScanPlaceholder />
          </Card>
        </div>
      ) : (
        <Card padding="lg" className="p-4 sm:p-6 lg:rounded-3xl lg:p-8 xl:p-10">
          {/* ── Top: receipt file ── */}
          {attachment}

          <div className="mt-6 sm:mt-7 lg:mt-8">
            {/* ── Below: vendor details ── */}
            <ReceiptDetails receipt={receipt} scanning={scanning} />

            <Divider />

            {/* ── Then: editable lines, total pinned at the card bottom ── */}
            <ReceiptItems
              items={receipt.items ?? []}
              scanning={scanning}
              onItemChange={onItemChange}
              onRemoveItem={onRemoveItem}
              onAddItem={onAddItem}
              itemsTotal={itemsTotal}
            />
          </div>
        </Card>
      )}
    </form>
  );
};

export default ReceiptPanel;

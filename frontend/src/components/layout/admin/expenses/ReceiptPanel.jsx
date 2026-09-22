import { ScanLine } from "lucide-react";
import { Card } from "../../../ui/Card";
import ReceiptPreview from "./ReceiptPreview";
import ReceiptDropzone from "./ReceiptDropzone";
import ReceiptDetails from "./ReceiptDetails";
import ReceiptItems from "./ReceiptItems";
import ModelSource from "./ModelSource";

const EmptyScanPlaceholder = () => (
  <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-3 sm:px-4 sm:py-4 lg:gap-3 lg:px-4 lg:py-4">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--ink-muted)] shadow-card lg:h-11 lg:w-11">
      <ScanLine size={20} />
    </span>
    <div className="min-w-0 lg:pt-0">
      <p className="text-base font-semibold tracking-tight text-[var(--ink)]">
        No scan yet
      </p>
      <p className="mt-0.5 max-w-[46ch] text-sm leading-relaxed text-[var(--ink-muted)] lg:mt-1">
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

const Divider = () => (
  <div
    aria-hidden="true"
    className="my-3 border-t border-[var(--border)] sm:my-4 lg:my-4"
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
      className="space-y-2 sm:space-y-3 lg:space-y-3 z-100"
    >
      {/* A failed scan reverts the panel to the dropzone so the receipt can be
          re-scanned — the error shows in the shared alert box. */}
      {!hasScannedContent ? (
        <div className="space-y-2 sm:space-y-3">
          <ModelSource />
          {attachment}
          <Card padding="lg" className="p-3 sm:p-4 lg:p-4">
            <EmptyScanPlaceholder />
          </Card>
        </div>
      ) : (
        <Card padding="lg" className="p-3 sm:p-4 lg:rounded-3xl lg:p-5 xl:p-5">
          {/* ── Top: receipt file ── */}
          {attachment}

          <div className="mt-3 sm:mt-4 lg:mt-4">
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

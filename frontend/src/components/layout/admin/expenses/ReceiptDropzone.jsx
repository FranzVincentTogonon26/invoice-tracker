import { useDropzone } from "react-dropzone";
import ReceiptScanButton from "./ScanReceipt";
import { RECEIPT_ACCEPT } from "../../../../constants";

// Dropzone wrapper for the receipt panel. A scan in progress disables it so
// nothing can be dropped or picked until the current scan ends.
const ReceiptDropzone = ({ scanning, onFile }) => {
  const onDrop = (accepted) => {
    const file = accepted[0];
    if (file) onFile(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: scanning,
    accept: RECEIPT_ACCEPT,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex min-h-[84px] cursor-pointer items-center gap-4 rounded-2xl border border-dashed px-4 py-5 transition-colors active:border-[var(--accent)]/60 sm:min-h-0 sm:gap-3 sm:py-4 lg:rounded-3xl lg:gap-5 lg:px-6 lg:py-6 ${
        isDragActive
          ? "border-[var(--accent)]/60 bg-[var(--accent-soft)]/40"
          : "border-[var(--border)] bg-[var(--surface-2)]/40 hover:border-[var(--accent)]/40"
      }`}
    >
      <input {...getInputProps()} />
      <ReceiptScanButton scanning={scanning} onFile={onFile} />
    </div>
  );
};

export default ReceiptDropzone;

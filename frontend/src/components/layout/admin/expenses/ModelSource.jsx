import { useMemo, useState } from "react";
import Listbox from "../../../ui/Listbox";

import { useExpenses } from "../../../../hooks/useExpenses";
import { getGeminiModel, setGeminiModel } from "../../../../lib/geminiModel";

const toOptions = (models) =>
  models.map(({ model }) => ({ value: model, label: model }));

const ModelSource = ({
  value,
  onChange,
  disabled = false,
  label = "Source:",
}) => {
  const { geminiModel } = useExpenses();

  const options = useMemo(() => {
    const fromDb = toOptions(geminiModel);
    const stored = getGeminiModel();
    return fromDb.some((option) => option.value === stored)
      ? fromDb
      : [{ value: stored, label: stored }, ...fromDb];
  }, [geminiModel]);

  // The first read also seeds localStorage with "gemini-2.5-flash-lite".
  const [picked, setPicked] = useState(() => getGeminiModel());

  const controlled = value !== undefined;

  const handleChange = (next) => {
    // Persist the pick: `getGeminiModel()` re-attaches it to every /ai request
    // as `X-Gemini-Model`, so geminiService.js calls the chosen model.
    setGeminiModel(next);
    if (!controlled) setPicked(next);
    onChange?.(next);
  };

  return (
    // `relative z-10` gives the row its own stacking context so the absolutely
    // positioned Listbox menu (z-40 *inside* this context) paints above the
    // dropzone / preview cards rendered after it in ReceiptPanel. The level
    // stays under ScanOverlay (z-20) so an in-flight scan still covers it.
    <div className="relative z-10 flex items-center justify-end gap-2 text-sm">
      <span className="shrink-0 text-[var(--ink-muted)]">{label}</span>
      <div className="w-48 shrink-0">
        <Listbox
          options={options}
          value={controlled ? value : picked}
          onChange={handleChange}
          placeholder="Select Source"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default ModelSource;

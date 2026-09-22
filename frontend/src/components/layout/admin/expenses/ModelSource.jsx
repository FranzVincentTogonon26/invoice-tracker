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
  label = "Gemini model :",
}) => {
  const { geminiModel } = useExpenses();

  const options = useMemo(() => {
    const fromDb = toOptions(geminiModel);
    const stored = getGeminiModel();
    return fromDb.some((option) => option.value === stored)
      ? fromDb
      : [{ value: stored, label: stored }, ...fromDb];
  }, [geminiModel]);

  const [picked, setPicked] = useState(() => getGeminiModel());

  const controlled = value !== undefined;

  const handleChange = (next) => {
    setGeminiModel(next);
    if (!controlled) setPicked(next);
    onChange?.(next);
  };

  return (
    <div className="relative z-10 flex items-center justify-end gap-2 text-sm">
      <span className="shrink-0 text-[var(--ink-muted)] font-semibold truncate">
        {label}
      </span>
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

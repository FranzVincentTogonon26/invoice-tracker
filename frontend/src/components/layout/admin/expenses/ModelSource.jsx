import { useState } from "react";
import Listbox from "../../../ui/Listbox";

// Sample model list behind the "Source" picker. A live list can be swapped in
// through the `sources` prop — same `{ id, model }` row shape.
const dummyData = [
  { id: 1, model: "gemini-2.5-flash-lite" },
  { id: 2, model: "gemini-3.5-flash" },
];

// `Listbox` speaks `{ value, label }` (it matches the selection on `value` and
// prints `label`), so every source row is mapped onto that shape. The value
// doubles as the model name a future scan request would send.
const toOptions = (sources) =>
  sources.map(({ model }) => ({ value: model, label: model }));

// "Source:" picker shown above the dropzone — which AI model reads the
// receipt. Uncontrolled by default (first sample source preselected) so
// `<ModelSource />` works standalone; pass `value` + `onChange` when the parent
// wants to own the choice, e.g. to send it along with the scan request.
const ModelSource = ({
  sources = dummyData,
  value,
  onChange,
  disabled = false,
  label = "Source:",
}) => {
  const options = toOptions(sources);
  const [picked, setPicked] = useState(() => options[0]?.value ?? "");

  // `value === undefined` means uncontrolled: hold the pick locally, but still
  // report it so a parent can observe the choice without owning it.
  const controlled = value !== undefined;

  const handleChange = (next) => {
    if (!controlled) setPicked(next);
    onChange?.(next);
  };

  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <span className="shrink-0 text-[var(--ink-muted)]">{label}</span>
      {/* Fixed width stops the trigger resizing as model names change. */}
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

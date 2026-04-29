import type React from "react";

// Helper for controlled <Input type="number"> fields.
// Avoids the "can't backspace" UX bug where a Math.max/|| fallback in onChange
// re-stamps the floor on every keystroke when the input goes briefly empty.
// Allows transient empty input; clamps to `min` (or 0) on blur.
//
// Usage:
//   <Input type="number" min={30} {...numberInputProps({ value, setValue, min: 30 })} />
//
// On save, callers should still clamp defensively in case the user saves with
// an empty field (state will be NaN):
//   const safeValue = Math.max(min, Number.isFinite(value) ? value : min);
export function numberInputProps(opts: {
  value: number;
  setValue: (n: number) => void;
  min?: number;
  step?: "int" | "float";
}) {
  const { value, setValue, min, step = "int" } = opts;
  const parse = step === "float" ? parseFloat : parseInt;
  return {
    value: Number.isFinite(value) ? (value as number) : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (v === "") {
        setValue(NaN);
        return;
      }
      const n = parse(v);
      if (!Number.isNaN(n)) setValue(n);
    },
    onBlur: () => {
      if (!Number.isFinite(value) || (min !== undefined && value < min)) {
        setValue(min ?? 0);
      }
    },
  };
}

// Clamp a possibly-NaN value before persisting. Use in save handlers.
export function clampForSave(value: number, min: number, fallback?: number): number {
  if (!Number.isFinite(value)) return fallback ?? min;
  return Math.max(min, value);
}

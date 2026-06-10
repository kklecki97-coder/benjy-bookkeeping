"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

const CUSTOM = "__custom__";

/**
 * A real dropdown of all known categories that shows every option immediately
 * (unlike a datalist, which filters by the typed value). Picking "+ Add a new
 * category…" reveals a free-text field so the owner isn't locked to the list.
 */
export function CategoryPicker({
  value,
  onChange,
  categories,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
  id?: string;
}) {
  // If the current value isn't in the list, we're in "custom" mode.
  const known = categories.includes(value);
  const [custom, setCustom] = useState(value !== "" && !known);

  if (custom) {
    return (
      <div className="flex gap-2">
        <Input
          id={id}
          autoFocus
          placeholder="New category name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setCustom(false);
            onChange(categories[0] ?? "");
          }}
          className="shrink-0 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Pick from list
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM) {
          setCustom(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <option value="" disabled>
        Choose a category…
      </option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value={CUSTOM}>+ Add a new category…</option>
    </select>
  );
}

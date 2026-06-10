"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { createRule, updateRule, deleteRule } from "@/app/actions/rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface Rule {
  id: string;
  rule_type: string;
  pattern: string;
  category: string | null;
  vendor: string | null;
  priority: number;
}

const COLLAPSED_COUNT = 3;

export function RulesTable({ rules }: { rules: Rule[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Form save (create/update) gets its own transition; deletes are tracked per
  // row via deletingId so deleting one rule doesn't grey out the others' Delete
  // buttons.
  const [savePending, startSave] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  // Show everything while editing/adding (the edited rule may be past the fold);
  // otherwise collapse to the first COLLAPSED_COUNT.
  const forceShowAll = expanded || adding || editingId !== null;
  const hasMore = rules.length > COLLAPSED_COUNT;
  const visibleRules = forceShowAll ? rules : rules.slice(0, COLLAPSED_COUNT);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rules.length} rules. Changes apply on the next monthly close.
        </p>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          Add rule
        </Button>
      </div>

      {adding && (
        <RuleForm
          onCancel={() => setAdding(false)}
          onSave={(input) =>
            startSave(async () => {
              await createRule(input);
              setAdding(false);
            })
          }
          pending={savePending}
        />
      )}

      <div className="flex flex-col gap-2">
        {visibleRules.map((rule) =>
          editingId === rule.id ? (
            <RuleForm
              key={rule.id}
              initial={rule}
              onCancel={() => setEditingId(null)}
              onSave={(input) =>
                startSave(async () => {
                  await updateRule(rule.id, input);
                  setEditingId(null);
                })
              }
              pending={savePending}
            />
          ) : (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-4 rounded-xl glass glass-hover p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="text-muted-foreground">
                  Transactions matching{" "}
                </span>
                <span className="font-medium">&ldquo;{rule.pattern}&rdquo;</span>
                <span className="text-muted-foreground"> → </span>
                <span className="font-medium">{rule.category}</span>
                {rule.rule_type === "exception" && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    exception
                  </Badge>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(rule.id)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deletingId === rule.id}
                  onClick={() => {
                    setDeletingId(rule.id);
                    startDelete(async () => {
                      await deleteRule(rule.id);
                      setDeletingId(null);
                    });
                  }}
                >
                  {deletingId === rule.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          ),
        )}
      </div>

      {hasMore && !adding && editingId === null && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex cursor-pointer items-center justify-center gap-1 rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : `Show all ${rules.length} rules`}
          <ChevronDown
            className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}

function RuleForm({
  initial,
  onSave,
  onCancel,
  pending,
}: {
  initial?: Rule;
  onSave: (input: {
    pattern: string;
    category: string;
    vendor: string | null;
    priority: number;
  }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [pattern, setPattern] = useState(initial?.pattern ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  // Priority is an internal ordering concept the owner shouldn't have to think
  // about. Preserve an edited rule's existing priority; default new rules to 50
  // (normal vendor match). Not shown in the form.
  const priority = initial?.priority ?? 50;

  return (
    <div className="flex flex-col gap-3 rounded-xl glass p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rule-pattern" className="text-xs text-muted-foreground">
            When a transaction description contains
          </label>
          <Input
            id="rule-pattern"
            placeholder="e.g. AMZN MKTPL"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rule-category" className="text-xs text-muted-foreground">
            Categorize it as
          </label>
          <Input
            id="rule-category"
            placeholder="e.g. Office supplies"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="rule-vendor" className="text-xs text-muted-foreground">
            Vendor name (optional)
          </label>
          <Input
            id="rule-vendor"
            placeholder="e.g. Amazon"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !pattern || !category}
          onClick={() =>
            onSave({ pattern, category, vendor: vendor || null, priority })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

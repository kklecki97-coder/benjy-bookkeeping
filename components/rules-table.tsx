"use client";

import { useState, useTransition } from "react";
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

export function RulesTable({ rules }: { rules: Rule[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

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
            startTransition(async () => {
              await createRule(input);
              setAdding(false);
            })
          }
          pending={pending}
        />
      )}

      <div className="flex flex-col gap-2">
        {rules.map((rule) =>
          editingId === rule.id ? (
            <RuleForm
              key={rule.id}
              initial={rule}
              onCancel={() => setEditingId(null)}
              onSave={(input) =>
                startTransition(async () => {
                  await updateRule(rule.id, input);
                  setEditingId(null);
                })
              }
              pending={pending}
            />
          ) : (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3 text-sm"
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
              <span className="text-xs text-muted-foreground">
                priority {rule.priority}
              </span>
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
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteRule(rule.id);
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
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
  const [priority, setPriority] = useState(initial?.priority ?? 50);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          placeholder="Pattern (e.g. AMZN MKTPL)"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        />
        <Input
          placeholder="Category (e.g. Office supplies)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <Input
          placeholder="Vendor (optional)"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
        />
        <Input
          type="number"
          placeholder="Priority"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
        />
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

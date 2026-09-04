"use client";

import { useState } from "react";
import { Loader2, Save, Trash2, X, Plus } from "lucide-react";
import { accentFor } from "@/lib/design";
import type { FieldSpec, FlowNode, NodeTypeSpec } from "@/lib/types";

/**
 * The inspector is the piece v1 was missing entirely: node.config was written to
 * the database and never read or edited, so every AI node ran one hardcoded prompt.
 *
 * The form is generated from the node type's FieldSpec list, which means the
 * backend decides what a node is configurable with.
 */
export default function Inspector({
  node,
  spec,
  onSave,
  onDelete,
  onClose,
}: {
  node: FlowNode;
  spec: NodeTypeSpec | undefined;
  onSave: (
    name: string,
    config: Record<string, unknown>,
  ) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  // Seeded from the node once. The parent remounts this component with a new key
  // when the selection changes, so there is no props-into-state effect to keep in
  // sync -- and no way for one node's unsaved edits to leak into another.
  const [name, setName] = useState(node.name);
  const [config, setConfig] = useState<Record<string, unknown>>(node.config);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty =
    name !== node.name ||
    JSON.stringify(config) !== JSON.stringify(node.config);

  const setField = (key: string, value: unknown) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(name, config);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const accent = accentFor(spec?.accent ?? "slate");

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-white/[0.06] bg-[#080a0f]">
      <header className="flex items-start justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Node settings
          </h2>
          <p className={`mt-0.5 text-xs font-medium ${accent.text}`}>
            {spec?.label ?? node.type}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="rounded-md p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
        >
          <X size={15} />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {spec?.description && (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[11px] leading-relaxed text-slate-400">
            {spec.description}
          </p>
        )}

        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>

        {spec?.fields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            help={field.help}
            required={field.required}
          >
            <ConfigInput
              field={field}
              value={config[field.key]}
              onChange={(value) => setField(field.key, value)}
            />
          </Field>
        ))}

        {spec?.fields.length === 0 && (
          <p className="text-[11px] leading-relaxed text-slate-500">
            This node has nothing to configure — the inbound webhook body becomes{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-slate-300">
              {"{{trigger.*}}"}
            </code>{" "}
            for every node downstream.
          </p>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-white/[0.06] p-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Save size={13} />
          )}
          {dirty ? "Save changes" : "Saved"}
        </button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete node"
          className="rounded-lg border border-rose-400/25 p-2 text-rose-400 transition hover:bg-rose-500/15 disabled:opacity-40"
        >
          {deleting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Trash2 size={13} />
          )}
        </button>
      </footer>
    </aside>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/50 px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 transition focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/25";

function Field({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-slate-300">
        {label}
        {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {help && (
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{help}</p>
      )}
    </div>
  );
}

function ConfigInput({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.kind) {
    case "textarea":
    case "code":
      return (
        <textarea
          rows={field.kind === "code" ? 6 : 4}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} resize-y ${field.kind === "code" ? "font-mono text-[11px] leading-relaxed" : ""}`}
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) =>
            // An empty box means "unset", not zero.
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
          className={inputClass}
        />
      );

    case "select":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Choose…</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case "keyvalue":
      return <KeyValueEditor value={value} onChange={onChange} />;

    default:
      return (
        <input
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
  }
}

/** Edits a JSON object as key/value rows — used for HTTP headers and Transform mappings. */
function KeyValueEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: Record<string, string>) => void;
}) {
  const object =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  // Rows are kept in local state so editing a key does not lose focus on each
  // keystroke, which is what happens if the object itself is the source of truth.
  const [rows, setRows] = useState<Array<[string, string]>>(() =>
    Object.entries(object).map(([k, v]) => [k, String(v ?? "")]),
  );

  const commit = (next: Array<[string, string]>) => {
    setRows(next);
    const result: Record<string, string> = {};
    for (const [k, v] of next) {
      if (k.trim()) result[k.trim()] = v;
    }
    onChange(result);
  };

  return (
    <div className="space-y-1.5">
      {rows.map(([key, val], index) => (
        <div key={index} className="flex items-center gap-1.5">
          <input
            value={key}
            placeholder="key"
            onChange={(e) => {
              const next = [...rows];
              next[index] = [e.target.value, val];
              commit(next);
            }}
            className={`${inputClass} flex-1`}
          />
          <input
            value={val}
            placeholder="value"
            onChange={(e) => {
              const next = [...rows];
              next[index] = [key, e.target.value];
              commit(next);
            }}
            className={`${inputClass} flex-[1.4] font-mono text-[11px]`}
          />
          <button
            onClick={() => commit(rows.filter((_, i) => i !== index))}
            aria-label="Remove row"
            className="shrink-0 rounded p-1 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-400"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <button
        onClick={() => commit([...rows, ["", ""]])}
        className="flex items-center gap-1 rounded-md border border-dashed border-white/15 px-2 py-1.5 text-[10px] text-slate-400 transition hover:border-white/30 hover:text-slate-200"
      >
        <Plus size={11} />
        Add row
      </button>
    </div>
  );
}

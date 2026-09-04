"use client";

import * as Icons from "lucide-react";
import { accentFor } from "@/lib/design";
import type { NodeTypeSpec } from "@/lib/types";

const CATEGORY_LABEL: Record<string, string> = {
  trigger: "Triggers",
  action: "Actions",
  logic: "Logic",
};

const CATEGORY_ORDER = ["trigger", "action", "logic"];

/**
 * The palette is rendered entirely from the backend's node-type catalog, so adding
 * a node type on the server makes it appear here with no frontend change. v1
 * hardcoded exactly two buttons.
 */
export default function NodeLibrary({
  specs,
  onAdd,
  disabled,
}: {
  specs: NodeTypeSpec[];
  onAdd: (spec: NodeTypeSpec) => void;
  disabled: boolean;
}) {
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: specs.filter((s) => s.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#080a0f]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Node library
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Click to add, then drag between the dots to connect.
        </p>
      </div>

      <div className="flex flex-col gap-5 p-3">
        {grouped.map(({ category, items }) => (
          <div key={category}>
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {CATEGORY_LABEL[category] ?? category}
            </p>

            <div className="flex flex-col gap-1.5">
              {items.map((spec) => {
                const accent = accentFor(spec.accent);
                const iconName = spec.icon as keyof typeof Icons;
                const Icon = (Icons[iconName] ?? Icons.Box) as React.ComponentType<{
                  size?: number;
                }>;

                return (
                  <button
                    key={spec.type}
                    onClick={() => onAdd(spec)}
                    disabled={disabled}
                    title={spec.description}
                    className="group flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span
                      className={`shrink-0 rounded-md border p-1.5 ${accent.chip} ${accent.text}`}
                    >
                      <Icon size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-200">
                        {spec.label}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-slate-500">
                        {spec.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { accentFor, statusStyle } from "@/lib/design";
import type { ExecutionStatus, NodeTypeSpec } from "@/lib/types";

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  spec: NodeTypeSpec | undefined;
  nodeType: string;
  runStatus: ExecutionStatus | null;
  configured: boolean;
  selected: boolean;
}

/**
 * A custom node type, replacing v1's approach of stuffing raw JSX into node.data.
 *
 * That mattered for more than tidiness: React Flow re-creates node objects on every
 * change, so embedding elements meant re-rendering the whole canvas whenever any
 * one node's hover state moved. This is memoised and reads only its own props.
 */
function FlowNodeCardBase({ data }: NodeProps) {
  const { label, spec, runStatus, configured } = data as FlowNodeData;

  const accent = accentFor(spec?.accent ?? "slate");
  const status = runStatus ? statusStyle(runStatus) : null;

  // The catalog names a lucide icon; fall back rather than crash on a typo.
  const iconName = (spec?.icon ?? "Box") as keyof typeof Icons;
  const Icon = (Icons[iconName] ?? Icons.Box) as React.ComponentType<{
    size?: number;
    className?: string;
  }>;

  const isTrigger = spec?.category === "trigger";

  return (
    <div
      className={`group relative w-[248px] rounded-xl border bg-[#0c0e14]/95 shadow-xl backdrop-blur-sm transition ${accent.ring} ${status?.outline ?? ""}`}
    >
      {/* A trigger starts the graph, so it has no input handle to connect into. */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-[#0c0e14] !bg-slate-400 transition hover:!bg-white"
        />
      )}

      <div className="flex items-start gap-3 p-3.5">
        <div
          className={`shrink-0 rounded-lg border p-2 ${accent.chip} ${accent.text}`}
        >
          <Icon size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-100">
            {label}
          </p>
          <p
            className={`mt-0.5 font-mono text-[10px] uppercase tracking-wide ${accent.text}`}
          >
            {spec?.label ?? (data as FlowNodeData).nodeType}
          </p>
        </div>

        {status && (
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold ${status.badge}`}
          >
            {status.label}
          </span>
        )}
      </div>

      {/* An unconfigured node is the single most common reason a run fails, so it
          is flagged on the canvas rather than only at run time. */}
      {!configured && !status && (
        <div className="flex items-center gap-1.5 border-t border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-1.5">
          <Icons.AlertCircle size={11} className="shrink-0 text-amber-400" />
          <span className="text-[10px] text-amber-300/90">
            Needs configuration
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-[#0c0e14] !bg-slate-400 transition hover:!bg-white"
      />
    </div>
  );
}

export const FlowNodeCard = memo(FlowNodeCardBase);

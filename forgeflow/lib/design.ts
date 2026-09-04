import type { ExecutionStatus } from "./types";

/**
 * v1 painted every element the same yellow — node types, success, pending and
 * "active" were indistinguishable, which is a large part of why the UI was hard to
 * read. Status now owns colour: amber means running, green means done, red means
 * broken, and node identity is carried by hue + icon instead.
 *
 * Tailwind cannot see dynamically built class names, so every variant is written
 * out in full here.
 */

export interface Accent {
  /** Node body border + ring on the canvas. */
  ring: string;
  /** Icon chip background. */
  chip: string;
  /** Icon + label colour. */
  text: string;
  /** Connection line colour, as a raw hex for React Flow's SVG. */
  stroke: string;
}

export const ACCENTS: Record<string, Accent> = {
  amber: {
    ring: "border-amber-400/40",
    chip: "bg-amber-400/15 border-amber-400/30",
    text: "text-amber-300",
    stroke: "#fbbf24",
  },
  violet: {
    ring: "border-violet-400/40",
    chip: "bg-violet-400/15 border-violet-400/30",
    text: "text-violet-300",
    stroke: "#a78bfa",
  },
  sky: {
    ring: "border-sky-400/40",
    chip: "bg-sky-400/15 border-sky-400/30",
    text: "text-sky-300",
    stroke: "#38bdf8",
  },
  emerald: {
    ring: "border-emerald-400/40",
    chip: "bg-emerald-400/15 border-emerald-400/30",
    text: "text-emerald-300",
    stroke: "#34d399",
  },
  cyan: {
    ring: "border-cyan-400/40",
    chip: "bg-cyan-400/15 border-cyan-400/30",
    text: "text-cyan-300",
    stroke: "#22d3ee",
  },
  slate: {
    ring: "border-slate-400/30",
    chip: "bg-slate-400/10 border-slate-400/25",
    text: "text-slate-300",
    stroke: "#94a3b8",
  },
};

export const accentFor = (name: string): Accent =>
  ACCENTS[name] ?? ACCENTS.slate;

export interface StatusStyle {
  label: string;
  /** Badge classes. */
  badge: string;
  /** Small dot colour. */
  dot: string;
  /** Canvas node outline while a run is in progress. */
  outline: string;
  icon: "clock" | "loader" | "check" | "x" | "skip";
}

export const STATUS: Record<ExecutionStatus, StatusStyle> = {
  PENDING: {
    label: "Queued",
    badge: "bg-slate-500/15 text-slate-300 border-slate-400/25",
    dot: "bg-slate-400",
    outline: "ring-0",
    icon: "clock",
  },
  RUNNING: {
    label: "Running",
    badge: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    dot: "bg-amber-400 animate-pulse",
    outline: "ring-2 ring-amber-400/70",
    icon: "loader",
  },
  SUCCESS: {
    label: "Succeeded",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    dot: "bg-emerald-400",
    outline: "ring-2 ring-emerald-400/50",
    icon: "check",
  },
  FAILED: {
    label: "Failed",
    badge: "bg-rose-500/15 text-rose-300 border-rose-400/30",
    dot: "bg-rose-400",
    outline: "ring-2 ring-rose-400/60",
    icon: "x",
  },
  DEAD_LETTER: {
    label: "Dead letter",
    badge: "bg-rose-500/15 text-rose-300 border-rose-400/30",
    dot: "bg-rose-400",
    outline: "ring-2 ring-rose-400/60",
    icon: "x",
  },
  SKIPPED: {
    label: "Skipped",
    badge: "bg-slate-500/10 text-slate-400 border-slate-500/25",
    dot: "bg-slate-500",
    outline: "ring-1 ring-slate-500/40 opacity-50",
    icon: "skip",
  },
};

export const statusStyle = (status: ExecutionStatus | null | undefined) =>
  status ? STATUS[status] ?? STATUS.PENDING : STATUS.PENDING;

/** "3m ago" style timestamps, so a run list scans at a glance. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return new Date(iso).toLocaleDateString();
}

/** Wall-clock duration of a run or step. */
export function duration(
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

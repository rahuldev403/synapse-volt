"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Network,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ApiError, createApi } from "@/lib/api";
import { relativeTime, statusStyle } from "@/lib/design";
import type { Workflow } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import CreateWorkflowDialog from "@/components/CreateWorkflowDialog";

/**
 * The dashboard fetches on the client so it can render honest loading, empty and
 * error states. v1 fetched on the server and swallowed every failure into an empty
 * array, so "the API is down" and "you have no workflows" looked identical.
 */
export default function WorkflowDashboard() {
  const { getToken } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const api = useMemo(() => createApi(getToken), [getToken]);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setWorkflows(await api.listWorkflows());
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load your workflows",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    // Fetching on mount is the "synchronise with an external system" case effects
    // exist for; the state updates land after the await, not in this tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const toggleActive = async (workflow: Workflow) => {
    setPendingId(workflow.id);
    try {
      const updated = await api.updateWorkflow(workflow.id, {
        name: workflow.name,
        description: workflow.description,
        is_active: !workflow.is_active,
      });
      setWorkflows((current) =>
        current.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)),
      );
      toast.success(
        updated.is_active
          ? "Workflow activated — it now accepts webhooks"
          : "Workflow paused",
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not update the workflow",
      );
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (workflow: Workflow) => {
    if (
      !window.confirm(
        `Delete "${workflow.name}"? Its nodes and run history go with it. This cannot be undone.`,
      )
    ) {
      return;
    }

    setPendingId(workflow.id);
    try {
      await api.deleteWorkflow(workflow.id);
      setWorkflows((current) => current.filter((w) => w.id !== workflow.id));
      toast.success("Workflow deleted");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not delete the workflow",
      );
    } finally {
      setPendingId(null);
    }
  };

  const filtered = workflows.filter((w) =>
    `${w.name} ${w.description}`.toLowerCase().includes(query.toLowerCase()),
  );

  const activeCount = workflows.filter((w) => w.is_active).length;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Workflows
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {loading
              ? "Loading…"
              : `${workflows.length} total · ${activeCount} accepting webhooks`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {workflows.length > 0 && (
            <div className="relative">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-48 rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-7 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-amber-400/50 focus:outline-none"
              />
            </div>
          )}
          <CreateWorkflowDialog onCreated={(id) => router.push(`/workflow/${id}`)} />
        </div>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : workflows.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-xs text-slate-500">
          Nothing matches “{query}”.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              busy={pendingId === workflow.id}
              onToggle={() => toggleActive(workflow)}
              onDelete={() => remove(workflow)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
  workflow,
  busy,
  onToggle,
  onDelete,
}: {
  workflow: Workflow;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const lastRun = statusStyle(workflow.last_run_status);

  return (
    <div className="group relative flex flex-col rounded-xl border border-white/[0.07] bg-[#0a0c12] p-4 transition hover:border-white/15">
      <Link
        href={`/workflow/${workflow.id}`}
        className="flex-1 focus:outline-none"
      >
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-slate-100 transition group-hover:text-amber-300">
            {workflow.name}
          </h3>
          <ArrowUpRight
            size={14}
            className="shrink-0 text-slate-600 transition group-hover:text-amber-400"
          />
        </div>

        <p className="line-clamp-2 min-h-[2rem] text-[11px] leading-relaxed text-slate-500">
          {workflow.description || "No description"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-400">
            {workflow.node_count} node{workflow.node_count === 1 ? "" : "s"}
          </span>

          {workflow.last_run_status ? (
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${lastRun.badge}`}
            >
              {lastRun.label} · {relativeTime(workflow.last_run_at)}
            </span>
          ) : (
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-500">
              Never run
            </span>
          )}
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
        <span
          className={`flex items-center gap-1.5 text-[10px] ${
            workflow.is_active ? "text-emerald-400" : "text-slate-500"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              workflow.is_active ? "bg-emerald-400" : "bg-slate-600"
            }`}
          />
          {workflow.is_active ? "Live" : "Paused"}
        </span>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onToggle}
            disabled={busy}
            title={workflow.is_active ? "Pause webhooks" : "Accept webhooks"}
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : workflow.is_active ? (
              <Pause size={12} />
            ) : (
              <Play size={12} />
            )}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            title="Delete workflow"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-40"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[150px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]"
        />
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-400/20 bg-rose-950/20 p-12 text-center">
      <AlertTriangle size={22} className="text-rose-400" />
      <p className="max-w-sm text-sm text-slate-300">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.06]"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-14 text-center">
      <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-amber-400">
        <Network size={22} />
      </div>
      <h3 className="text-sm font-medium text-slate-200">No workflows yet</h3>
      <p className="max-w-sm text-[11px] leading-relaxed text-slate-500">
        A workflow is a graph of nodes: a webhook comes in, and each node reads
        what the ones before it produced. Create one to start building.
      </p>
      <CreateWorkflowDialog
        trigger={
          <span className="mt-1 flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300">
            <Plus size={13} />
            Create your first workflow
          </span>
        }
      />
    </div>
  );
}

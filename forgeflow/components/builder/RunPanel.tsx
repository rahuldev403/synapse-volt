"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  Play,
  SkipForward,
  Terminal,
  X,
} from "lucide-react";
import { duration, relativeTime, statusStyle } from "@/lib/design";
import { isTerminal, type Execution, type ExecutionStep } from "@/lib/types";
import { webhookUrl } from "@/lib/api";

const DEFAULT_PAYLOAD = JSON.stringify(
  {
    email: "jane@example.com",
    amount: 50,
    message: "I am dissatisfied and want a refund.",
  },
  null,
  2,
);

/**
 * The run panel is where v1's flow was thinnest: it fired a webhook, waited a
 * hardcoded 1.5s, then showed a status pill that never updated again and told you
 * nothing about what the run had actually done.
 *
 * This polls the live execution until it reaches a terminal state, and renders the
 * per-node timeline the backend now records. The active run is owned by the parent
 * so the canvas can colour its nodes from the same data.
 */
export default function RunPanel({
  workflowId,
  activeRun,
  onActiveRunChange,
  onRun,
  onFetchExecutions,
  onFetchExecution,
}: {
  workflowId: string;
  activeRun: Execution | null;
  onActiveRunChange: (execution: Execution | null) => void;
  onRun: (payload: unknown) => Promise<string | null>;
  onFetchExecutions: () => Promise<Execution[]>;
  onFetchExecution: (id: string) => Promise<Execution | null>;
}) {
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<Execution[]>([]);
  const [copied, setCopied] = useState(false);

  // Held in a ref so the polling effect can read the current id without tearing
  // down and rebuilding its interval on every render.
  const pollingId = useRef<string | null>(null);

  const refreshHistory = useCallback(async () => {
    setHistory(await onFetchExecutions());
  }, [onFetchExecutions]);

  useEffect(() => {
    // Loading the run history is a fetch, not derived state: the updates land
    // after the await rather than synchronously in this tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshHistory();
  }, [refreshHistory]);

  // Poll only while a run is actually moving. An interval that never stops would
  // keep hitting the API for as long as the tab stays open.
  useEffect(() => {
    if (!activeRun || isTerminal(activeRun.status)) {
      pollingId.current = null;
      return;
    }

    pollingId.current = activeRun.id;

    const timer = setInterval(async () => {
      const id = pollingId.current;
      if (!id) return;

      const fresh = await onFetchExecution(id);
      if (!fresh) return;

      onActiveRunChange(fresh);
      if (isTerminal(fresh.status)) {
        pollingId.current = null;
        refreshHistory();
      }
    }, 900);

    return () => clearInterval(timer);
  }, [activeRun, onFetchExecution, onActiveRunChange, refreshHistory]);

  const handleRun = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch (err) {
      setPayloadError(
        err instanceof Error ? err.message : "That is not valid JSON",
      );
      return;
    }
    setPayloadError(null);
    setRunning(true);

    try {
      const executionId = await onRun(parsed);
      if (executionId) {
        onActiveRunChange(await onFetchExecution(executionId));
        refreshHistory();
      }
    } finally {
      setRunning(false);
    }
  };

  const openExecution = async (id: string) => {
    onActiveRunChange(await onFetchExecution(id));
  };

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl(workflowId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-white/[0.06] bg-[#080a0f]">
      <div className="border-b border-white/[0.06] p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Test payload
          </h2>
          <button
            onClick={copyWebhook}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-400 transition hover:border-white/25 hover:text-slate-200"
            title={webhookUrl(workflowId)}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? "Copied" : "Webhook URL"}
          </button>
        </div>

        <textarea
          rows={6}
          value={payload}
          onChange={(e) => {
            setPayload(e.target.value);
            setPayloadError(null);
          }}
          spellCheck={false}
          aria-label="Test payload JSON"
          className={`w-full resize-y rounded-lg border bg-black/60 p-2.5 font-mono text-[11px] leading-relaxed text-slate-200 focus:outline-none focus:ring-1 ${
            payloadError
              ? "border-rose-400/50 focus:ring-rose-400/25"
              : "border-white/10 focus:border-amber-400/60 focus:ring-amber-400/25"
          }`}
        />

        {payloadError && (
          <p className="mt-1.5 text-[10px] text-rose-400">{payloadError}</p>
        )}

        <button
          onClick={handleRun}
          disabled={running}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} fill="currentColor" />
          )}
          {running ? "Queueing…" : "Run workflow"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeRun ? (
          <ExecutionDetail
            execution={activeRun}
            onBack={() => {
              pollingId.current = null;
              onActiveRunChange(null);
              refreshHistory();
            }}
          />
        ) : (
          <HistoryList history={history} onOpen={openExecution} />
        )}
      </div>
    </aside>
  );
}

function HistoryList({
  history,
  onOpen,
}: {
  history: Execution[];
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <Terminal size={12} className="text-slate-500" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Recent runs
        </h2>
        <span className="rounded-full border border-white/10 px-1.5 text-[10px] text-slate-500">
          {history.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {history.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Terminal size={20} className="text-slate-700" />
            <p className="text-xs text-slate-500">No runs yet</p>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Run the workflow above, or POST your payload to the webhook URL.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {history.map((execution) => {
              const status = statusStyle(execution.status);
              return (
                <button
                  key={execution.id}
                  onClick={() => onOpen(execution.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[11px] text-slate-300">
                      {execution.id.slice(0, 8)}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {relativeTime(execution.started_at)} ·{" "}
                      {execution.trigger_type.toLowerCase()}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${status.badge}`}
                  >
                    {status.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ExecutionDetail({
  execution,
  onBack,
}: {
  execution: Execution;
  onBack: () => void;
}) {
  const status = statusStyle(execution.status);
  const steps = execution.steps ?? [];
  const finished = steps.filter((s) => s.status !== "PENDING").length;
  const elapsed = duration(execution.started_at, execution.completed_at);

  return (
    <>
      <div className="border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            <span className="font-mono text-[11px] text-slate-300">
              {execution.id.slice(0, 8)}
            </span>
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${status.badge}`}
            >
              {status.label}
            </span>
          </div>
          <button
            onClick={onBack}
            aria-label="Back to run history"
            className="rounded p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
          >
            <X size={13} />
          </button>
        </div>

        <p className="mt-1 text-[10px] text-slate-500">
          {finished}/{steps.length} steps
          {elapsed && ` · ${elapsed}`}
        </p>

        {execution.error && (
          <p className="mt-2 rounded-md border border-rose-400/25 bg-rose-950/40 p-2 text-[10px] leading-relaxed text-rose-300">
            {execution.error}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {steps.length === 0 ? (
          <p className="p-4 text-center text-[11px] text-slate-500">
            Waiting for the engine to pick this run up…
          </p>
        ) : (
          <ol className="space-y-1.5">
            {steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

function StepRow({ step }: { step: ExecutionStep }) {
  const [open, setOpen] = useState(false);
  const status = statusStyle(step.status);
  const elapsed = duration(step.started_at, step.completed_at);

  const StatusIcon =
    status.icon === "check"
      ? Check
      : status.icon === "x"
        ? X
        : status.icon === "skip"
          ? SkipForward
          : status.icon === "loader"
            ? Loader2
            : Clock;

  const hasDetail = step.output != null || step.error != null;

  return (
    <li className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!hasDetail}
        aria-expanded={hasDetail ? open : undefined}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition enabled:hover:bg-white/[0.04] disabled:cursor-default"
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${status.badge}`}
        >
          <StatusIcon
            size={11}
            className={status.icon === "loader" ? "animate-spin" : ""}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-medium text-slate-200">
            {step.node_name}
          </span>
          <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wide text-slate-500">
            {step.node_type}
            {step.attempt > 1 && ` · attempt ${step.attempt}`}
            {elapsed && ` · ${elapsed}`}
          </span>
        </span>

        {hasDetail && (
          <ChevronDown
            size={13}
            className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="space-y-2 border-t border-white/[0.06] bg-black/40 p-2.5">
          {step.error && (
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-rose-400">
                Error
              </p>
              <p className="rounded bg-rose-950/40 p-2 text-[10px] leading-relaxed text-rose-300">
                {step.error}
              </p>
            </div>
          )}
          {step.output != null && (
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Output
              </p>
              <pre className="max-h-56 overflow-auto rounded bg-black/60 p-2 font-mono text-[10px] leading-relaxed text-slate-300">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

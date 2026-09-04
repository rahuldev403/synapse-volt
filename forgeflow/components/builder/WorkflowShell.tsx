"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2, SearchX } from "lucide-react";
import { API_URL, ApiError, checkApiVersion, createApi } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import type { Workflow } from "@/lib/types";
import AppHeader from "@/components/AppHeader";
import WorkflowStatusPill from "@/components/WorkflowStatusPill";
import WorkflowBuilder from "./WorkflowBuilder";

type State =
  | { kind: "loading" }
  | { kind: "ready"; workflow: Workflow }
  | { kind: "missing" }
  | { kind: "error"; message: string; hint?: string };

/**
 * Loads the workflow client-side.
 *
 * The page used to fetch this in a server component and call notFound() if the
 * fetch returned anything falsy — so an unreachable API, an expired session and a
 * genuinely deleted workflow all rendered the same "not found" page. That is
 * actively misleading: it sends you looking for a missing record when the real
 * problem is the API.
 *
 * Loading here also means there is one authenticated path to the backend (the
 * browser's Clerk token) instead of two that can fail independently.
 */
export default function WorkflowShell({ workflowId }: { workflowId: string }) {
  const { getToken } = useAuth();
  const api = useMemo(() => createApi(getToken), [getToken]);
  const [state, setState] = useState<State>({ kind: "loading" });

  // Bumping this re-runs the effect, which is how "Try again" retries without a
  // second code path doing the same fetch.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const workflow = await api.getWorkflow(workflowId);
        if (!cancelled) setState({ kind: "ready", workflow });
      } catch (err) {
        const failure = await describeFailure(err);
        // Navigating away mid-request must not write to an unmounted component.
        if (!cancelled) setState(failure);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [api, workflowId, attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  if (state.kind === "loading") {
    return (
      <Centered>
        <Loader2 size={22} className="animate-spin text-amber-400" />
        <p className="text-xs text-slate-500">Loading workflow…</p>
      </Centered>
    );
  }

  if (state.kind === "missing") {
    return (
      <Centered>
        <SearchX size={22} className="text-slate-500" />
        <p className="text-sm text-slate-200">This workflow no longer exists</p>
        <p className="max-w-sm text-[11px] leading-relaxed text-slate-500">
          It may have been deleted, or the link belongs to a different account.
        </p>
        <BackLink />
      </Centered>
    );
  }

  if (state.kind === "error") {
    return (
      <Centered>
        <AlertTriangle size={22} className="text-rose-400" />
        <p className="max-w-md text-sm text-slate-200">{state.message}</p>
        {state.hint && (
          <p className="max-w-md rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-slate-400">
            {state.hint}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={retry}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.06]"
          >
            Try again
          </button>
          <BackLink />
        </div>
      </Centered>
    );
  }

  const { workflow } = state;

  return (
    <>
      <AppHeader
        breadcrumb={{
          label: workflow.name,
          sub: workflow.description || undefined,
        }}
        actions={<WorkflowStatusPill isActive={workflow.is_active} />}
      />
      <WorkflowBuilder workflowId={workflowId} workflowName={workflow.name} />
    </>
  );
}

/**
 * Turns a failure into something the reader can act on. The status code carries
 * most of the meaning, so it is not thrown away.
 */
async function describeFailure(err: unknown): Promise<State> {
  if (!(err instanceof ApiError)) {
    return {
      kind: "error",
      message: (err as Error)?.message || "Something went wrong loading this workflow",
    };
  }

  switch (err.status) {
    case 0:
      return {
        kind: "error",
        message: err.message,
        hint: `Start it with "go run ./cmd/api" in forgeflow-backend, or point NEXT_PUBLIC_API_URL at a running instance.`,
      };

    case 401: {
      // An older backend put its auth middleware in front of every unmatched
      // path, so it answers 401 for routes it simply does not have. Check before
      // telling someone their perfectly good session expired.
      const version = await checkApiVersion();
      if (!version.ok) {
        return {
          kind: "error",
          message: "This build of the app is talking to an out-of-date API.",
          hint: version.reason,
        };
      }
      return {
        kind: "error",
        message: "Your session has expired.",
        hint: "Sign out and back in to get a fresh token.",
      };
    }

    case 404: {
      // A 404 is ambiguous: either the workflow is genuinely gone, or the API
      // being called is an older build that never had this route. Probing a
      // route that only exists in the current backend tells those apart, instead
      // of blaming a record that is actually fine.
      const version = await checkApiVersion();
      if (!version.ok) {
        return {
          kind: "error",
          message: "This build of the app is talking to an out-of-date API.",
          hint: version.reason,
        };
      }
      return { kind: "missing" };
    }

    default:
      return {
        kind: "error",
        message: err.message,
        hint: `The API at ${API_URL} returned ${err.status}.`,
      };
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.06]"
    >
      <ArrowLeft size={12} />
      Back to workflows
    </Link>
  );
}

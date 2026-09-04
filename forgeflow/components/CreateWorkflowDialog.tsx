"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Plus, X } from "lucide-react";
import { ApiError, createApi } from "@/lib/api";
import { useIsClient } from "@/lib/useIsClient";
import { useToast } from "@/components/ui/Toast";

export default function CreateWorkflowDialog({
  onCreated,
  trigger,
}: {
  onCreated?: (workflowId: string) => void;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const toast = useToast();
  const api = useMemo(() => createApi(getToken), [getToken]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isClient = useIsClient();

  // Escape should close a modal — a dialog you can only leave by clicking a
  // specific X is a small but constant friction.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const workflow = await api.createWorkflow({
        name: name.trim(),
        description: description.trim(),
      });

      setOpen(false);
      setName("");
      setDescription("");
      toast.success("Workflow created");

      if (onCreated) onCreated(workflow.id);
      else router.push(`/workflow/${workflow.id}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not create the workflow",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <span className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300">
            <Plus size={13} />
            New workflow
          </span>
        )}
      </button>

      {open &&
        isClient &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create workflow"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a0c12] p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    New workflow
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    You can add nodes and connect them next.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-md p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label
                    htmlFor="workflow-name"
                    className="mb-1.5 block text-[11px] font-medium text-slate-300"
                  >
                    Name
                  </label>
                  <input
                    id="workflow-name"
                    autoFocus
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Support ticket triage"
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/25"
                  />
                </div>

                <div>
                  <label
                    htmlFor="workflow-description"
                    className="mb-1.5 block text-[11px] font-medium text-slate-300"
                  >
                    Description{" "}
                    <span className="text-slate-600">(optional)</span>
                  </label>
                  <textarea
                    id="workflow-description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What this workflow does and what triggers it."
                    className="w-full resize-none rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/25"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-xs text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting && (
                      <Loader2 size={12} className="animate-spin" />
                    )}
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Terminal,
  Loader2,
  Code2,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/nextjs";

interface Execution {
  id: string;
  status: string;
  trigger_payload: any;
  started_at: string;
  completed_at: string | null;
}

export default function ExecutionPanel({ workflowId }: { workflowId: string }) {
  const { getToken } = useAuth();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [payload, setPayload] = useState(
    JSON.stringify(
      {
        email: "jane@example.com",
        message: "I am dissatisfied and want a $50 refund.",
      },
      null,
      2,
    ),
  );
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getApiUrl = () =>
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  const fetchExecutions = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const token = await getToken();
      const apiUrl = getApiUrl();
      const res = await fetch(
        `${apiUrl}/api/v1/workflows/${workflowId}/executions`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        },
      );
      if (res.ok) {
        const data = await res.json();
        setExecutions(data);
      }
    } catch (err) {
      console.error("Failed to load executions", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [workflowId, getToken]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const handleFireWebhook = async () => {
    setIsSending(true);
    try {
      JSON.parse(payload); // Validate JSON format
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/webhooks/${workflowId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      if (res.ok) {
        // Wait 1.5s for Go worker processing, then fetch updated execution logs
        setTimeout(() => {
          fetchExecutions();
        }, 1500);
      } else {
        alert("Webhook trigger failed.");
      }
    } catch (e) {
      alert("Invalid JSON format. Please verify your payload.");
    } finally {
      setIsSending(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full gap-3 bg-[#080808]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-4 shadow-2xl overflow-hidden selection:bg-yellow-400 selection:text-black">
      {/* Trigger Console Section */}
      <div className="bg-[#0f0f0f]/90 border border-white/[0.08] rounded-xl p-3.5 flex flex-col gap-2.5 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-neutral-300">
            <Code2 size={14} className="text-yellow-400" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white">
              Webhook Ingress Test
            </span>
          </div>

          <button
            onClick={handleFireWebhook}
            disabled={isSending}
            className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wide transition shadow-[0_0_15px_rgba(250,204,21,0.35)] cursor-pointer"
          >
            {isSending ? (
              <Loader2 size={12} className="animate-spin text-black" />
            ) : (
              <Play size={12} fill="black" />
            )}
            <span>{isSending ? "DISPATCHING..." : "RUN FLOW →"}</span>
          </button>
        </div>

        <div className="relative">
          <textarea
            rows={4}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="w-full bg-black/90 text-yellow-300 font-mono text-[11px] p-3 rounded-lg border border-white/10 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 resize-none leading-relaxed"
          />
          <div className="absolute bottom-2.5 right-2.5 text-[9px] font-mono text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/20 pointer-events-none font-bold">
            JSON
          </div>
        </div>
      </div>

      {/* Execution Logs List (Developer Terminal) */}
      <div className="flex-1 bg-[#0f0f0f]/90 border border-white/[0.08] rounded-xl p-3.5 flex flex-col min-h-0 shadow-lg">
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-yellow-400" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white">
              Execution Telemetry
            </span>
            <span className="text-[10px] font-mono bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-400/30 font-bold">
              {executions.length}
            </span>
          </div>

          <button
            onClick={fetchExecutions}
            disabled={isRefreshing}
            title="Refresh executions"
            className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-white/[0.05] transition cursor-pointer"
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? "animate-spin text-yellow-400" : ""}
            />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {executions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 gap-2">
              <Terminal size={24} className="text-neutral-600" />
              <p className="text-xs font-mono">// No execution events yet.</p>
              <p className="text-[10px] text-neutral-600 font-mono">
                Trigger a manual payload above to dispatch tasks to Go
                background workers.
              </p>
            </div>
          ) : (
            executions.map((ex) => {
              const isSuccess = ex.status === "SUCCESS";
              const isFailed = ex.status === "FAILED";
              const isExpanded = expandedId === ex.id;

              return (
                <div
                  key={ex.id}
                  onClick={() => toggleExpand(ex.id)}
                  className="bg-black/90 hover:bg-black border border-white/[0.08] hover:border-yellow-400/40 rounded-xl p-3 flex flex-col gap-2 transition cursor-pointer group shadow-sm"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      <span className="font-mono text-[11px] font-medium text-neutral-300">
                        {ex.id.slice(0, 8)}...
                      </span>
                    </div>

                    <span
                      className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        isSuccess
                          ? "bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 shadow-[0_0_12px_rgba(250,204,21,0.25)]"
                          : isFailed
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.25)]"
                            : "bg-white/10 text-white border border-white/20 animate-pulse shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                      }`}
                    >
                      {isSuccess ? (
                        <CheckCircle2 size={11} />
                      ) : isFailed ? (
                        <XCircle size={11} />
                      ) : (
                        <Clock size={11} />
                      )}
                      {ex.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <Clock size={10} />
                      <span>
                        {new Date(ex.started_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <span className="text-neutral-400 group-hover:text-yellow-400 transition text-[9px]">
                      {isExpanded ? "Hide Payload ▲" : "View Payload ▼"}
                    </span>
                  </div>

                  <pre className="bg-[#050505] p-2.5 rounded-lg text-[10px] font-mono text-neutral-300 overflow-x-auto border border-white/[0.04] leading-relaxed">
                    {JSON.stringify(ex.trigger_payload, null, 2)}
                  </pre>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

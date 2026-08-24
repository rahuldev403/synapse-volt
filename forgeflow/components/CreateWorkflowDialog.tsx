"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, GitBranch, Zap } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

export default function CreateWorkflowDialog() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const res = await fetch(`${apiUrl}/api/v1/workflows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || "Automated agent workflow",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsOpen(false);
        setName("");
        setDescription("");
        router.push(`/workflow/${data.id}`);
      } else {
        alert("Failed to create workflow");
      }
    } catch (err) {
      console.error(err);
      alert("Network error creating workflow");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 rounded-xl font-mono font-bold text-xs tracking-wide transition shadow-[0_0_20px_rgba(250,204,21,0.35)] cursor-pointer"
      >
        <Plus size={15} />
        <span>New Workflow</span>
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-in fade-in duration-200">
            <div className="relative bg-[#080808] border border-white/10 rounded-2xl w-full max-w-lg p-7 shadow-[0_25px_70px_rgba(0,0,0,0.95)] animate-in zoom-in-95 duration-150 overflow-hidden">
              {/* Top ambient yellow accent line */}
              <div className="absolute -top-px left-10 right-10 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none" />

              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 rounded-lg bg-yellow-400/15 text-yellow-400 border border-yellow-400/30">
                  <GitBranch size={16} />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight font-mono">
                  INITIALIZE PIPELINE GRAPH
                </h3>
              </div>
              <p className="text-xs text-neutral-400 mb-6 font-normal">
                Initialize an autonomous workflow graph dispatched across Go
                worker routines.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-medium text-neutral-300 mb-1.5 tracking-tight uppercase">
                    Pipeline Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inbound Support Triage Agent"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/80 border border-white/10 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none transition font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-neutral-300 mb-1.5 tracking-tight uppercase">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe webhook ingress payloads and AI tool routines..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-black/80 border border-white/10 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none resize-none transition font-sans"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-mono text-neutral-400 hover:text-white hover:bg-white/[0.04] transition cursor-pointer"
                  >
                    [ Cancel ]
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition shadow-[0_0_20px_rgba(250,204,21,0.35)] cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 size={14} className="animate-spin text-black" />
                    ) : (
                      <Zap size={14} fill="black" />
                    )}
                    <span>
                      {isSubmitting ? "INITIALIZING..." : "CREATE GRAPH →"}
                    </span>
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

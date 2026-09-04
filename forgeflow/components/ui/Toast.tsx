"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, X, AlertTriangle } from "lucide-react";
import { useIsClient } from "@/lib/useIsClient";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * useToast replaces the window.alert() calls v1 used for every outcome. alert()
 * blocks the main thread, cannot be styled, and gives no way to tell a success
 * from a failure at a glance.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const KINDS: Record<
  ToastKind,
  { icon: typeof Info; classes: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    classes: "border-emerald-400/30 bg-emerald-950/80",
    iconClass: "text-emerald-400",
  },
  error: {
    icon: AlertTriangle,
    classes: "border-rose-400/30 bg-rose-950/80",
    iconClass: "text-rose-400",
  },
  info: {
    icon: Info,
    classes: "border-slate-400/25 bg-slate-900/85",
    iconClass: "text-slate-300",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const isClient = useIsClient();

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, kind, message }]);
      // Errors linger, because they usually need reading twice.
      const ttl = kind === "error" ? 7000 : 3500;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {isClient &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-full max-w-sm flex-col gap-2"
          >
            {toasts.map((toast) => {
              const { icon: Icon, classes, iconClass } = KINDS[toast.kind];
              return (
                <div
                  key={toast.id}
                  className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${classes}`}
                >
                  <Icon size={16} className={`mt-0.5 shrink-0 ${iconClass}`} />
                  <p className="flex-1 leading-relaxed text-slate-100">
                    {toast.message}
                  </p>
                  <button
                    onClick={() => dismiss(toast.id)}
                    aria-label="Dismiss"
                    className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

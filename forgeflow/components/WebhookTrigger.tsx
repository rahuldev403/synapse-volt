"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WebhookTrigger({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const [payload, setPayload] = useState(
    '{\n  "email": "test@example.com",\n  "message": "I want a refund."\n}',
  );
  const [isSending, setIsSending] = useState(false);

  const fireWebhook = async () => {
    setIsSending(true);
    try {
      JSON.parse(payload);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks/${workflowId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
      );

      if (res.ok) {
        router.refresh();
      } else {
        alert("Webhook failed to send.");
      }
    } catch (e) {
      alert("Invalid JSON format. Please fix the payload.");
    }
    setIsSending(false);
  };

  return (
    <div className="terminal-window p-8 mb-10 cyber-border relative">
      <div className="absolute top-0 right-0 p-2 text-xs text-green-700 bg-green-900/20 border-b border-l border-green-800">
        MOD_TRIG.exe
      </div>
      <h3 className="text-3xl text-purple-400 mb-6 font-bold flex items-center gap-3">
        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
        MANUAL_TRIGGER_CONSOLE
      </h3>

      <textarea
        className="w-full h-40 bg-black/60 text-green-400 p-4 border border-green-800 font-mono text-lg mb-8 focus:outline-none focus:border-green-400 focus:shadow-[0_0_10px_rgba(0,255,0,0.3)] transition-all resize-none"
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
      />

      <div className="flex justify-center">
        <button
          onClick={fireWebhook}
          disabled={isSending}
          className="bg-black text-green-400 px-12 py-6 text-3xl font-black cyber-btn-glow cyber-btn-active uppercase tracking-widest disabled:opacity-50 disabled:grayscale transition-all hover:bg-purple-900/30 hover:text-white"
        >
          {isSending ? ">> TRANSMITTING... <<" : ">> FIRE_WEBHOOK <<"}
        </button>
      </div>
    </div>
  );
}

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
    <div className="border-2 border-green-500 bg-gray-900 p-6 mb-10 retro-shadow">
      <h3 className="text-3xl text-green-400 mb-4"> MANUAL_TRIGGER_CONSOLE</h3>

      <textarea
        className="w-full h-32 bg-black text-green-300 p-4 border border-gray-600 font-mono text-xl mb-4 focus:outline-none focus:border-green-400"
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
      />

      <button
        onClick={fireWebhook}
        disabled={isSending}
        className="bg-purple-600 text-white px-6 py-2 text-2xl font-bold retro-border retro-btn-active hover:bg-purple-500 disabled:opacity-50"
      >
        {isSending ? "[ TRANSMITTING... ]" : "[ FIRE WEBHOOK ]"}
      </button>
    </div>
  );
}

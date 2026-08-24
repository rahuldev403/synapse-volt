"use client";

import { useState } from "react";

export default function AddNodeBtn({ workflowId }: { workflowId: string }) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNode = async () => {
    setIsAdding(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflows/${workflowId}/nodes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "AI Tool Agent",
            type: "AI",
            config: {},
          }),
        },
      );

      if (res.ok) {
        alert(
          "Success! The AI Node has been attached. You can now fire webhooks.",
        );
      }
    } catch (e) {
      alert("Failed to attach node.");
    }
    setIsAdding(false);
  };

  return (
    <button
      onClick={handleAddNode}
      disabled={isAdding}
      className="bg-blue-600 text-white px-4 py-2 text-xl font-bold retro-border retro-btn-active hover:bg-blue-500 mb-6 w-full"
    >
      {isAdding ? "[ UPLOADING NEURAL NET... ]" : "[ + ATTACH AI NODE ]"}
    </button>
  );
}

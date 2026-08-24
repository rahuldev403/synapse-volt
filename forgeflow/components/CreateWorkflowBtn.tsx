"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export default function CreateWorkflowBtn() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflows`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            name: "NEW AGENT WORKFLOW",
            description: "Created directly from the retro UI",
          }),
        },
      );

      if (res.ok) {
        router.refresh();
      }
    } catch (e) {
      alert("Failed to create workflow");
    }
    setIsCreating(false);
  };

  return (
    <button
      onClick={handleCreate}
      disabled={isCreating}
      className="bg-green-500 text-black px-8 py-3 text-3xl font-bold retro-border retro-shadow retro-btn-active hover:bg-green-400 transition-colors mt-6"
    >
      {isCreating ? "[ INITIALIZING... ]" : "[ + NEW WORKFLOW ]"}
    </button>
  );
}

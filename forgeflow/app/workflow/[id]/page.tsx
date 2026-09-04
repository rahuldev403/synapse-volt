import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import AppHeader from "@/components/AppHeader";
import WorkflowBuilder from "@/components/builder/WorkflowBuilder";
import WorkflowStatusPill from "@/components/WorkflowStatusPill";
import type { Workflow } from "@/lib/types";

/**
 * The workflow name is fetched on the server so the header renders with real
 * content on first paint instead of flashing a raw UUID, which is all v1 showed.
 */
async function getWorkflow(
  id: string,
  token: string | null,
): Promise<Workflow | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  try {
    const res = await fetch(`${apiUrl}/api/v1/workflows/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Workflow;
  } catch {
    // The builder itself surfaces connection problems, so a failure here only
    // costs the pre-rendered title.
    return null;
  }
}

export default async function WorkflowDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { getToken } = await auth();
  const workflow = await getWorkflow(id, await getToken());

  if (!workflow) notFound();

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#05070b]">
      <AppHeader
        breadcrumb={{
          label: workflow.name,
          sub: workflow.description || undefined,
        }}
        actions={<WorkflowStatusPill isActive={workflow.is_active} />}
      />
      <WorkflowBuilder workflowId={id} workflowName={workflow.name} />
    </main>
  );
}

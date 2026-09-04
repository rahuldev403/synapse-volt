import WorkflowShell from "@/components/builder/WorkflowShell";

/**
 * The route is protected by proxy.ts, so reaching this component already means the
 * visitor is signed in. Everything else is loaded by WorkflowShell over the
 * browser's authenticated session.
 *
 * This deliberately does not fetch the workflow server-side. Doing so created a
 * second authenticated path to the backend that could fail on its own, and any
 * failure — API down, stale deployment, expired token — was flattened into
 * notFound(), which told you the workflow was missing when it was not.
 */
export default async function WorkflowDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#05070b]">
      <WorkflowShell workflowId={id} />
    </main>
  );
}

import AddNodeBtn from "@/components/AddNodeBtn";
import WebhookTrigger from "@/components/WebhookTrigger";
import { auth } from "@clerk/nextjs/server";

interface Execution {
  id: string;
  status: string;
  trigger_payload: any;
  started_at: string;
  completed_at: string | null;
}

async function getExecutions(workflowId: string, token: string | null): Promise<Execution[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflows/${workflowId}/executions`,
    { 
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store" 
    },
  );
  if (!res.ok) return [];
  return res.json();
}

export default async function WorkflowDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const workflowId = resolvedParams.id;

  const { getToken } = auth();
  const token = await getToken();

  const executions = await getExecutions(workflowId, token);

  return (
    <main className="p-10">
      <h1 className="text-6xl mb-12 text-black bg-green-500 inline-block p-4 cyber-shadow font-bold uppercase tracking-widest border border-green-300">
        &gt; FORGEFLOW_ROOT
      </h1>

      <div className="cyber-border cyber-shadow p-8 bg-black/80 backdrop-blur-md inline-block w-full max-w-5xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_10px_#00ff00]"></div>
        
        <h2 className="text-4xl text-purple-500 mb-2 font-bold flex items-center gap-4">
          <span className="w-4 h-4 bg-purple-500 block animate-pulse"></span>
          WORKFLOW_LOGS
        </h2>

        <p className="text-xl text-green-700 mb-8 font-mono border-b border-green-900 pb-4">
          TARGET: {workflowId}
        </p>

        <AddNodeBtn workflowId={workflowId} />
        <WebhookTrigger workflowId={workflowId} />

        <div className="space-y-6 mt-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
            <h3 className="text-2xl text-green-500 tracking-wider">EXECUTION_HISTORY</h3>
          </div>

          {executions.length === 0 ? (
            <p className="text-xl text-purple-400 animate-pulse bg-purple-900/20 p-4 border border-purple-800">
              [ WARN ] NO EXECUTIONS DETECTED. AWAITING WEBHOOK TRIGGER...
            </p>
          ) : (
            executions.map((ex) => (
              <div
                key={ex.id}
                className="p-6 terminal-window flex flex-col gap-3 relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 w-1 h-full bg-green-500 opacity-50"></div>
                <div className="flex justify-between items-center border-b border-green-800/50 pb-3">
                  <span className="text-xl text-green-300 font-mono">
                    ID: {ex.id.split("-")[0]}...
                  </span>
                  <span
                    className={`text-sm px-4 py-1 font-bold tracking-widest cyber-border ${
                      ex.status === "SUCCESS"
                        ? "bg-green-500/20 text-green-400 border-green-500"
                        : ex.status === "FAILED"
                          ? "bg-red-500/20 text-red-400 border-red-500"
                          : "bg-purple-500/20 text-purple-400 border-purple-500 animate-pulse"
                    }`}
                  >
                    [{ex.status}]
                  </span>
                </div>

                <p className="text-sm text-green-600 font-mono">
                  TIMESTAMP: {new Date(ex.started_at).toISOString()}
                </p>

                <div className="mt-2 bg-black/50 p-4 border border-green-900/50">
                  <p className="text-purple-500 text-sm mb-2 font-bold tracking-wider"> &gt; PAYLOAD_DATA:</p>
                  <pre className="text-green-400 text-sm overflow-x-auto font-mono">
                    {JSON.stringify(ex.trigger_payload, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

interface Execution {
  id: string;
  status: string;
  trigger_payload: any;
  started_at: string;
  completed_at: string | null;
}

async function getExecutions(workflowId: string): Promise<Execution[]> {
  const res = await fetch(
    `http://localhost:8080/api/v1/workflows/${workflowId}/executions`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  return res.json();
}

export default async function WorkflowDetail({
  params,
}: {
  params: { id: string };
}) {
  const executions = await getExecutions(params.id);

  return (
    <main className="p-10">
      <h1 className="text-6xl mb-12 text-white bg-purple-600 inline-block p-4 retro-border retro-shadow uppercase tracking-widest">
        ForgeFlow_
      </h1>

      <div className="retro-border retro-shadow p-8 bg-black inline-block w-full max-w-5xl">
        <h2 className="text-4xl text-green-400 mb-6"> WORKFLOW_LOGS</h2>
        <p className="text-xl text-gray-400 mb-8">TARGET: {params.id}</p>

        <div className="space-y-6">
          {executions.length === 0 ? (
            <p className="text-2xl text-yellow-400">
              [ WARN ] No executions found. Send a webhook to trigger this
              workflow.
            </p>
          ) : (
            executions.map((ex) => (
              <div
                key={ex.id}
                className="p-4 border-2 border-green-700 bg-gray-900 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center border-b-2 border-green-800 pb-2">
                  <span className="text-2xl text-white">
                    ID: {ex.id.split("-")[0]}...
                  </span>
                  <span
                    className={`text-2xl px-3 py-1 retro-border ${
                      ex.status === "SUCCESS"
                        ? "bg-green-600 text-black"
                        : ex.status === "FAILED"
                          ? "bg-red-600 text-black"
                          : "bg-yellow-500 text-black"
                    }`}
                  >
                    {ex.status}
                  </span>
                </div>

                <p className="text-lg text-gray-400 mt-2">
                  Started: {new Date(ex.started_at).toLocaleString()}
                </p>

                <div className="mt-4">
                  <p className="text-green-400 text-xl mb-1"> PAYLOAD_DATA:</p>
                  <pre className="bg-black p-4 text-green-300 text-lg overflow-x-auto border border-gray-700">
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

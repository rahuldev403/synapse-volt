import CreateWorkflowBtn from "@/components/CreateWorkflowBtn";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

interface Workflow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

async function getWorkflows(token: string | null): Promise<Workflow[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflows`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.error("Failed to fetch workflows");
    return [];
  }
  return res.json();
}

export default async function Home() {
  const { getToken } = auth();
  const token = await getToken();
  const workflows = await getWorkflows(token);

  return (
    <main className="p-10">
      <h1 className="text-6xl mb-12 text-black bg-green-500 inline-block p-4 cyber-shadow font-bold uppercase tracking-widest border border-green-300">
        &gt; FORGEFLOW_ROOT
      </h1>

      <br />

      <div className="cyber-border cyber-shadow p-8 bg-black/80 backdrop-blur-md inline-block w-full max-w-4xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_10px_#00ff00]"></div>
        <h2 className="text-4xl text-purple-500 mb-6 font-bold flex items-center gap-4">
          <span className="w-4 h-4 bg-purple-500 block animate-pulse"></span>
          SYS.WORKFLOWS
        </h2>

        <div className="space-y-6 mb-10">
          {workflows.length === 0 ? (
            <p className="text-2xl text-red-500 animate-pulse">
              [ ERR ] NO WORKFLOWS ALLOCATED.
            </p>
          ) : (
            workflows.map((wf) => (
              <Link
                href={`/workflow/${wf.id}`}
                key={wf.id}
                className="block group"
              >
                <div className="p-6 terminal-window hover:bg-green-900/30 transition-colors cursor-pointer group-hover:cyber-border relative">
                  <div className="absolute top-2 right-4 text-green-700 text-sm opacity-50 font-mono">STATUS: {wf.is_active ? "ONLINE" : "STANDBY"}</div>
                  <h3 className="text-3xl text-green-400 group-hover:text-green-300 uppercase font-bold tracking-wider">
                    {wf.name}
                  </h3>
                  <p className="text-xl text-green-600 mt-2">
                    &gt; {wf.description}
                  </p>
                  <div className="mt-4 pt-2 border-t border-green-800/50 flex justify-between">
                    <p className="text-sm text-gray-500 font-mono">UUID: {wf.id}</p>
                    <p className="text-sm text-purple-400 animate-pulse group-hover:text-purple-300">ACCESS PORT _&gt;</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        <CreateWorkflowBtn />
      </div>
    </main>
  );
}

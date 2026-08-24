import Link from "next/link";
interface Workflow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

async function getWorkflows(): Promise<Workflow[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/workflows`, {
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("Failed to fetch workflows");
    return [];
  }
  return res.json();
}

export default async function Home() {
  const workflows = await getWorkflows();

  return (
    <main className="p-10">
      <h1 className="text-6xl mb-12 text-white bg-purple-600 inline-block p-4 retro-border retro-shadow uppercase tracking-widest">
        ForgeFlow_
      </h1>

      <br />

      <div className="retro-border retro-shadow p-8 bg-black inline-block w-full max-w-4xl">
        <h2 className="text-4xl text-green-400 mb-6"> SYSTEM_WORKFLOWS</h2>

        <div className="space-y-6 mb-10">
          {workflows.length === 0 ? (
            <p className="text-2xl text-red-400">
              [ ERR ] No workflows found in database.
            </p>
          ) : (
            workflows.map((wf) => (
              <Link
                href={`/workflow/${wf.id}`}
                key={wf.id}
                className="block group"
              >
                <div className="p-4 border-2 border-green-500 bg-gray-900 group-hover:bg-green-900 transition-colors cursor-pointer retro-shadow">
                  <h3 className="text-3xl text-white uppercase">{wf.name}</h3>
                  <p className="text-xl text-green-300 mt-2">
                    {" "}
                    {wf.description}
                  </p>
                  <p className="text-lg text-gray-400 mt-2">ID: {wf.id}</p>
                </div>
              </Link>
            ))
          )}
        </div>

        <button className="bg-green-500 text-black px-8 py-3 text-3xl font-bold retro-border retro-shadow retro-btn-active hover:bg-green-400 transition-colors cursor-pointer">
          [ + NEW WORKFLOW ]
        </button>
      </div>
    </main>
  );
}

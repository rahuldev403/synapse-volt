import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import {
  Activity,
  ArrowUpRight,
  Clock,
  Network,
  Zap,
  Cpu,
  Layers,
  Radio,
  Plus,
} from "lucide-react";
import Link from "next/link";
import LandingHero from "@/components/LandingHero";
import CreateWorkflowDialog from "@/components/CreateWorkflowDialog";

interface Workflow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

async function getWorkflows(token: string | null): Promise<Workflow[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const res = await fetch(`${apiUrl}/api/v1/workflows`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

export default async function Home() {
  const { getToken, userId } = await auth();

  if (!userId) {
    return <LandingHero />;
  }

  const token = await getToken();
  const workflows = await getWorkflows(token);

  return (
    <main className="min-h-screen bg-black flex flex-col text-neutral-100 selection:bg-yellow-400 selection:text-black relative">
      {/* Background ambient yellow lighting and pixel grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-yellow-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[300px] bg-amber-500/8 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-dot-pattern opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]" />
        <div className="absolute inset-0 bg-pixel-grid opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      {/* Top Navigation Bar */}
      <header className="border-b border-white/[0.08] bg-black/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-yellow-400 p-[1px] shadow-[0_0_20px_rgba(250,204,21,0.4)]">
              <div className="w-full h-full bg-black rounded-[11px] flex items-center justify-center">
                <Network size={18} className="text-yellow-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight">
                ForgeFlow
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 tracking-wider">
                WORKSPACE // v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <CreateWorkflowDialog />
            <div className="h-4 w-px bg-white/10" />
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox:
                    "w-8 h-8 ring-2 ring-yellow-400/30 hover:ring-yellow-400 transition",
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 py-10 flex-1 flex flex-col gap-10">
        {/* Bento Box Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Bento Card 1: Active Pipelines */}
          <div className="group relative rounded-2xl bg-[#0a0a0a]/90 hover:bg-[#0e0e0e] border border-white/[0.08] hover:border-yellow-400/40 p-6 transition-all duration-300 shadow-xl overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between text-neutral-400 mb-4">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                // ACTIVE PIPELINES
              </span>
              <div className="p-2 rounded-xl bg-yellow-400/15 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
                <Activity size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-white tracking-tight font-mono">
                {workflows.length}
              </span>
              <span className="text-[10px] font-mono font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded">
                [DAG::ONLINE]
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-2 font-normal">
              Autonomous execution graphs wired to webhook triggers.
            </p>
          </div>

          {/* Bento Card 2: Worker Pool */}
          <div className="group relative rounded-2xl bg-[#0a0a0a]/90 hover:bg-[#0e0e0e] border border-white/[0.08] hover:border-yellow-400/40 p-6 transition-all duration-300 shadow-xl overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between text-neutral-400 mb-4">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                // GO WORKER POOL
              </span>
              <div className="p-2 rounded-xl bg-yellow-400/15 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
                <Zap size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-extrabold text-white tracking-tight font-mono">
                3 Workers
              </span>
              <span className="text-[10px] font-mono font-bold text-white bg-white/10 border border-white/20 px-2 py-0.5 rounded">
                [CHANNELS]
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/10 text-neutral-300">
                W-01: IDLE
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/10 text-neutral-300">
                W-02: IDLE
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/10 text-neutral-300">
                W-03: IDLE
              </span>
            </div>
          </div>

          {/* Bento Card 3: Engine Status (Pulsing Yellow Radar) */}
          <div className="group relative rounded-2xl bg-[#0a0a0a]/90 hover:bg-[#0e0e0e] border border-white/[0.08] hover:border-yellow-400/40 p-6 transition-all duration-300 shadow-xl overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between text-neutral-400 mb-4">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                // ENGINE TELEMETRY
              </span>
              <div className="p-2 rounded-xl bg-yellow-400/15 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
                <Radio size={16} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Radar Pulsing Yellow Rings */}
              <div className="relative flex items-center justify-center w-8 h-8">
                <span className="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-yellow-400 opacity-60" />
                <span className="animate-pulse absolute inline-flex h-5 w-5 rounded-full bg-yellow-500/50" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]" />
              </div>
              <div>
                <span className="text-base font-bold text-white tracking-tight block">
                  Listening & Ready
                </span>
                <span className="text-[11px] font-mono text-yellow-400">
                  Sub-ms Dispatch Channel
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-400 mt-2 font-normal">
              PostgreSQL event queue online.
            </p>
          </div>
        </section>

        {/* Workflows Catalog Section */}
        <section className="flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white tracking-tight font-mono">
                WORKFLOWS & PIPELINES
              </h2>
              <span className="text-xs font-mono bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 px-2.5 py-0.5 rounded-full">
                {workflows.length} total
              </span>
            </div>
            <CreateWorkflowDialog />
          </div>

          {workflows.length === 0 ? (
            <div className="rounded-2xl border border-yellow-400/20 border-dashed bg-white/[0.01] p-16 text-center flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="p-4 rounded-2xl bg-yellow-400/10 text-yellow-400 mb-4 border border-yellow-400/30 shadow-[0_0_30px_rgba(250,204,21,0.15)]">
                <Network size={36} />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5 font-mono">
                No active workflows found
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
                Build your first graph to connect triggers, AI agents, and
                custom backend tools with sub-second Go execution.
              </p>
              <CreateWorkflowDialog />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {workflows.map((wf) => (
                <Link
                  key={wf.id}
                  href={`/workflow/${wf.id}`}
                  className="group relative flex flex-col justify-between rounded-2xl bg-[#0a0a0a]/90 hover:bg-[#0f0f0f] border border-white/[0.08] hover:border-yellow-400/50 p-6 transition-all duration-300 shadow-xl hover:shadow-[0_0_35px_rgba(250,204,21,0.12)] min-h-[190px] overflow-hidden backdrop-blur-md"
                >
                  {/* Top Ambient Yellow Line */}
                  <div className="absolute -top-px left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent group-hover:via-yellow-400 transition-all duration-300" />

                  <div>
                    <div className="flex justify-between items-start mb-2.5">
                      <h3 className="font-semibold text-white text-base group-hover:text-yellow-400 transition flex items-center gap-1.5 tracking-tight">
                        {wf.name}
                        <ArrowUpRight
                          size={15}
                          className="opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition duration-200 text-yellow-400"
                        />
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed font-normal">
                      {wf.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-6 border-t border-white/[0.06] flex justify-between items-center text-xs">
                    <span className="font-mono text-[11px] bg-white/[0.03] border border-white/10 text-neutral-400 px-2.5 py-1 rounded-lg">
                      [ID: {wf.id.slice(0, 8)}]
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-mono font-medium bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 shadow-[0_0_10px_rgba(250,204,21,0.15)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                      ACTIVE
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

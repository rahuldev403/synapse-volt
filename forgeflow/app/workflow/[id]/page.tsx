import WorkflowCanvas from "@/components/WorkflowCanvas";
import ExecutionPanel from "@/components/ExecutionPanel";
import { UserButton, SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, GitBranch, Zap, Radio } from "lucide-react";
import Link from "next/link";

export default async function WorkflowDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const workflowId = resolvedParams.id;
  const { userId } = await auth();

  return (
    <main className="flex flex-col h-screen bg-black text-neutral-100 overflow-hidden select-none selection:bg-yellow-400 selection:text-black">
      {/* Top Navigation Bar */}
      <header className="flex justify-between items-center px-6 py-3 border-b border-white/[0.08] bg-[#060606]/90 backdrop-blur-2xl z-30">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-neutral-400 hover:text-white transition flex items-center gap-2 text-xs font-mono px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05]"
          >
            <ArrowLeft size={14} />
            <span>[ Dashboard ]</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-yellow-400/15 text-yellow-400 border border-yellow-400/30">
              <GitBranch size={15} />
            </div>
            <h1 className="text-xs font-bold tracking-tight text-white uppercase font-mono">
              Pipeline Graph
            </h1>
            <span className="bg-white/[0.04] border border-white/10 text-neutral-400 text-[11px] px-2.5 py-0.5 rounded-md font-mono">
              {workflowId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            3 Workers Online
          </div>

          <div className="h-4 w-px bg-white/10" />

          {!userId ? (
            <SignInButton mode="modal">
              <button className="bg-yellow-400 hover:bg-yellow-300 text-black px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer">
                Sign In
              </button>
            </SignInButton>
          ) : (
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox:
                    "w-7 h-7 ring-2 ring-yellow-400/30 hover:ring-yellow-400 transition",
                },
              }}
            />
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex p-3 gap-3 overflow-hidden bg-black">
        {/* Canvas Workspace */}
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl overflow-hidden border border-white/[0.08] relative shadow-2xl">
          <WorkflowCanvas workflowId={workflowId} />
        </div>

        {/* Live Execution Inspector Drawer */}
        <div className="w-[400px] flex-shrink-0 flex flex-col min-h-0">
          <ExecutionPanel workflowId={workflowId} />
        </div>
      </div>
    </main>
  );
}

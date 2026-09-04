"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import {
  ArrowRight,
  Bot,
  GitBranch,
  Globe,
  ListTree,
  RefreshCw,
  Webhook,
  Workflow,
} from "lucide-react";

/**
 * The old landing page promised "sub-ms dispatch" and "microsecond scheduling" for
 * a three-goroutine worker pool. Overclaiming is a liability in a portfolio piece —
 * an interviewer who reads the code will notice. This describes what it does.
 */
export default function LandingHero() {
  return (
    <div className="flex min-h-screen flex-col bg-[#05070b]">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#05070b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-1.5 text-amber-400">
              <Workflow size={15} />
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-100">
              Forge<span className="text-amber-400">Flow</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <SignInButton mode="modal">
              <button className="rounded-lg px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.05] hover:text-white">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300">
                Get started
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 py-20">
        <span className="mb-5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-medium text-amber-300">
          Go · Next.js · PostgreSQL
        </span>

        <h1 className="max-w-3xl text-center text-4xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-5xl">
          Wire up a workflow.
          <br />
          Watch every step run.
        </h1>

        <p className="mt-5 max-w-xl text-center text-sm leading-relaxed text-slate-400">
          Drag nodes onto a canvas and connect them into a graph. A webhook starts
          the run; each node reads what the ones before it produced. Every step is
          recorded, so when something breaks you can see exactly which node failed
          and what it received.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <SignUpButton mode="modal">
            <button className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300">
              Start building
              <ArrowRight size={15} />
            </button>
          </SignUpButton>
          <a
            href="#how"
            className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05]"
          >
            How it works
          </a>
        </div>

        {/* A concrete example beats an abstract diagram. */}
        <div className="mt-16 w-full max-w-2xl rounded-xl border border-white/[0.07] bg-[#0a0c12] p-6">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            A refund triage workflow
          </p>
          <ol className="space-y-2.5">
            {[
              {
                icon: Webhook,
                accent: "text-amber-300 bg-amber-400/10 border-amber-400/25",
                title: "Webhook trigger",
                detail: "A support ticket arrives as JSON",
              },
              {
                icon: GitBranch,
                accent:
                  "text-emerald-300 bg-emerald-400/10 border-emerald-400/25",
                title: "Condition",
                detail: "{{trigger.amount}} is under $500 — continue",
              },
              {
                icon: Bot,
                accent: "text-violet-300 bg-violet-400/10 border-violet-400/25",
                title: "AI agent",
                detail: "Reads the ticket, decides to call refund_customer",
              },
              {
                icon: Globe,
                accent: "text-sky-300 bg-sky-400/10 border-sky-400/25",
                title: "HTTP request",
                detail: "Posts the outcome to your billing service",
              },
            ].map((step, i) => (
              <li key={step.title} className="flex items-center gap-3">
                <span className="w-4 text-right font-mono text-[10px] text-slate-600">
                  {i + 1}
                </span>
                <span className={`rounded-md border p-1.5 ${step.accent}`}>
                  <step.icon size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-slate-200">
                    {step.title}
                  </span>
                  <span className="block font-mono text-[10px] text-slate-500">
                    {step.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <section id="how" className="mt-24 w-full scroll-mt-20">
          <h2 className="mb-8 text-center text-lg font-semibold tracking-tight text-slate-100">
            What happens when a run starts
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Feature
              icon={ListTree}
              title="The graph decides the order"
              body="A topological sort resolves which nodes can run once their dependencies are done, and refuses to start a graph containing a cycle."
            />
            <Feature
              icon={RefreshCw}
              title="Retries are per node"
              body="A flaky HTTP call is retried on its own with backoff. Steps that already succeeded replay from stored output, so a retry cannot issue the same refund twice."
            />
            <Feature
              icon={ListTree}
              title="Every step is recorded"
              body="Each node writes its input, output, attempt count and error as it runs, so the timeline shows what actually happened rather than one final status."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-6 py-6">
        <p className="mx-auto max-w-6xl text-center text-[11px] text-slate-600">
          ForgeFlow — Go worker pool, PostgreSQL job queue, React Flow canvas.
        </p>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0a0c12] p-5">
      <span className="mb-3 inline-flex rounded-lg border border-amber-400/25 bg-amber-400/10 p-2 text-amber-400">
        <Icon size={16} />
      </span>
      <h3 className="mb-1.5 text-sm font-medium text-slate-100">{title}</h3>
      <p className="text-[11px] leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

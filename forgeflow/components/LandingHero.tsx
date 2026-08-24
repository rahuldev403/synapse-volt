"use client";

import { motion } from "framer-motion";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import {
  ArrowRight,
  Bot,
  Cpu,
  Network,
  ShieldCheck,
  Zap,
  Terminal,
  Activity,
  GitBranch,
  Radio,
  Layers,
} from "lucide-react";

export default function LandingHero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: "easeOut" as const },
    },
  };

  return (
    <div className="min-h-screen flex flex-col bg-black overflow-hidden text-neutral-100 relative selection:bg-yellow-400 selection:text-black">
      {/* Background Animated Glowing Yellow & Amber Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 40, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-yellow-500/15 via-amber-400/10 to-transparent blur-[140px]"
        />
        <motion.div
          animate={{
            scale: [1.1, 0.9, 1.1],
            x: [0, -50, 0],
            y: [0, 40, 0],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[30%] right-[15%] w-[550px] h-[550px] rounded-full bg-gradient-to-br from-yellow-400/10 via-white/5 to-transparent blur-[150px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            x: [0, 30, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-[5%] left-[30%] w-[500px] h-[500px] rounded-full bg-gradient-to-r from-amber-500/10 via-yellow-600/10 to-transparent blur-[160px]"
        />

        {/* Pixel dot pattern background */}
        <div className="absolute inset-0 bg-dot-pattern opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]" />
        <div className="absolute inset-0 bg-pixel-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      {/* Top Navigation */}
      <header className="relative z-20 border-b border-white/[0.08] bg-black/60 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-yellow-400 p-[1px] shadow-[0_0_24px_rgba(250,204,21,0.4)]">
              <div className="w-full h-full bg-black rounded-[11px] flex items-center justify-center">
                <Network size={18} className="text-yellow-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight font-mono">
                Synapse<span className="text-yellow-400">Volt</span>
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 tracking-wider">
                ORCHESTRATOR // v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SignInButton mode="modal">
              <button className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white px-4 py-2 rounded-lg transition hover:bg-white/[0.05] cursor-pointer">
                [ Sign In ]
              </button>
            </SignInButton>

            <SignInButton mode="modal">
              <button className="relative group overflow-hidden rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black px-4 py-2 font-mono font-bold text-xs shadow-[0_0_20px_rgba(250,204,21,0.35)] transition cursor-pointer">
                Launch App →
              </button>
            </SignInButton>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-24 max-w-6xl mx-auto text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center max-w-4xl"
        >
          {/* Status Badge */}
          <motion.div variants={itemVariants}>
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/[0.04] backdrop-blur-md text-neutral-200 text-xs font-mono shadow-[0_0_25px_rgba(250,204,21,0.15)] mb-8 hover:border-yellow-400/50 transition cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400" />
              </span>
              <span className="text-white font-medium text-[11px] tracking-tight">
                Deterministic Agentic AI Orchestration
              </span>
              <span className="text-neutral-600">::</span>
              <span className="text-yellow-400 flex items-center gap-1 font-semibold text-[11px]">
                <Zap size={12} /> Go Worker Pool Active
              </span>
            </div>
          </motion.div>

          {/* Staggered Text Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.08] mb-6"
          >
            Autonomous AI Pipelines{" "}
            <span className="inline-block bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(250,204,21,0.45)]">
              Powered by Go Concurrency
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-neutral-300 text-base sm:text-lg md:text-xl max-w-2xl mb-10 leading-relaxed font-normal"
          >
            Design visual pipelines, route webhook payloads through
            function-calling LLMs, and execute background jobs with
            sub-millisecond Go concurrency.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-4 mb-16"
          >
            <SignUpButton mode="modal">
              <motion.button
                whileHover={{
                  scale: 1.04,
                  boxShadow: "0 0 35px rgba(250, 204, 21, 0.6)",
                }}
                whileTap={{ scale: 0.98 }}
                className="relative group flex items-center gap-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-mono font-bold text-sm px-8 py-3.5 rounded-xl shadow-[0_0_30px_rgba(250,204,21,0.35)] transition cursor-pointer"
              >
                <Zap size={16} fill="black" />
                <span>Get Started for Free</span>
                <ArrowRight
                  size={15}
                  className="group-hover:translate-x-1 transition duration-200"
                />
              </motion.button>
            </SignUpButton>

            <a
              href="#features"
              className="flex items-center gap-2 bg-white/[0.03] hover:bg-white/[0.08] text-white border border-white/15 hover:border-yellow-400/50 font-mono text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl backdrop-blur-md transition duration-200"
            >
              <Terminal size={14} className="text-yellow-400" />
              <span>Explore Architecture</span>
            </a>
          </motion.div>
        </motion.div>

        {/* Floating Mock Canvas Graphic (Dark & Yellow Pixel Tech) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45, ease: "easeOut" }}
          className="w-full max-w-4xl relative mt-4 mb-20"
        >
          {/* Glowing yellow aura beneath mockup */}
          <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/20 via-amber-500/15 to-yellow-400/20 rounded-3xl blur-2xl opacity-60 pointer-events-none" />

          <div className="relative rounded-2xl border border-yellow-400/30 bg-[#080808]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden p-6 sm:p-8">
            {/* Canvas Header Bar */}
            <div className="flex items-center justify-between pb-6 border-b border-white/[0.08] mb-8">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
                <span className="text-xs font-mono text-neutral-300 ml-2 flex items-center gap-1.5">
                  <GitBranch size={13} className="text-yellow-400" />
                  graph_orchestration_dag.v1
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  3 Workers Online
                </span>
              </div>
            </div>

            {/* Mock AI Nodes Flow (Static Cards) */}
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Node 1: Webhook Ingress */}
              <div className="relative rounded-xl bg-[#0d0d0d] border border-white/20 hover:border-yellow-400/60 p-4 shadow-[0_0_25px_rgba(250,204,21,0.1)] text-left transition">
                <div className="absolute -top-px left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-yellow-400/15 text-yellow-400">
                      <Zap size={14} />
                    </div>
                    <span className="text-xs font-bold text-white">
                      Webhook Ingress
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-yellow-400 px-1.5 py-0.5 rounded bg-yellow-400/10 border border-yellow-400/30">
                    TRIGGER
                  </span>
                </div>
                <p className="text-[11px] font-mono text-neutral-400 truncate">
                  POST /api/v1/webhooks/9a8f...
                </p>
                <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-neutral-500">
                  <span>status: 202 ACCEPTED</span>
                  <span className="text-yellow-400 font-bold">0.4ms</span>
                </div>
              </div>

              {/* Node 2: AI Agent */}
              <div className="relative rounded-xl bg-[#0d0d0d] border border-yellow-400/50 p-4 shadow-[0_0_25px_rgba(250,204,21,0.2)] text-left">
                <div className="absolute -top-px left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-yellow-400/20 text-yellow-400">
                      <Bot size={14} />
                    </div>
                    <span className="text-xs font-bold text-white">
                      AI Agent Node
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-black px-1.5 py-0.5 rounded bg-yellow-400">
                    LLM TOOLS
                  </span>
                </div>
                <p className="text-[11px] font-mono text-neutral-300 truncate">
                  refund_customer(amount: 50)
                </p>
                <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>tool: local_refund</span>
                  <span className="text-yellow-400 font-bold">180ms</span>
                </div>
              </div>

              {/* Node 3: Execution Output */}
              <div className="relative rounded-xl bg-[#0d0d0d] border border-white/20 hover:border-yellow-400/60 p-4 shadow-[0_0_25px_rgba(250,204,21,0.1)] text-left transition">
                <div className="absolute -top-px left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-white/10 text-white">
                      <Activity size={14} />
                    </div>
                    <span className="text-xs font-bold text-white">
                      Go Worker Output
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-white px-1.5 py-0.5 rounded bg-white/10 border border-white/20">
                    SUCCESS
                  </span>
                </div>
                <p className="text-[11px] font-mono text-neutral-400 truncate">
                  Execution completed in 1.2s
                </p>
                <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-neutral-500">
                  <span>retries: 0/3</span>
                  <span className="text-yellow-400 font-bold">SUCCESS</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <section id="features" className="w-full max-w-5xl">
          <div className="text-center mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-yellow-400 mb-2 block font-semibold">
              // ARCHITECTURE SPECIFICATION
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Engineered for Deterministic Speed & Reliability
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Feature 1 */}
            <div className="group relative rounded-2xl bg-[#0a0a0a] hover:bg-[#0e0e0e] border border-white/[0.08] hover:border-yellow-400/50 p-6 transition duration-300 backdrop-blur-sm shadow-lg hover:shadow-[0_0_30px_rgba(250,204,21,0.12)]">
              <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 w-fit mb-4 group-hover:scale-105 transition duration-300">
                <Cpu size={20} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2 tracking-tight">
                High-Throughput Go Workers
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-normal">
                Non-blocking buffered channels dispatch concurrent executions
                across a worker pool with microsecond scheduling.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative rounded-2xl bg-[#0a0a0a] hover:bg-[#0e0e0e] border border-white/[0.08] hover:border-yellow-400/50 p-6 transition duration-300 backdrop-blur-sm shadow-lg hover:shadow-[0_0_30px_rgba(250,204,21,0.12)]">
              <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 w-fit mb-4 group-hover:scale-105 transition duration-300">
                <Bot size={20} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2 tracking-tight">
                Deterministic AI Tool Calling
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-normal">
                Inspect raw inbound payloads with LLM function calling to
                reliably extract intent and invoke local backend handlers.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative rounded-2xl bg-[#0a0a0a] hover:bg-[#0e0e0e] border border-white/[0.08] hover:border-yellow-400/50 p-6 transition duration-300 backdrop-blur-sm shadow-lg hover:shadow-[0_0_30px_rgba(250,204,21,0.12)]">
              <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 w-fit mb-4 group-hover:scale-105 transition duration-300">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2 tracking-tight">
                Exponential Backoff Retries
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-normal">
                Built-in resilient retry routines protect against upstream
                rate-limiting with dead-letter queue isolation.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-black/80 py-8 px-6 text-center text-xs text-neutral-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-neutral-300">
              SynapseVolt Core — All Go worker pools online
            </span>
          </div>
          <span>Next.js 15 • Go Concurrency • PostgreSQL • React Flow</span>
        </div>
      </footer>
    </div>
  );
}

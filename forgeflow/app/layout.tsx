import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SynapseVolt — Autonomous AI Pipeline Orchestrator",
  description:
    "High-throughput DAG workflow engine with Go concurrency and deterministic AI agent tool calling.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/"
    >
      <html lang="en" className="dark scroll-smooth">
        <body
          className={`${inter.className} bg-black text-neutral-100 min-h-screen antialiased selection:bg-yellow-400 selection:text-black`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

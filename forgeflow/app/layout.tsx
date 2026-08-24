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
  title: "ForgeFlow — Autonomous AI Workflow Engine",
  description:
    "Enterprise orchestration engine with Go concurrency and deterministic AI agent tools.",
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
          className={`${inter.className} bg-black text-neutral-100 min-h-screen antialiased selection:bg-blue-500/25 selection:text-white`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

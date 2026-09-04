import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ForgeFlow — Visual workflow automation",
  description:
    "Build a graph of webhooks, HTTP calls and AI agents, then watch every step of a run execute on a Go worker pool.",
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
      {/* Next 16 only applies the smooth-scroll override when this attribute is
          present; the scroll-smooth class alone is no longer enough. */}
      <html lang="en" className="dark" data-scroll-behavior="smooth">
        <body
          className={`${inter.className} min-h-screen bg-[#05070b] text-slate-200 antialiased`}
        >
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

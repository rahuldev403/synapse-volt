import type { Metadata } from "next";
import { VT323 } from "next/font/google";
import "./globals.css";

const vt323 = VT323({ weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ForgeFlow | 8-Bit Engine",
  description: "AI Workflow Automation Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${vt323.className} bg-gray-900 text-green-400 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}

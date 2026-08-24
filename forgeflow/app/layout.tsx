import type { Metadata } from "next";
import { Fira_Code } from "next/font/google";
import "./globals.css";
import { ClerkProvider, UserButton } from "@clerk/nextjs";

const firaCode = Fira_Code({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ForgeFlow | CYBER_ENGINE",
  description: "AI Workflow Automation Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${firaCode.className} bg-black text-green-500 min-h-screen grid-bg relative overflow-x-hidden`}
        >
          <div className="scanlines"></div>
          <div className="relative z-10 max-w-7xl mx-auto p-4 flex justify-end">
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-12 h-12 cyber-border" } }} />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto">
            {children}
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}

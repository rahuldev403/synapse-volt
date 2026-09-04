import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ArrowLeft, Workflow } from "lucide-react";

/**
 * One header for the whole app. v1 duplicated this markup across the dashboard and
 * the builder, and the dashboard copy had a large block of unrelated text pasted
 * into the middle of the logo.
 */
export default function AppHeader({
  breadcrumb,
  actions,
}: {
  breadcrumb?: { label: string; sub?: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-[#05070b]/90 px-5 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        {breadcrumb ? (
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-100"
          >
            <ArrowLeft size={13} />
            Workflows
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2">
            <span className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-1.5 text-amber-400">
              <Workflow size={15} />
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-100">
              Forge<span className="text-amber-400">Flow</span>
            </span>
          </Link>
        )}

        {breadcrumb && (
          <>
            <span className="text-slate-700">/</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">
                {breadcrumb.label}
              </p>
              {breadcrumb.sub && (
                <p className="truncate text-[10px] text-slate-500">
                  {breadcrumb.sub}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {actions}
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: "w-7 h-7 ring-1 ring-white/15",
            },
          }}
        />
      </div>
    </header>
  );
}

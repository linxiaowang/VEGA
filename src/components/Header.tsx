"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { SearchDialog } from "./SearchDialog";

export function Header() {
  const pathname = usePathname();
  const onChart = pathname.startsWith("/chart");

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 py-2 sm:h-14 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/" className="group flex shrink-0 items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-[var(--bg)] shadow-[0_0_24px_color-mix(in_oklab,var(--accent)_35%,transparent)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                <path
                  d="M4 16l4-5 3 3 5-7 4 5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-[var(--text)] sm:text-lg">
              VEGA
            </span>
          </Link>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            <Link
              href="/"
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                !onChart
                  ? "bg-[var(--panel-2)] text-[var(--text)]"
                  : "text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              行情
            </Link>
            <Link
              href="/chart/crypto/BTCUSDT"
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                onChart
                  ? "bg-[var(--panel-2)] text-[var(--text)]"
                  : "text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              图表
            </Link>
          </nav>
        </div>

        <div className="w-full min-w-0 sm:ml-auto sm:max-w-md">
          <SearchDialog />
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { SearchDialog } from "./SearchDialog";

export function Header() {
  const pathname = usePathname();
  const onChart = pathname.startsWith("/chart");

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5 shrink-0">
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
          <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[var(--text)]">
            VEGA
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
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
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              onChart
                ? "bg-[var(--panel-2)] text-[var(--text)]"
                : "text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            图表
          </Link>
        </nav>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3 sm:max-w-md">
          <SearchDialog />
        </div>
      </div>
    </header>
  );
}

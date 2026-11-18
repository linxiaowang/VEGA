"use client";

import Link from "next/link";
import type { MarketKind, Ticker } from "@/lib/types";
import { cn, formatCompact, formatPercent, formatPrice } from "@/lib/format";

export function TickerTable({
  market,
  tickers,
  loading,
}: {
  market: MarketKind;
  tickers: Ticker[];
  loading?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
      <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-2 border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <span>品种</span>
        <span className="text-right">最新价</span>
        <span className="text-right">涨跌幅</span>
        <span className="hidden text-right sm:block">涨跌额</span>
        <span className="text-right">成交量</span>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {loading &&
          Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse bg-[var(--panel-2)]/40" />
          ))}

        {!loading &&
          tickers.map((ticker, index) => {
            const up = ticker.changePercent >= 0;
            return (
              <Link
                key={ticker.symbol}
                href={`/chart/${ticker.market}/${encodeURIComponent(ticker.symbol)}`}
                className="grid grid-cols-[1.2fr_1fr_1fr_1fr] items-center gap-2 px-4 py-3 transition hover:bg-[var(--panel-2)] sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]"
                style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
              >
                <span className="min-w-0">
                  <span className="block font-[family-name:var(--font-mono)] text-sm text-[var(--text)]">
                    {ticker.symbol}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {ticker.name}
                  </span>
                </span>
                <span className="text-right font-[family-name:var(--font-mono)] text-sm text-[var(--text)]">
                  {formatPrice(ticker.price, market)}
                </span>
                <span
                  className={cn(
                    "text-right font-[family-name:var(--font-mono)] text-sm",
                    up ? "text-[var(--up)]" : "text-[var(--down)]",
                  )}
                >
                  {formatPercent(ticker.changePercent)}
                </span>
                <span
                  className={cn(
                    "hidden text-right font-[family-name:var(--font-mono)] text-sm sm:block",
                    up ? "text-[var(--up)]" : "text-[var(--down)]",
                  )}
                >
                  {up ? "+" : ""}
                  {formatPrice(ticker.change, market)}
                </span>
                <span className="text-right font-[family-name:var(--font-mono)] text-sm text-[var(--muted)]">
                  {formatCompact(ticker.quoteVolume ?? ticker.volume ?? 0)}
                </span>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

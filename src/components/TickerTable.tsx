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
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-2 border-b border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] sm:px-4">
        <span>品种</span>
        <span className="text-right">最新价</span>
        <span className="text-right">涨跌幅</span>
        <span className="hidden text-right sm:block">涨跌额</span>
        <span className="hidden text-right sm:block">成交量</span>
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
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 transition active:bg-[var(--panel-2)] hover:bg-[var(--panel-2)] sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] sm:px-4"
                style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-[family-name:var(--font-mono)] text-sm text-[var(--text)]">
                    {ticker.symbol}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {ticker.name}
                  </span>
                </span>
                <span className="text-right font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--text)]">
                  {formatPrice(ticker.price, market)}
                </span>
                <span
                  className={cn(
                    "min-w-[4.5rem] text-right font-[family-name:var(--font-mono)] text-sm tabular-nums",
                    up ? "text-[var(--up)]" : "text-[var(--down)]",
                  )}
                >
                  {formatPercent(ticker.changePercent)}
                </span>
                <span
                  className={cn(
                    "hidden text-right font-[family-name:var(--font-mono)] text-sm tabular-nums sm:block",
                    up ? "text-[var(--up)]" : "text-[var(--down)]",
                  )}
                >
                  {up ? "+" : ""}
                  {formatPrice(ticker.change, market)}
                </span>
                <span className="hidden text-right font-[family-name:var(--font-mono)] text-sm text-[var(--muted)] sm:block">
                  {formatCompact(ticker.quoteVolume ?? ticker.volume ?? 0)}
                </span>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

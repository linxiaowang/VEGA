"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketKind, Ticker } from "@/lib/types";
import { cn, formatPercent, formatPrice } from "@/lib/format";
import { TickerTable } from "./TickerTable";

export function MarketBoard() {
  const [market, setMarket] = useState<MarketKind>("crypto");
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function load() {
      try {
        const res = await fetch(`/api/tickers?market=${market}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "加载失败");
        if (cancelled) return;
        setTickers(data.tickers ?? []);
        setError(null);
        setUpdatedAt(new Date());
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    load();
    timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [market]);

  const leaders = useMemo(() => {
    const sorted = [...tickers].sort(
      (a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent),
    );
    return sorted.slice(0, 4);
  }, [tickers]);

  return (
    <section className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-6 grid gap-5 lg:mb-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-6">
        <div>
          <p className="mb-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] sm:mb-3 sm:text-xs">
            Live Markets
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-5xl">
            VEGA
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)] sm:mt-3 sm:text-base">
            <span className="sm:hidden">币安实时行情，点进图表即可看盘。</span>
            <span className="hidden sm:inline">
              股票与加密货币实时行情，统一接入币安（加密现货 / 美股 TradFi 永续与代币化股票），点进图表即可专业看盘。
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {leaders.map((item) => {
            const up = item.changePercent >= 0;
            return (
              <div
                key={item.symbol}
                className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 sm:rounded-2xl sm:p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-[family-name:var(--font-mono)] text-xs text-[var(--text)] sm:text-sm">
                    {item.symbol}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-[family-name:var(--font-mono)] text-[11px] sm:text-xs",
                      up ? "text-[var(--up)]" : "text-[var(--down)]",
                    )}
                  >
                    {formatPercent(item.changePercent)}
                  </span>
                </div>
                <div className="mt-1.5 font-[family-name:var(--font-mono)] text-lg tabular-nums text-[var(--text)] sm:mt-2 sm:text-xl">
                  {formatPrice(item.price, item.market)}
                </div>
                <div className="mt-1 truncate text-[11px] text-[var(--muted)] sm:text-xs">
                  {item.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="inline-flex w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1 sm:w-auto">
          {(
            [
              ["crypto", "加密货币"],
              ["stock", "美股"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMarket(value)}
              className={cn(
                "flex-1 rounded-lg px-4 py-2.5 text-sm transition sm:flex-none sm:py-2",
                market === value
                  ? "bg-[var(--panel-2)] text-[var(--text)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)] sm:text-xs">
          {updatedAt
            ? `更新于 ${updatedAt.toLocaleTimeString("zh-CN", { hour12: false })}`
            : "加载中…"}
          {market === "crypto" ? " · Binance" : " · Binance TradFi"}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-[color-mix(in_oklab,var(--down)_40%,var(--border))] bg-[color-mix(in_oklab,var(--down)_10%,var(--panel))] px-4 py-3 text-sm text-[var(--down)]">
          {error}
        </div>
      )}

      <TickerTable market={market} tickers={tickers} loading={loading && !tickers.length} />
    </section>
  );
}

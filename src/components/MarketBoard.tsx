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
    <section className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="mb-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
            Live Markets
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--text)] sm:text-5xl">
            VEGA
          </h1>
          <p className="mt-3 max-w-xl text-[var(--muted)]">
            股票与加密货币实时行情，统一接入币安（加密现货 / 美股 TradFi 永续与代币化股票），点进图表即可专业看盘。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {leaders.map((item) => {
            const up = item.changePercent >= 0;
            return (
              <div
                key={item.symbol}
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-[family-name:var(--font-mono)] text-sm text-[var(--text)]">
                    {item.symbol}
                  </span>
                  <span
                    className={cn(
                      "font-[family-name:var(--font-mono)] text-xs",
                      up ? "text-[var(--up)]" : "text-[var(--down)]",
                    )}
                  >
                    {formatPercent(item.changePercent)}
                  </span>
                </div>
                <div className="mt-2 font-[family-name:var(--font-mono)] text-xl text-[var(--text)]">
                  {formatPrice(item.price, item.market)}
                </div>
                <div className="mt-1 truncate text-xs text-[var(--muted)]">{item.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1">
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
                "rounded-lg px-4 py-2 text-sm transition",
                market === value
                  ? "bg-[var(--panel-2)] text-[var(--text)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
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

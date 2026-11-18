"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Candle, MarketKind, Quote, Ticker, Timeframe } from "@/lib/types";
import { cn, formatCompact, formatPercent, formatPrice, formatSigned } from "@/lib/format";

const PriceChart = dynamic(
  () => import("./PriceChart").then((mod) => mod.PriceChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];
const INDICATORS = [
  { key: "ma20", label: "MA20" },
  { key: "ma50", label: "MA50" },
  { key: "ema12", label: "EMA12" },
  { key: "volume", label: "成交量" },
] as const;

type IndicatorKey = (typeof INDICATORS)[number]["key"];

export function ChartWorkspace({
  market,
  symbol,
}: {
  market: MarketKind;
  symbol: string;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [watchlist, setWatchlist] = useState<Ticker[]>([]);
  const [indicators, setIndicators] = useState<IndicatorKey[]>([
    "ma20",
    "volume",
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadQuoteAndList() {
      try {
        const [quoteRes, listRes] = await Promise.all([
          fetch(`/api/quote?market=${market}&symbol=${encodeURIComponent(symbol)}`),
          fetch(`/api/tickers?market=${market}`),
        ]);
        const quoteData = await quoteRes.json();
        const listData = await listRes.json();
        if (!quoteRes.ok) throw new Error(quoteData.error ?? "报价加载失败");
        if (cancelled) return;
        setQuote(quoteData.quote);
        setWatchlist((listData.tickers ?? []).slice(0, 16));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "报价加载失败");
        }
      }
    }

    loadQuoteAndList();
    const timer = window.setInterval(loadQuoteAndList, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [market, symbol]);

  useEffect(() => {
    let cancelled = false;

    async function loadCandles() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/klines?market=${market}&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "K线加载失败");
        if (cancelled) return;
        setCandles(data.candles ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "K线加载失败");
          setCandles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCandles();
    return () => {
      cancelled = true;
    };
  }, [market, symbol, timeframe]);

  const up = (quote?.changePercent ?? 0) >= 0;

  const stats = useMemo(
    () => [
      { label: "开盘参考", value: formatPrice(quote?.previousClose ?? quote?.open ?? 0, market) },
      { label: "最高", value: formatPrice(quote?.high24h ?? 0, market) },
      { label: "最低", value: formatPrice(quote?.low24h ?? 0, market) },
      {
        label: "成交量",
        value: formatCompact(quote?.quoteVolume ?? quote?.volume ?? 0),
      },
    ],
    [quote, market],
  );

  function toggleIndicator(key: IndicatorKey) {
    setIndicators((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-[1600px] grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
      <aside className="border-b border-[var(--border)] bg-[var(--panel)] lg:border-b-0 lg:border-r">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Watchlist
          </p>
          <div className="mt-2 inline-flex rounded-lg border border-[var(--border)] p-0.5">
            <Link
              href="/chart/crypto/BTCUSDT"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs",
                market === "crypto"
                  ? "bg-[var(--panel-2)] text-[var(--text)]"
                  : "text-[var(--muted)]",
              )}
            >
              加密
            </Link>
            <Link
              href="/chart/stock/AAPL"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs",
                market === "stock"
                  ? "bg-[var(--panel-2)] text-[var(--text)]"
                  : "text-[var(--muted)]",
              )}
            >
              美股
            </Link>
          </div>
        </div>
        <div className="max-h-[280px] overflow-auto lg:max-h-[calc(100vh-8rem)]">
          {watchlist.map((item) => {
            const itemUp = item.changePercent >= 0;
            const active = item.symbol === symbol;
            return (
              <Link
                key={item.symbol}
                href={`/chart/${item.market}/${encodeURIComponent(item.symbol)}`}
                className={cn(
                  "flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5 transition",
                  active ? "bg-[var(--panel-2)]" : "hover:bg-[var(--panel-2)]/70",
                )}
              >
                <span>
                  <span className="block font-[family-name:var(--font-mono)] text-sm text-[var(--text)]">
                    {item.symbol}
                  </span>
                  <span className="block max-w-[110px] truncate text-[11px] text-[var(--muted)]">
                    {item.name}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-[family-name:var(--font-mono)] text-xs text-[var(--text)]">
                    {formatPrice(item.price, item.market)}
                  </span>
                  <span
                    className={cn(
                      "block font-[family-name:var(--font-mono)] text-[11px]",
                      itemUp ? "text-[var(--up)]" : "text-[var(--down)]",
                    )}
                  >
                    {formatPercent(item.changePercent)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col bg-[var(--bg)]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--text)]">
                {symbol}
              </h1>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase",
                  market === "crypto"
                    ? "bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-[var(--accent)]"
                    : "bg-[color-mix(in_oklab,var(--info)_16%,transparent)] text-[var(--info)]",
                )}
              >
                {market}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{quote?.name ?? "—"}</p>
          </div>
          <div className="text-right">
            <div className="font-[family-name:var(--font-mono)] text-3xl text-[var(--text)]">
              {formatPrice(quote?.price ?? 0, market)}
            </div>
            <div
              className={cn(
                "mt-1 font-[family-name:var(--font-mono)] text-sm",
                up ? "text-[var(--up)]" : "text-[var(--down)]",
              )}
            >
              {formatSigned(quote?.change ?? 0, market)} ({formatPercent(quote?.changePercent ?? 0)})
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap gap-1">
            {TIMEFRAMES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTimeframe(item)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs transition",
                  timeframe === item
                    ? "bg-[var(--accent)] text-[var(--bg)]"
                    : "bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--text)]",
                )}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mx-1 hidden h-5 w-px bg-[var(--border)] sm:block" />
          <div className="flex flex-wrap gap-1">
            {INDICATORS.map((item) => {
              const active = indicators.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleIndicator(item.key)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition",
                    active
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative min-h-[460px] flex-1 p-2 sm:p-3">
          {error && (
            <div className="absolute inset-x-4 top-4 z-10 rounded-xl border border-[color-mix(in_oklab,var(--down)_40%,var(--border))] bg-[color-mix(in_oklab,var(--down)_12%,var(--panel))] px-4 py-3 text-sm text-[var(--down)]">
              {error}
            </div>
          )}
          {loading && !candles.length ? (
            <ChartSkeleton />
          ) : (
            <PriceChart candles={candles} indicators={indicators} />
          )}
        </div>
      </section>

      <aside className="border-t border-[var(--border)] bg-[var(--panel)] lg:border-l lg:border-t-0">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Details
          </p>
        </div>
        <div className="space-y-3 p-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)]/50 px-3 py-2.5"
            >
              <span className="text-xs text-[var(--muted)]">{item.label}</span>
              <span className="font-[family-name:var(--font-mono)] text-sm text-[var(--text)]">
                {item.value}
              </span>
            </div>
          ))}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-xs leading-relaxed text-[var(--muted)]">
            数据来源：币安公开行情
            {market === "crypto"
              ? "（USDT 永续/现货）"
              : "（美股 TradFi 永续优先，回退代币化股票 *BUSDT）"}
            。图表基于 TradingView Lightweight Charts。
          </div>
        </div>
      </aside>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel)]/40">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        <p className="text-sm text-[var(--muted)]">加载 K 线…</p>
      </div>
    </div>
  );
}

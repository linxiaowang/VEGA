"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { subscribeBinanceLive } from "@/lib/binance-ws";
import { analyzeSignals } from "@/lib/signals";
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
  const [dataVersion, setDataVersion] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [watchlist, setWatchlist] = useState<Ticker[]>([]);
  const [indicators, setIndicators] = useState<IndicatorKey[]>([
    "ma20",
    "volume",
  ]);
  const [showSignals, setShowSignals] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<
    "connecting" | "live" | "reconnecting" | "error" | "idle"
  >("idle");

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
    const timer = window.setInterval(loadQuoteAndList, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [market, symbol]);

  useEffect(() => {
    let cancelled = false;

    async function loadCandles() {
      setLoading(true);
      setLiveStatus("idle");
      try {
        const res = await fetch(
          `/api/klines?market=${market}&symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "K线加载失败");
        if (cancelled) return;
        setCandles(data.candles ?? []);
        setDataVersion((version) => version + 1);
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

  // 币安 WebSocket：实时刷新当前 K 线 + 最新价
  useEffect(() => {
    if (loading) return;

    const unsubscribe = subscribeBinanceLive({
      market,
      symbol,
      timeframe,
      onStatus: setLiveStatus,
      onTicker: (price) => {
        setQuote((prev) => {
          if (!prev) return prev;
          const previousClose = prev.previousClose ?? prev.price;
          const change = price - previousClose;
          const changePercent = previousClose ? (change / previousClose) * 100 : 0;
          return { ...prev, price, change, changePercent };
        });
        setWatchlist((prev) =>
          prev.map((item) => {
            if (item.symbol !== symbol) return item;
            const previousClose = item.previousClose ?? item.price - item.change;
            const change = price - previousClose;
            const changePercent = previousClose ? (change / previousClose) * 100 : 0;
            return { ...item, price, change, changePercent };
          }),
        );
      },
      onKline: ({ candle }) => {
        setCandles((prev) => {
          if (!prev.length) return [candle];
          const last = prev[prev.length - 1];
          if (candle.time > last.time) return [...prev, candle];
          if (candle.time === last.time) return [...prev.slice(0, -1), candle];
          return prev;
        });
      },
    });

    return unsubscribe;
  }, [market, symbol, timeframe, loading]);

  const up = (quote?.changePercent ?? 0) >= 0;

  const analysis = useMemo(() => analyzeSignals(candles), [candles]);

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
    <div className="mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-[1600px] grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
      {/* 移动端：图表优先；桌面：左 Watchlist */}
      <aside className="order-3 border-t border-[var(--border)] bg-[var(--panel)] lg:order-1 lg:border-r lg:border-t-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-3 sm:px-4">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Watchlist
          </p>
          <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
            <Link
              href="/chart/crypto/BTCUSDT"
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs sm:py-1",
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
                "rounded-md px-2.5 py-1.5 text-xs sm:py-1",
                market === "stock"
                  ? "bg-[var(--panel-2)] text-[var(--text)]"
                  : "text-[var(--muted)]",
              )}
            >
              美股
            </Link>
          </div>
        </div>

        {/* 手机：横向滑动；桌面：纵向列表 */}
        <div className="flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:max-h-[calc(100vh-8rem)] lg:space-y-0 lg:overflow-auto lg:px-0 lg:py-0">
          {watchlist.map((item) => {
            const itemUp = item.changePercent >= 0;
            const active = item.symbol === symbol;
            return (
              <Link
                key={item.symbol}
                href={`/chart/${item.market}/${encodeURIComponent(item.symbol)}`}
                className={cn(
                  "flex min-w-[9.5rem] shrink-0 flex-col justify-between rounded-xl border px-3 py-2.5 transition lg:min-w-0 lg:flex-row lg:items-center lg:rounded-none lg:border-0 lg:border-b lg:border-[var(--border)] lg:px-4",
                  active
                    ? "border-[var(--accent)] bg-[var(--panel-2)]"
                    : "border-[var(--border)] bg-[var(--bg)] lg:bg-transparent lg:hover:bg-[var(--panel-2)]/70",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-[family-name:var(--font-mono)] text-sm text-[var(--text)]">
                    {item.symbol}
                  </span>
                  <span className="block max-w-[110px] truncate text-[11px] text-[var(--muted)]">
                    {item.name}
                  </span>
                </span>
                <span className="mt-2 text-left lg:mt-0 lg:text-right">
                  <span className="block font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--text)]">
                    {formatPrice(item.price, item.market)}
                  </span>
                  <span
                    className={cn(
                      "block font-[family-name:var(--font-mono)] text-[11px] tabular-nums",
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

      <section className="order-1 flex min-w-0 flex-col bg-[var(--bg)] lg:order-2">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-3 py-3 sm:items-end sm:gap-4 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
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
              <LiveBadge status={liveStatus} />
            </div>
            <p className="mt-1 truncate text-sm text-[var(--muted)]">{quote?.name ?? "—"}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-[family-name:var(--font-mono)] text-2xl tabular-nums text-[var(--text)] sm:text-3xl">
              {formatPrice(quote?.price ?? 0, market)}
            </div>
            <div
              className={cn(
                "mt-1 font-[family-name:var(--font-mono)] text-xs tabular-nums sm:text-sm",
                up ? "text-[var(--up)]" : "text-[var(--down)]",
              )}
            >
              {formatSigned(quote?.change ?? 0, market)} ({formatPercent(quote?.changePercent ?? 0)})
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--border)] px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {TIMEFRAMES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTimeframe(item)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs transition sm:px-2.5 sm:py-1",
                  timeframe === item
                    ? "bg-[var(--accent)] text-[var(--bg)]"
                    : "bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--text)]",
                )}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="-mx-3 mt-1 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:mt-2 sm:flex-wrap sm:overflow-visible sm:px-0">
            {INDICATORS.map((item) => {
              const active = indicators.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleIndicator(item.key)}
                  className={cn(
                    "shrink-0 rounded-md border px-3 py-1.5 text-xs transition sm:px-2.5 sm:py-1",
                    active
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowSignals((prev) => !prev)}
              className={cn(
                "shrink-0 rounded-md border px-3 py-1.5 text-xs transition sm:px-2.5 sm:py-1",
                showSignals
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              技术信号
            </button>
          </div>
        </div>

        <div className="relative min-h-[52vh] flex-1 p-1 sm:min-h-[460px] sm:p-3">
          {error && (
            <div className="absolute inset-x-3 top-3 z-10 rounded-xl border border-[color-mix(in_oklab,var(--down)_40%,var(--border))] bg-[color-mix(in_oklab,var(--down)_12%,var(--panel))] px-3 py-2.5 text-sm text-[var(--down)] sm:inset-x-4 sm:top-4 sm:px-4 sm:py-3">
              {error}
            </div>
          )}
          {loading && !candles.length ? (
            <ChartSkeleton />
          ) : (
            <PriceChart
              candles={candles}
              indicators={indicators}
              dataVersion={dataVersion}
              analysis={analysis}
              showSignals={showSignals}
            />
          )}
        </div>
      </section>

      <aside className="order-2 border-t border-[var(--border)] bg-[var(--panel)] lg:order-3 lg:border-l lg:border-t-0">
        <div className="border-b border-[var(--border)] px-3 py-3 sm:px-4">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Details
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-1 sm:gap-3 sm:p-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--panel-2)]/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <span className="text-[11px] text-[var(--muted)] sm:text-xs">{item.label}</span>
              <span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--text)]">
                {item.value}
              </span>
            </div>
          ))}

          <div className="col-span-2 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--panel-2)]/50 p-3 sm:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                走势解读
              </p>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase",
                  analysis.bias === "bullish"
                    ? "bg-[color-mix(in_oklab,var(--up)_16%,transparent)] text-[var(--up)]"
                    : analysis.bias === "bearish"
                      ? "bg-[color-mix(in_oklab,var(--down)_16%,transparent)] text-[var(--down)]"
                      : "bg-[var(--bg)] text-[var(--muted)]",
                )}
              >
                {analysis.bias === "bullish"
                  ? "偏多"
                  : analysis.bias === "bearish"
                    ? "偏空"
                    : "中性"}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text)] sm:text-xs">
              {analysis.summary}
            </p>
            {analysis.levels.length > 0 && (
              <div className="space-y-1.5 border-t border-[var(--border)] pt-2">
                {analysis.levels.map((level) => (
                  <div
                    key={`${level.kind}-${level.price}`}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span
                      className={cn(
                        level.kind === "support" ? "text-[var(--up)]" : "text-[var(--down)]",
                      )}
                    >
                      {level.kind === "support" ? "支撑" : "阻力"}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--text)]">
                      {formatPrice(level.price, market)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {analysis.signals.length > 0 && (
              <div className="space-y-1.5 border-t border-[var(--border)] pt-2">
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">最近信号</p>
                {analysis.signals.slice(-3).reverse().map((signal) => (
                  <div key={`${signal.kind}-${signal.time}`} className="text-[11px]">
                    <span
                      className={cn(
                        "font-[family-name:var(--font-mono)]",
                        signal.kind === "short" ? "text-[var(--down)]" : "text-[var(--up)]",
                      )}
                    >
                      {signal.label}
                    </span>
                    <span className="ml-1.5 text-[var(--muted)]">{signal.note}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="border-t border-[var(--border)] pt-2 text-[10px] leading-relaxed text-[var(--muted)]">
              教学向规则信号，非投资建议。关注：站稳阻力→趋势延续；跌破支撑→警惕下探。
            </p>
          </div>

          <div className="col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-[11px] leading-relaxed text-[var(--muted)] sm:col-span-1 sm:text-xs">
            数据来源：币安公开行情
            {market === "crypto"
              ? "（USDT 永续/现货）"
              : "（美股 TradFi 永续优先，回退代币化股票 *BUSDT）"}
            。K 线通过 WebSocket 实时推送。图表基于 TradingView Lightweight Charts。
          </div>
        </div>
      </aside>
    </div>
  );
}

function LiveBadge({
  status,
}: {
  status: "connecting" | "live" | "reconnecting" | "error" | "idle";
}) {
  const label =
    status === "live"
      ? "LIVE"
      : status === "connecting"
        ? "连接中"
        : status === "reconnecting"
          ? "重连中"
          : status === "error"
            ? "断线"
            : "待机";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide",
        status === "live"
          ? "bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] text-[var(--accent)]"
          : status === "error"
            ? "bg-[color-mix(in_oklab,var(--down)_16%,transparent)] text-[var(--down)]"
            : "bg-[var(--panel-2)] text-[var(--muted)]",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "live"
            ? "animate-pulse bg-[var(--accent)]"
            : status === "error"
              ? "bg-[var(--down)]"
              : "bg-[var(--muted)]",
        )}
      />
      {label}
    </span>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-full min-h-[52vh] items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel)]/40 sm:min-h-[420px]">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        <p className="text-sm text-[var(--muted)]">加载 K 线…</p>
      </div>
    </div>
  );
}

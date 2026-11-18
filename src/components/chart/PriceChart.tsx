"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { ema, sma } from "@/lib/indicators";

type IndicatorKey = "ma20" | "ma50" | "ema12" | "volume";

function applyIndicators(
  candles: Candle[],
  indicators: IndicatorKey[],
  refs: {
    volume: ISeriesApi<"Histogram"> | null;
    ma20: ISeriesApi<"Line"> | null;
    ma50: ISeriesApi<"Line"> | null;
    ema12: ISeriesApi<"Line"> | null;
  },
) {
  if (indicators.includes("volume") && refs.volume) {
    refs.volume.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color:
          c.close >= c.open
            ? "rgba(46, 230, 166, 0.45)"
            : "rgba(255, 77, 109, 0.45)",
      })),
    );
  } else {
    refs.volume?.setData([]);
  }

  if (indicators.includes("ma20") && refs.ma20) {
    refs.ma20.setData(sma(candles, 20) as never);
  } else {
    refs.ma20?.setData([]);
  }

  if (indicators.includes("ma50") && refs.ma50) {
    refs.ma50.setData(sma(candles, 50) as never);
  } else {
    refs.ma50?.setData([]);
  }

  if (indicators.includes("ema12") && refs.ema12) {
    refs.ema12.setData(ema(candles, 12) as never);
  } else {
    refs.ema12?.setData([]);
  }
}

export function PriceChart({
  candles,
  indicators,
  dataVersion,
}: {
  candles: Candle[];
  indicators: IndicatorKey[];
  /** REST 全量刷新时递增；实时 tick 不递增，走 update */
  dataVersion: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema12Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const lastVersionRef = useRef<number>(-1);
  const lastLiveTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8B9BB0",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "rgba(36, 48, 65, 0.55)" },
        horzLines: { color: "rgba(36, 48, 65, 0.55)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(46, 230, 166, 0.35)", labelBackgroundColor: "#151D27" },
        horzLine: { color: "rgba(46, 230, 166, 0.35)", labelBackgroundColor: "#151D27" },
      },
      rightPriceScale: {
        borderColor: "#243041",
      },
      timeScale: {
        borderColor: "#243041",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlesSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#2EE6A6",
      downColor: "#FF4D6D",
      borderUpColor: "#2EE6A6",
      borderDownColor: "#FF4D6D",
      wickUpColor: "#2EE6A6",
      wickDownColor: "#FF4D6D",
    });

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1,
    );
    chart.panes()[1]?.setHeight(100);

    const ma20 = chart.addSeries(LineSeries, {
      color: "#F5C542",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ma50 = chart.addSeries(LineSeries, {
      color: "#5B8CFF",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ema12 = chart.addSeries(LineSeries, {
      color: "#C084FC",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candlesSeries;
    volumeSeriesRef.current = volumeSeries;
    ma20Ref.current = ma20;
    ma50Ref.current = ma50;
    ema12Ref.current = ema12;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ma20Ref.current = null;
      ma50Ref.current = null;
      ema12Ref.current = null;
    };
  }, []);

  // REST 全量数据
  useEffect(() => {
    if (!candleSeriesRef.current || dataVersion === lastVersionRef.current) return;
    lastVersionRef.current = dataVersion;
    lastLiveTimeRef.current = candles.at(-1)?.time ?? null;

    candleSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    applyIndicators(candles, indicators, {
      volume: volumeSeriesRef.current,
      ma20: ma20Ref.current,
      ma50: ma50Ref.current,
      ema12: ema12Ref.current,
    });

    chartRef.current?.timeScale().fitContent();
  }, [candles, dataVersion, indicators]);

  // 实时最后一根 / 指标开关变化时的增量刷新
  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;
    if (dataVersion !== lastVersionRef.current) return;

    const last = candles[candles.length - 1];
    candleSeriesRef.current.update({
      time: last.time as UTCTimestamp,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    });

    applyIndicators(candles, indicators, {
      volume: volumeSeriesRef.current,
      ma20: ma20Ref.current,
      ma50: ma50Ref.current,
      ema12: ema12Ref.current,
    });

    lastLiveTimeRef.current = last.time;
  }, [candles, dataVersion, indicators]);

  return <div ref={containerRef} className="h-full w-full min-h-[52vh] sm:min-h-[420px]" />;
}

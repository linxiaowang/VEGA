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

export function PriceChart({
  candles,
  indicators,
}: {
  candles: Candle[];
  indicators: IndicatorKey[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema12Ref = useRef<ISeriesApi<"Line"> | null>(null);

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

    // v5：成交量放独立 pane，不要自定义 priceScaleId
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

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candleData = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(candleData);

    if (indicators.includes("volume")) {
      volumeSeriesRef.current.setData(
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
      volumeSeriesRef.current.setData([]);
    }

    if (indicators.includes("ma20") && ma20Ref.current) {
      ma20Ref.current.setData(sma(candles, 20) as never);
    } else {
      ma20Ref.current?.setData([]);
    }

    if (indicators.includes("ma50") && ma50Ref.current) {
      ma50Ref.current.setData(sma(candles, 50) as never);
    } else {
      ma50Ref.current?.setData([]);
    }

    if (indicators.includes("ema12") && ema12Ref.current) {
      ema12Ref.current.setData(ema(candles, 12) as never);
    } else {
      ema12Ref.current?.setData([]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [candles, indicators]);

  return <div ref={containerRef} className="h-full w-full min-h-[420px]" />;
}

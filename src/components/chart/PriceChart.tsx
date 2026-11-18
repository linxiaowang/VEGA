"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { ema, sma } from "@/lib/indicators";
import type { SignalAnalysis } from "@/lib/signals";

type IndicatorKey = "ma20" | "ma50" | "ema12" | "volume";

const VISIBLE_CANDLES = 120;
const MAX_SIGNAL_MARKERS = 3;

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

function toMarkers(analysis: SignalAnalysis | null): SeriesMarker<UTCTimestamp>[] {
  if (!analysis) return [];
  return analysis.signals.slice(-MAX_SIGNAL_MARKERS).map((signal) => {
    if (signal.kind === "short") {
      return {
        time: signal.time as UTCTimestamp,
        position: "aboveBar",
        shape: "arrowDown",
        color: "#FF4D6D",
        text: "Short",
      };
    }
    return {
      time: signal.time as UTCTimestamp,
      position: "belowBar",
      shape: "arrowUp",
      color: "#2EE6A6",
      text: "Strong Bounce",
    };
  });
}

export function PriceChart({
  candles,
  indicators,
  dataVersion,
  analysis,
  showSignals,
}: {
  candles: Candle[];
  indicators: IndicatorKey[];
  dataVersion: number;
  analysis: SignalAnalysis | null;
  showSignals: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema12Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
  const levelLinesRef = useRef<IPriceLine[]>([]);
  const lastVersionRef = useRef<number>(-1);

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

    markersRef.current = createSeriesMarkers<UTCTimestamp>(
      candlesSeries as ISeriesApi<"Candlestick", UTCTimestamp>,
      [],
    );

    chartRef.current = chart;
    candleSeriesRef.current = candlesSeries;
    volumeSeriesRef.current = volumeSeries;
    ma20Ref.current = ma20;
    ma50Ref.current = ma50;
    ema12Ref.current = ema12;

    return () => {
      for (const line of levelLinesRef.current) {
        candlesSeries.removePriceLine(line);
      }
      levelLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ma20Ref.current = null;
      ma50Ref.current = null;
      ema12Ref.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || dataVersion === lastVersionRef.current) return;
    lastVersionRef.current = dataVersion;

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

    const timeScale = chartRef.current?.timeScale();
    if (timeScale) {
      const from = Math.max(0, candles.length - VISIBLE_CANDLES);
      timeScale.setVisibleLogicalRange({ from, to: candles.length - 1 });
    }
  }, [candles, dataVersion, indicators]);

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
  }, [candles, dataVersion, indicators]);

  // 信号标记 + 支撑阻力线
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series || !markersRef.current) return;

    markersRef.current.setMarkers(showSignals ? toMarkers(analysis) : []);

    for (const line of levelLinesRef.current) {
      series.removePriceLine(line);
    }
    levelLinesRef.current = [];

    if (!showSignals || !analysis) return;

    levelLinesRef.current = analysis.levels.map((level) =>
      series.createPriceLine({
        price: level.price,
        color: level.kind === "support" ? "rgba(46, 230, 166, 0.85)" : "rgba(255, 77, 109, 0.85)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.kind === "support" ? "支撑" : "阻力",
      }),
    );
  }, [analysis, showSignals, dataVersion, candles.length]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-h-[52vh] touch-none sm:min-h-[420px]"
    />
  );
}

import type { Candle } from "./types";

export type SignalKind = "short" | "strong_bounce";

export interface ChartSignal {
  kind: SignalKind;
  time: number;
  price: number;
  label: string;
  note: string;
}

export interface LevelLine {
  price: number;
  kind: "support" | "resistance";
  strength: number;
  label: string;
}

export interface SignalAnalysis {
  signals: ChartSignal[];
  levels: LevelLine[];
  bias: "bullish" | "bearish" | "neutral";
  summary: string;
}

const PIVOT = 3;

function avgVolume(candles: Candle[], end: number, lookback: number) {
  const start = Math.max(0, end - lookback);
  const slice = candles.slice(start, end);
  if (!slice.length) return 0;
  return slice.reduce((sum, item) => sum + item.volume, 0) / slice.length;
}

function isPivotHigh(candles: Candle[], index: number, left = PIVOT, right = PIVOT) {
  if (index < left || index + right >= candles.length) return false;
  const high = candles[index].high;
  for (let i = index - left; i <= index + right; i += 1) {
    if (i === index) continue;
    if (candles[i].high >= high) return false;
  }
  return true;
}

function isPivotLow(candles: Candle[], index: number, left = PIVOT, right = PIVOT) {
  if (index < left || index + right >= candles.length) return false;
  const low = candles[index].low;
  for (let i = index - left; i <= index + right; i += 1) {
    if (i === index) continue;
    if (candles[i].low <= low) return false;
  }
  return true;
}

function bodyRatio(candle: Candle) {
  const range = Math.max(candle.high - candle.low, 1e-12);
  return Math.abs(candle.close - candle.open) / range;
}

function upperWickRatio(candle: Candle) {
  const range = Math.max(candle.high - candle.low, 1e-12);
  const top = Math.max(candle.open, candle.close);
  return (candle.high - top) / range;
}

function lowerWickRatio(candle: Candle) {
  const range = Math.max(candle.high - candle.low, 1e-12);
  const bottom = Math.min(candle.open, candle.close);
  return (bottom - candle.low) / range;
}

function recentTrend(candles: Candle[], index: number, lookback = 8) {
  const start = Math.max(0, index - lookback);
  if (start >= index) return 0;
  return candles[index].close - candles[start].close;
}

function clusterLevels(
  points: Array<{ price: number; kind: "support" | "resistance" }>,
  tolerance: number,
) {
  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters: LevelLine[] = [];

  for (const point of sorted) {
    const existing = clusters.find(
      (item) => Math.abs(item.price - point.price) <= tolerance,
    );
    if (existing) {
      existing.price = (existing.price * existing.strength + point.price) / (existing.strength + 1);
      existing.strength += 1;
      if (point.kind === existing.kind) {
        // keep
      } else if (existing.strength <= 2) {
        existing.kind = point.kind;
      }
      continue;
    }
    clusters.push({
      price: point.price,
      kind: point.kind,
      strength: 1,
      label: point.kind === "support" ? "支撑" : "阻力",
    });
  }

  return clusters
    .map((item) => ({
      ...item,
      label: `${item.kind === "support" ? "支撑" : "阻力"} ·×${item.strength}`,
    }))
    .sort((a, b) => b.strength - a.strength || b.price - a.price);
}

/**
 * 规则化技术信号（教学向，非投资建议）：
 * - Short：局部高点 + 冲高回落/阴线，且处于阶段性上行后
 * - Strong Bounce：局部低点 + 放量阳线/长下影，且处于阶段性下行后
 * 支撑/阻力：近端摆动高低点聚类
 */
export function analyzeSignals(candles: Candle[]): SignalAnalysis {
  if (candles.length < PIVOT * 2 + 5) {
    return {
      signals: [],
      levels: [],
      bias: "neutral",
      summary: "K 线数量不足，暂无法判断信号与关键位。",
    };
  }

  const signals: ChartSignal[] = [];
  const rawLevels: Array<{ price: number; kind: "support" | "resistance" }> = [];

  // 不在最新未确认的右端打标，避免实时跳动乱闪
  const end = candles.length - PIVOT - 1;

  for (let i = PIVOT; i <= end; i += 1) {
    const candle = candles[i];
    const trend = recentTrend(candles, i);
    const volAvg = avgVolume(candles, i, 20);
    const volSpike = volAvg > 0 ? candle.volume / volAvg : 1;

    if (isPivotHigh(candles, i)) {
      rawLevels.push({ price: candle.high, kind: "resistance" });
      const rejection = upperWickRatio(candle) >= 0.35 || candle.close < candle.open;
      if (trend > 0 && rejection && bodyRatio(candle) >= 0.2) {
        signals.push({
          kind: "short",
          time: candle.time,
          price: candle.high,
          label: "Short",
          note: "冲高回落，短线压力增大，关注能否跌破近端支撑。",
        });
      }
    }

    if (isPivotLow(candles, i)) {
      rawLevels.push({ price: candle.low, kind: "support" });
      const bounce =
        (candle.close > candle.open && volSpike >= 1.4) ||
        (lowerWickRatio(candle) >= 0.4 && candle.close >= candle.open);
      if (trend < 0 && bounce) {
        signals.push({
          kind: "strong_bounce",
          time: candle.time,
          price: candle.low,
          label: "Strong Bounce",
          note: "低位放量/长下影止跌，短线或有反弹，回踩支撑需观察是否守住。",
        });
      }
    }
  }

  // 同一区域只保留更有代表性的信号，避免过密
  const filtered: ChartSignal[] = [];
  for (const signal of signals) {
    const prev = filtered[filtered.length - 1];
    if (prev && signal.kind === prev.kind && signal.time - prev.time < 6 * 3600) {
      continue;
    }
    filtered.push(signal);
  }

  const last = candles[candles.length - 1];
  const span = Math.max(last.high * 0.0025, (last.high - last.low) * 0.8);
  const levels: LevelLine[] = clusterLevels(rawLevels.slice(-24), span)
    .slice(0, 4)
    .map((level) => {
      // 按现价重新标注支撑/阻力语义
      const kind: LevelLine["kind"] =
        level.price >= last.close ? "resistance" : "support";
      return {
        ...level,
        kind,
        label: `${kind === "support" ? "支撑" : "阻力"} ${level.price.toPrecision(6)}`,
      };
    })
    .sort((a, b) => a.price - b.price);

  const nearestSupport = [...levels].reverse().find((item) => item.kind === "support");
  const nearestResistance = levels.find((item) => item.kind === "resistance");
  const lastSignal = filtered[filtered.length - 1];

  let bias: SignalAnalysis["bias"] = "neutral";
  if (lastSignal?.kind === "strong_bounce") bias = "bullish";
  if (lastSignal?.kind === "short") bias = "bearish";

  const parts = [
    lastSignal
      ? `最近信号：${lastSignal.label}（${lastSignal.note}）`
      : "暂无明显信号，先看支撑/阻力与均线方向。",
    nearestSupport
      ? `下方关注支撑约 ${nearestSupport.price.toFixed(4)}。`
      : "",
    nearestResistance
      ? `上方关注阻力约 ${nearestResistance.price.toFixed(4)}。`
      : "",
    "有效突破阻力且站稳，趋势更易延续；跌破支撑则警惕继续下探。",
  ].filter(Boolean);

  return {
    signals: filtered.slice(-12),
    levels,
    bias,
    summary: parts.join(" "),
  };
}

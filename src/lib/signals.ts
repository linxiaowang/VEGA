import type { Candle, Timeframe } from "./types";

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

const EMA_FAST = 20;
const EMA_SLOW = 50;
const ATR_PERIOD = 14;
const ADX_PERIOD = 14;
const SLOPE_BARS = 5;
const ADX_TREND_MIN = 20;
const DEDUPE_BARS = 6;

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,
};

type TrendDirection = "bullish" | "bearish" | "neutral";

interface TrendState {
  direction: TrendDirection;
  adx: number;
  emaAligned: boolean | null;
  structure: number;
}

function emaSeries(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let previous: number | null = null;

  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < period) continue;
    if (previous === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += values[j];
      previous = sum / period;
    } else {
      previous = (values[i] - previous) * multiplier + previous;
    }
    out[i] = previous;
  }

  return out;
}

function trueRanges(candles: Candle[]) {
  return candles.map((candle, i) => {
    if (i === 0) return candle.high - candle.low;
    const prevClose = candles[i - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose),
    );
  });
}

function atrSeries(candles: Candle[], period: number): Array<number | null> {
  const out: Array<number | null> = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  const tr = trueRanges(candles);
  let sum = 0;
  for (let i = 1; i <= period; i += 1) sum += tr[i];
  let atr = sum / period;
  out[period] = atr;

  for (let i = period + 1; i < candles.length; i += 1) {
    atr = (atr * (period - 1) + tr[i]) / period;
    out[i] = atr;
  }
  return out;
}

function adxSeries(candles: Candle[], period: number) {
  const length = candles.length;
  const adx: Array<number | null> = new Array(length).fill(null);
  const plusDI: Array<number | null> = new Array(length).fill(null);
  const minusDI: Array<number | null> = new Array(length).fill(null);

  if (length <= period * 2) return { adx, plusDI, minusDI };

  const tr = trueRanges(candles);
  const plusDM: number[] = new Array(length).fill(0);
  const minusDM: number[] = new Array(length).fill(0);

  for (let i = 1; i < length; i += 1) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  let trSum = 0;
  let plusSum = 0;
  let minusSum = 0;
  for (let i = 1; i <= period; i += 1) {
    trSum += tr[i];
    plusSum += plusDM[i];
    minusSum += minusDM[i];
  }

  let dxSum = 0;
  let dxCount = 0;
  let adxValue: number | null = null;

  for (let i = period; i < length; i += 1) {
    if (i > period) {
      trSum = trSum - trSum / period + tr[i];
      plusSum = plusSum - plusSum / period + plusDM[i];
      minusSum = minusSum - minusSum / period + minusDM[i];
    }

    const pdi = trSum > 0 ? (100 * plusSum) / trSum : 0;
    const mdi = trSum > 0 ? (100 * minusSum) / trSum : 0;
    plusDI[i] = pdi;
    minusDI[i] = mdi;

    const sum = pdi + mdi;
    const dx = sum > 0 ? (100 * Math.abs(pdi - mdi)) / sum : 0;

    if (adxValue === null) {
      dxSum += dx;
      dxCount += 1;
      if (dxCount >= period) {
        adxValue = dxSum / dxCount;
        adx[i] = adxValue;
      }
    } else {
      adxValue = (adxValue * (period - 1) + dx) / period;
      adx[i] = adxValue;
    }
  }

  return { adx, plusDI, minusDI };
}

function structureScore(highs: number[], lows: number[]): number {
  if (highs.length < 2 || lows.length < 2) return 0;
  const prevHigh = highs[highs.length - 2];
  const lastHigh = highs[highs.length - 1];
  const prevLow = lows[lows.length - 2];
  const lastLow = lows[lows.length - 1];
  if (lastHigh > prevHigh && lastLow > prevLow) return 1;
  if (lastHigh < prevHigh && lastLow < prevLow) return -1;
  return 0;
}

function evaluateTrend(
  candles: Candle[],
  fast: Array<number | null>,
  slow: Array<number | null>,
  atr: Array<number | null>,
  adx: ReturnType<typeof adxSeries>,
  structure: number,
): TrendState {
  const i = candles.length - 1;
  const fastValue = fast[i];
  const slowValue = slow[i];
  const atrValue = atr[i] ?? 0;

  let score = 0;
  let emaAligned: boolean | null = null;

  if (fastValue != null && slowValue != null) {
    emaAligned = fastValue > slowValue;
    score += emaAligned ? 1 : -1;
  }

  const prevFast = i >= SLOPE_BARS ? fast[i - SLOPE_BARS] : null;
  if (fastValue != null && prevFast != null && atrValue > 0) {
    const normalized = (fastValue - prevFast) / (atrValue * 0.5);
    score += Math.max(-1, Math.min(1, normalized));
  }

  const pdi = adx.plusDI[i];
  const mdi = adx.minusDI[i];
  if (pdi != null && mdi != null && pdi !== mdi) {
    score += pdi > mdi ? 1 : -1;
  }

  score += structure;

  const adxValue = adx.adx[i] ?? 0;
  // 与均线排列矛盾时提高门槛，避免"EMA 下方却判多"的矛盾输出
  const bullishThreshold = emaAligned === false ? 2.5 : 1.5;
  const bearishThreshold = emaAligned === true ? -2.5 : -1.5;
  const direction: TrendDirection =
    adxValue >= ADX_TREND_MIN && score >= bullishThreshold
      ? "bullish"
      : adxValue >= ADX_TREND_MIN && score <= bearishThreshold
        ? "bearish"
        : "neutral";

  return { direction, adx: adxValue, emaAligned, structure };
}

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

function trendScoreAt(
  index: number,
  fast: Array<number | null>,
  slow: Array<number | null>,
  atr: Array<number | null>,
  candles: Candle[],
) {
  const fastValue = fast[index];
  const slowValue = slow[index];
  if (fastValue != null && slowValue != null) {
    let score = fastValue > slowValue ? 1 : fastValue < slowValue ? -1 : 0;
    const prevFast = index >= SLOPE_BARS ? fast[index - SLOPE_BARS] : null;
    const atrValue = atr[index] ?? 0;
    if (prevFast != null && atrValue > 0) {
      const normalized = (fastValue - prevFast) / (atrValue * 0.5);
      score += Math.max(-1, Math.min(1, normalized));
    }
    return score;
  }
  const start = Math.max(0, index - 8);
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
 * - 趋势：EMA20/50 排列 + EMA20 斜率（按 ATR 归一）+ DI 方向 + 摆动结构，
 *   ADX 不足 20 时判定为震荡
 * - Short：局部高点 + 冲高回落/阴线，且趋势分数偏多后转弱
 * - Strong Bounce：局部低点 + 放量阳线/长下影，且趋势分数偏空后企稳
 * 支撑/阻力：近端摆动高低点聚类
 */
export function analyzeSignals(
  candles: Candle[],
  timeframe: Timeframe = "1h",
): SignalAnalysis {
  if (candles.length < PIVOT * 2 + 5) {
    return {
      signals: [],
      levels: [],
      bias: "neutral",
      summary: "K 线数量不足，暂无法判断信号与关键位。",
    };
  }

  const closes = candles.map((candle) => candle.close);
  const fast = emaSeries(closes, EMA_FAST);
  const slow = emaSeries(closes, EMA_SLOW);
  const atr = atrSeries(candles, ATR_PERIOD);
  const adx = adxSeries(candles, ADX_PERIOD);

  const signals: ChartSignal[] = [];
  const rawLevels: Array<{ price: number; kind: "support" | "resistance" }> = [];
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  // 不在最新未确认的右端打标，避免实时跳动乱闪
  const end = candles.length - PIVOT - 1;

  for (let i = PIVOT; i <= end; i += 1) {
    const candle = candles[i];
    const trend = trendScoreAt(i, fast, slow, atr, candles);
    const volAvg = avgVolume(candles, i, 20);
    const volSpike = volAvg > 0 ? candle.volume / volAvg : 1;

    if (isPivotHigh(candles, i)) {
      rawLevels.push({ price: candle.high, kind: "resistance" });
      swingHighs.push(candle.high);
      const rejection = upperWickRatio(candle) >= 0.35 || candle.close < candle.open;
      if (trend > 0.25 && rejection && bodyRatio(candle) >= 0.2) {
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
      swingLows.push(candle.low);
      const bounce =
        (candle.close > candle.open && volSpike >= 1.4) ||
        (lowerWickRatio(candle) >= 0.4 && candle.close >= candle.open);
      if (trend < -0.25 && bounce) {
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

  // 同一区域只保留更有代表性的信号，时间窗按 K 线周期缩放
  const dedupeWindow = TIMEFRAME_SECONDS[timeframe] * DEDUPE_BARS;
  const filtered: ChartSignal[] = [];
  for (const signal of signals) {
    const prev = filtered[filtered.length - 1];
    if (prev && signal.kind === prev.kind && signal.time - prev.time < dedupeWindow) {
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
  const trend = evaluateTrend(
    candles,
    fast,
    slow,
    atr,
    adx,
    structureScore(swingHighs, swingLows),
  );

  const trendText =
    trend.direction === "bullish"
      ? "趋势偏多"
      : trend.direction === "bearish"
        ? "趋势偏空"
        : "趋势震荡";

  const trendDetail: string[] = [];
  if (trend.adx > 0) trendDetail.push(`ADX ${trend.adx.toFixed(1)}`);
  if (trend.emaAligned !== null) {
    trendDetail.push(trend.emaAligned ? "EMA20 在 EMA50 上方" : "EMA20 在 EMA50 下方");
  }
  if (trend.structure > 0) trendDetail.push("摆动高低点抬升");
  if (trend.structure < 0) trendDetail.push("摆动高低点下移");

  const parts = [
    `${trendText}${trendDetail.length ? `（${trendDetail.join("，")}）` : ""}。`,
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
    bias: trend.direction,
    summary: parts.join(" "),
  };
}

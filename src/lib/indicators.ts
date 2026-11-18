import type { Candle } from "./types";

export function sma(candles: Candle[], period: number) {
  return candles.map((_, index) => {
    if (index + 1 < period) {
      return { time: candles[index].time as number };
    }
    let sum = 0;
    for (let i = index - period + 1; i <= index; i += 1) {
      sum += candles[i].close;
    }
    return {
      time: candles[index].time as number,
      value: sum / period,
    };
  });
}

export function ema(candles: Candle[], period: number) {
  const result: Array<{ time: number; value?: number }> = [];
  const multiplier = 2 / (period + 1);
  let previous: number | null = null;

  for (let i = 0; i < candles.length; i += 1) {
    const close = candles[i].close;
    if (i + 1 < period) {
      result.push({ time: candles[i].time });
      continue;
    }
    if (previous === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += candles[j].close;
      previous = sum / period;
    } else {
      previous = (close - previous) * multiplier + previous;
    }
    result.push({ time: candles[i].time, value: previous });
  }

  return result;
}

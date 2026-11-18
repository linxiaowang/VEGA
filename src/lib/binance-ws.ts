import { resolveStockInstrument } from "./stocks";
import type { Candle, MarketKind, Timeframe } from "./types";

const INTERVAL_MAP: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

export interface LiveKlineEvent {
  candle: Candle;
  closed: boolean;
  symbol: string;
  price: number;
}

function streamCandidates(market: MarketKind, symbol: string) {
  if (market === "crypto") return [symbol.toUpperCase()];
  const instrument = resolveStockInstrument(symbol);
  if (instrument) return [instrument.perpSymbol, instrument.spotSymbol];
  const base = symbol.toUpperCase().replace(/B?USDT$/, "");
  return [`${base}USDT`, `${base}BUSDT`];
}

function buildUrls(streamSymbol: string, interval: string) {
  const key = streamSymbol.toLowerCase();
  const streams = `${key}@kline_${interval}/${key}@miniTicker`;
  return [
    `wss://fstream.binance.com/market/stream?streams=${streams}`,
    `wss://fstream.binance.com/stream?streams=${streams}`,
    `wss://stream.binance.com:9443/stream?streams=${streams}`,
    `wss://data-stream.binance.vision/stream?streams=${streams}`,
  ];
}

function parseCombinedMessage(raw: string): LiveKlineEvent | { price: number; symbol: string } | null {
  try {
    const payload = JSON.parse(raw) as {
      stream?: string;
      data?: Record<string, unknown>;
    } & Record<string, unknown>;

    const data = (payload.data ?? payload) as Record<string, unknown>;
    const event = String(data.e ?? "");

    if (event === "kline" && data.k && typeof data.k === "object") {
      const k = data.k as Record<string, string | number | boolean>;
      return {
        candle: {
          time: Math.floor(Number(k.t) / 1000),
          open: Number(k.o),
          high: Number(k.h),
          low: Number(k.l),
          close: Number(k.c),
          volume: Number(k.v),
        },
        closed: Boolean(k.x),
        symbol: String(data.s ?? k.s ?? ""),
        price: Number(k.c),
      };
    }

    if (event === "24hrMiniTicker" || event === "24hrTicker") {
      return {
        symbol: String(data.s ?? ""),
        price: Number(data.c),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function subscribeBinanceLive(options: {
  market: MarketKind;
  symbol: string;
  timeframe: Timeframe;
  onKline: (event: LiveKlineEvent) => void;
  onTicker?: (price: number, symbol: string) => void;
  onStatus?: (status: "connecting" | "live" | "reconnecting" | "error") => void;
}) {
  const interval = INTERVAL_MAP[options.timeframe];
  const symbols = streamCandidates(options.market, options.symbol);
  let disposed = false;
  let socket: WebSocket | null = null;
  let retryTimer: number | undefined;
  let attempt = 0;
  let symbolIndex = 0;
  let urlIndex = 0;
  let gotMessage = false;

  const connect = () => {
    if (disposed) return;
    options.onStatus?.(attempt === 0 ? "connecting" : "reconnecting");

    const streamSymbol = symbols[symbolIndex % symbols.length];
    const urls = buildUrls(streamSymbol, interval);
    const url = urls[urlIndex % urls.length];

    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    const watchdog = window.setTimeout(() => {
      if (!gotMessage && socket?.readyState === WebSocket.OPEN) {
        socket.close();
      }
    }, 4000);

    socket.onopen = () => {
      // wait for first message before marking live
    };

    socket.onmessage = (event) => {
      gotMessage = true;
      options.onStatus?.("live");
      const parsed = parseCombinedMessage(String(event.data));
      if (!parsed) return;
      if ("candle" in parsed) {
        options.onKline(parsed);
        options.onTicker?.(parsed.price, parsed.symbol);
      } else {
        options.onTicker?.(parsed.price, parsed.symbol);
      }
    };

    socket.onerror = () => {
      options.onStatus?.("error");
    };

    socket.onclose = () => {
      window.clearTimeout(watchdog);
      socket = null;
      if (disposed) return;

      if (!gotMessage) {
        // rotate endpoint / symbol before backoff grows too much
        urlIndex += 1;
        if (urlIndex % buildUrls(streamSymbol, interval).length === 0) {
          symbolIndex += 1;
        }
      }
      gotMessage = false;
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 15000);
    attempt += 1;
    retryTimer = window.setTimeout(connect, delay);
  };

  connect();

  return () => {
    disposed = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    socket?.close();
  };
}

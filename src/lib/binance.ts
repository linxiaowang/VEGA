import { isStockPairSymbol, resolveStockInstrument, STOCK_INSTRUMENTS } from "./stocks";
import type { Candle, MarketKind, SearchResult, Ticker, Timeframe } from "./types";

/**
 * 币安 U 本位合约公开行情（无需 API Key）
 * 官方文档：https://developers.binance.com/docs/derivatives/usds-margined-futures
 * Base：https://fapi.binance.com
 * 常用：GET /fapi/v1/ticker/24hr | /fapi/v1/klines | /fapi/v1/exchangeInfo
 *
 * 说明：你贴的 Trade REST（下单）需要签名；本站只读 Market Data。
 * 现货 Vision 仅作 fapi 不可达时的回退（含 *BUSDT 代币化股票）。
 */
const BASES = [
  { host: "https://fapi.binance.com", kind: "fapi" as const },
  { host: "https://data-api.binance.vision", kind: "spot" as const },
  { host: "https://api.binance.com", kind: "spot" as const },
];

const INTERVAL_MAP: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

const CRYPTO_FEATURED = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOTUSDT",
  "LTCUSDT",
  "ATOMUSDT",
];

const CRYPTO_NAMES: Record<string, string> = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
  BNBUSDT: "BNB",
  SOLUSDT: "Solana",
  XRPUSDT: "XRP",
  DOGEUSDT: "Dogecoin",
  ADAUSDT: "Cardano",
  AVAXUSDT: "Avalanche",
  LINKUSDT: "Chainlink",
  DOTUSDT: "Polkadot",
  LTCUSDT: "Litecoin",
  ATOMUSDT: "Cosmos",
};

type BinanceKind = "fapi" | "spot";

type BinanceBase = (typeof BASES)[number];

let cachedBase: BinanceBase | null = null;

function toPath(kind: BinanceKind, spotPath: string) {
  if (kind === "fapi") return spotPath.replace("/api/v3/", "/fapi/v1/");
  return spotPath;
}

async function fetchJson(url: string, revalidate = 10, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function orderBases(options?: { prefer?: BinanceKind; kindOnly?: BinanceKind }): BinanceBase[] {
  const pool = options?.kindOnly
    ? BASES.filter((item) => item.kind === options.kindOnly)
    : [...BASES];

  const ordered: BinanceBase[] = [];
  const pushUnique = (item: BinanceBase | null | undefined) => {
    if (item && pool.includes(item) && !ordered.includes(item)) ordered.push(item);
  };

  // 已探活且类型匹配的节点优先
  pushUnique(cachedBase);
  if (options?.prefer) {
    for (const item of pool) {
      if (item.kind === options.prefer) pushUnique(item);
    }
  }
  for (const item of pool) pushUnique(item);
  return ordered;
}

/** 按 base 顺序请求；成功后缓存可用节点 */
async function binanceGet(
  spotPath: string,
  options?: { prefer?: BinanceKind; kindOnly?: BinanceKind; revalidate?: number },
) {
  let lastError: Error | null = null;
  for (const base of orderBases(options)) {
    const url = `${base.host}${toPath(base.kind, spotPath)}`;
    try {
      const data = await fetchJson(url, options?.revalidate ?? 10);
      cachedBase = base;
      return { data, kind: base.kind, host: base.host };
    } catch (error) {
      if (cachedBase?.host === base.host) cachedBase = null;
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("Binance unreachable");
}

/** 美股：合约符号只打 fapi，代币化股票只打现货，两者竞速 */
async function binanceGetStock(
  spotPathForSymbol: (symbol: string) => string,
  instrument: { perpSymbol: string; spotSymbol: string },
  revalidate = 10,
) {
  const attempts = [
    binanceGet(spotPathForSymbol(instrument.perpSymbol), {
      kindOnly: "fapi",
      revalidate,
    }),
    binanceGet(spotPathForSymbol(instrument.spotSymbol), {
      kindOnly: "spot",
      revalidate,
    }),
  ];

  return Promise.any(attempts).catch(async () => {
    const reasons = await Promise.allSettled(attempts);
    const message = reasons
      .map((item) => (item.status === "rejected" ? String(item.reason) : ""))
      .filter(Boolean)
      .join(" | ");
    throw new Error(message || "Binance stock endpoints unreachable");
  });
}

function mapRowToTicker(
  row: Record<string, string>,
  market: MarketKind,
  displaySymbol?: string,
  displayName?: string,
): Ticker {
  return {
    symbol: displaySymbol ?? row.symbol,
    name: displayName ?? displaySymbol ?? row.symbol,
    market,
    price: Number(row.lastPrice),
    changePercent: Number(row.priceChangePercent),
    change: Number(row.priceChange),
    previousClose: Number(row.prevClosePrice),
    high24h: Number(row.highPrice),
    low24h: Number(row.lowPrice),
    volume: Number(row.volume),
    quoteVolume: Number(row.quoteVolume),
  };
}

function mapKlines(rows: Array<Array<string | number>>): Candle[] {
  return rows.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

function isCryptoUsdtSymbol(symbol: string) {
  if (!symbol.endsWith("USDT") || symbol.includes("_")) return false;
  if (isStockPairSymbol(symbol)) return false;
  // 排除代币化股票 *BUSDT（如 AAPLBUSDT），但保留 BNBUSDT/SHIBUSDT 等纯加密
  const stockSpot = STOCK_INSTRUMENTS.some((item) => item.spotSymbol === symbol);
  return !stockSpot;
}

export async function fetchCryptoTickers(): Promise<Ticker[]> {
  const { data } = await binanceGet("/api/v3/ticker/24hr");
  const rows = data as Array<Record<string, string>>;

  const usdt = rows
    .filter((row) => isCryptoUsdtSymbol(row.symbol))
    .map((row) =>
      mapRowToTicker(
        row,
        "crypto",
        row.symbol,
        CRYPTO_NAMES[row.symbol] ?? row.symbol.replace(/USDT$/, ""),
      ),
    )
    .filter((row) => Number.isFinite(row.price) && row.price > 0);

  const featuredSet = new Set(CRYPTO_FEATURED);
  const featured = CRYPTO_FEATURED.map((symbol) =>
    usdt.find((row) => row.symbol === symbol),
  ).filter(Boolean) as Ticker[];

  const rest = usdt
    .filter((row) => !featuredSet.has(row.symbol))
    .sort((a, b) => (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0))
    .slice(0, 40);

  return [...featured, ...rest];
}

export async function fetchStockTickers(): Promise<Ticker[]> {
  const { data } = await binanceGet("/api/v3/ticker/24hr", { revalidate: 15 });
  const rows = data as Array<Record<string, string>>;
  const bySymbol = new Map(rows.map((row) => [row.symbol, row]));

  const tickers: Ticker[] = [];
  for (const item of STOCK_INSTRUMENTS) {
    const row = bySymbol.get(item.perpSymbol) ?? bySymbol.get(item.spotSymbol);
    if (!row) continue;
    tickers.push(mapRowToTicker(row, "stock", item.ticker, item.name));
  }

  if (tickers.length) return tickers;

  // 全市场拉取失败时（极端情况）逐个回退
  for (const item of STOCK_INSTRUMENTS) {
    try {
      tickers.push(await fetchStockQuote(item.ticker));
    } catch {
      // skip unavailable
    }
  }
  return tickers;
}

export async function fetchCryptoKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  const interval = INTERVAL_MAP[timeframe];
  const path = `/api/v3/klines?symbol=${encodeURIComponent(symbol.toUpperCase())}&interval=${interval}&limit=${limit}`;
  const { data } = await binanceGet(path);
  return mapKlines(data as Array<Array<string | number>>);
}

export async function fetchStockKlines(
  tickerOrSymbol: string,
  timeframe: Timeframe,
  limit = 500,
): Promise<Candle[]> {
  const instrument =
    resolveStockInstrument(tickerOrSymbol) ?? {
      ticker: tickerOrSymbol.toUpperCase(),
      name: tickerOrSymbol.toUpperCase(),
      perpSymbol: `${tickerOrSymbol.toUpperCase()}USDT`,
      spotSymbol: `${tickerOrSymbol.toUpperCase()}BUSDT`,
    };
  const interval = INTERVAL_MAP[timeframe];
  const { data } = await binanceGetStock(
    (symbol) =>
      `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    instrument,
  );
  return mapKlines(data as Array<Array<string | number>>);
}

export async function fetchCryptoQuote(symbol: string): Promise<Ticker> {
  const { data } = await binanceGet(
    `/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol.toUpperCase())}`,
  );
  const row = data as Record<string, string>;
  return mapRowToTicker(
    row,
    "crypto",
    row.symbol,
    CRYPTO_NAMES[row.symbol] ?? row.symbol.replace(/USDT$/, ""),
  );
}

export async function fetchStockQuote(tickerOrSymbol: string): Promise<Ticker> {
  const instrument =
    resolveStockInstrument(tickerOrSymbol) ?? {
      ticker: tickerOrSymbol.toUpperCase().replace(/B?USDT$/, ""),
      name: tickerOrSymbol.toUpperCase(),
      perpSymbol: `${tickerOrSymbol.toUpperCase().replace(/B?USDT$/, "")}USDT`,
      spotSymbol: `${tickerOrSymbol.toUpperCase().replace(/B?USDT$/, "")}BUSDT`,
    };

  const { data } = await binanceGetStock(
    (symbol) => `/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
    instrument,
  );

  return mapRowToTicker(
    data as Record<string, string>,
    "stock",
    instrument.ticker,
    instrument.name,
  );
}

export async function searchCrypto(query: string): Promise<SearchResult[]> {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const { data } = await binanceGet("/api/v3/exchangeInfo", { revalidate: 3600 });
  const payload = data as {
    symbols: Array<{ symbol: string; baseAsset?: string; quoteAsset?: string; status?: string }>;
  };

  return payload.symbols
    .filter((item) => {
      const active = !item.status || item.status === "TRADING";
      const quote = item.quoteAsset ?? (item.symbol.endsWith("USDT") ? "USDT" : "");
      return (
        active &&
        quote === "USDT" &&
        isCryptoUsdtSymbol(item.symbol) &&
        (item.symbol.includes(q) || (item.baseAsset ?? "").includes(q))
      );
    })
    .slice(0, 20)
    .map((item) => ({
      symbol: item.symbol,
      name: CRYPTO_NAMES[item.symbol] ?? item.baseAsset ?? item.symbol.replace(/USDT$/, ""),
      market: "crypto" as const,
      exchange: "Binance",
      type: "CRYPTO",
    }));
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  return STOCK_INSTRUMENTS.filter(
    (item) =>
      item.ticker.includes(q) ||
      item.name.toUpperCase().includes(q) ||
      item.perpSymbol.includes(q) ||
      item.spotSymbol.includes(q),
  )
    .slice(0, 20)
    .map((item) => ({
      symbol: item.ticker,
      name: item.name,
      market: "stock" as const,
      exchange: "Binance TradFi",
      type: "STOCK",
    }));
}

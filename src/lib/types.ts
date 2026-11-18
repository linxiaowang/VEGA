export type MarketKind = "crypto" | "stock";

export type Timeframe =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "4h"
  | "1d"
  | "1w";

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  name: string;
  market: MarketKind;
  price: number;
  changePercent: number;
  change: number;
  previousClose?: number;
  high24h?: number;
  low24h?: number;
  volume?: number;
  quoteVolume?: number;
}

export interface Quote extends Ticker {
  open?: number;
  previousClose?: number;
  marketCap?: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  market: MarketKind;
  exchange?: string;
  type?: string;
}

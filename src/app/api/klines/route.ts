import { NextRequest, NextResponse } from "next/server";
import { fetchCryptoKlines, fetchStockKlines } from "@/lib/binance";
import type { MarketKind, Timeframe } from "@/lib/types";

const TIMEFRAMES = new Set(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]);

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const market = (request.nextUrl.searchParams.get("market") ?? "crypto") as MarketKind;
  const timeframe = (request.nextUrl.searchParams.get("timeframe") ?? "1h") as Timeframe;

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }
  if (!TIMEFRAMES.has(timeframe)) {
    return NextResponse.json({ error: "invalid timeframe" }, { status: 400 });
  }

  try {
    const candles =
      market === "stock"
        ? await fetchStockKlines(symbol, timeframe)
        : await fetchCryptoKlines(symbol, timeframe);

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      market,
      timeframe,
      candles,
      source: "binance",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load klines";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { fetchCryptoTickers, fetchStockTickers } from "@/lib/binance";
import type { MarketKind } from "@/lib/types";

export async function GET(request: NextRequest) {
  const market = (request.nextUrl.searchParams.get("market") ?? "crypto") as MarketKind;

  try {
    const tickers =
      market === "stock" ? await fetchStockTickers() : await fetchCryptoTickers();
    return NextResponse.json({ market, tickers, source: "binance" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tickers";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

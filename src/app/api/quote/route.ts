import { NextRequest, NextResponse } from "next/server";
import { fetchCryptoQuote, fetchStockQuote } from "@/lib/binance";
import type { MarketKind } from "@/lib/types";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const market = (request.nextUrl.searchParams.get("market") ?? "crypto") as MarketKind;

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const quote =
      market === "stock" ? await fetchStockQuote(symbol) : await fetchCryptoQuote(symbol);
    return NextResponse.json({ quote, source: "binance" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load quote";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

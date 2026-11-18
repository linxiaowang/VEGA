import { NextRequest, NextResponse } from "next/server";
import { searchCrypto, searchStocks } from "@/lib/binance";
import type { MarketKind } from "@/lib/types";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const market = request.nextUrl.searchParams.get("market") as MarketKind | null;

  if (!q) return NextResponse.json({ results: [] });

  try {
    if (market === "crypto") {
      return NextResponse.json({ results: await searchCrypto(q) });
    }
    if (market === "stock") {
      return NextResponse.json({ results: await searchStocks(q) });
    }

    const [crypto, stocks] = await Promise.all([searchCrypto(q), searchStocks(q)]);
    return NextResponse.json({ results: [...stocks.slice(0, 8), ...crypto.slice(0, 12)] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

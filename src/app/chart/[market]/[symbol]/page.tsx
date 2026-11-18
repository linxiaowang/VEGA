import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChartWorkspace } from "@/components/chart/ChartWorkspace";
import type { MarketKind } from "@/lib/types";

export const instant = false;

export default async function ChartPage({
  params,
}: PageProps<"/chart/[market]/[symbol]">) {
  const { market, symbol } = await params;

  if (market !== "crypto" && market !== "stock") {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="grid min-h-[calc(100vh-3.5rem)] place-items-center text-sm text-[var(--muted)]">
          加载图表…
        </div>
      }
    >
      <ChartWorkspace
        market={market as MarketKind}
        symbol={decodeURIComponent(symbol).toUpperCase()}
      />
    </Suspense>
  );
}

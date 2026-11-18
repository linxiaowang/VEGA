import { Suspense } from "react";
import { MarketBoard } from "@/components/MarketBoard";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[50vh] place-items-center text-sm text-[var(--muted)]">
          加载行情…
        </div>
      }
    >
      <MarketBoard />
    </Suspense>
  );
}

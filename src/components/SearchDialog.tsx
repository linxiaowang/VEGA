"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/types";
import { cn } from "@/lib/format";

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "搜索失败");
        setResults(data.results ?? []);
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "搜索失败");
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open]);

  function go(item: SearchResult) {
    startTransition(() => {
      router.push(`/chart/${item.market}/${encodeURIComponent(item.symbol)}`);
      setOpen(false);
      setQuery("");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left text-sm text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]"
      >
        <SearchIcon />
        <span className="flex-1 truncate">搜索股票 / 加密货币</span>
        <kbd className="hidden rounded border border-[var(--border)] bg-[var(--panel-2)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="搜索品种"
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl shadow-black/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
              <SearchIcon />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入代码或名称，例如 BTC、AAPL、英伟达"
                className="h-12 w-full bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              />
              {pending && <span className="text-xs text-[var(--muted)]">跳转中…</span>}
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {error && (
                <p className="px-3 py-4 text-sm text-[var(--down)]">{error}</p>
              )}
              {!error && !results.length && query.trim() && (
                <p className="px-3 py-4 text-sm text-[var(--muted)]">没有匹配结果</p>
              )}
              {!error && !query.trim() && (
                <p className="px-3 py-4 text-sm text-[var(--muted)]">
                  试试 BTCUSDT、ETH、NVDA、TSLA…
                </p>
              )}
              <ul className="space-y-1">
                {results.map((item) => (
                  <li key={`${item.market}-${item.symbol}`}>
                    <button
                      type="button"
                      onClick={() => go(item)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--panel-2)]"
                    >
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide",
                          item.market === "crypto"
                            ? "bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--accent)]"
                            : "bg-[color-mix(in_oklab,var(--info)_18%,transparent)] text-[var(--info)]",
                        )}
                      >
                        {item.market === "crypto" ? "CRYPTO" : "STOCK"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-[family-name:var(--font-mono)] text-sm text-[var(--text)]">
                          {item.symbol}
                        </span>
                        <span className="block truncate text-xs text-[var(--muted)]">
                          {item.name}
                          {item.exchange ? ` · ${item.exchange}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--muted)]" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.5 16.5L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

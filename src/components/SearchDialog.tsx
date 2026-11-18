"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/types";
import { cn } from "@/lib/format";

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(id);
    };
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

  const dialog =
    open && mounted
      ? createPortal(
          <div
            data-vega-portal="search"
            className="flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-start sm:px-4 sm:pt-[12vh]"
            style={{ position: "fixed", inset: 0, zIndex: 1000 }}
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="搜索品种"
              className="flex h-[100dvh] w-full flex-col overflow-hidden border-[var(--border)] bg-[var(--panel)] sm:h-auto sm:max-h-[min(80vh,36rem)] sm:max-w-xl sm:rounded-2xl sm:border sm:shadow-2xl sm:shadow-black/50"
              style={{ position: "relative", zIndex: 1001 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-4 sm:pt-0">
                <SearchIcon />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="代码或名称，如 btc / AAPL"
                  className="h-12 w-full bg-transparent text-base text-[var(--text)] outline-none placeholder:text-[var(--muted)] sm:text-sm"
                  enterKeyHint="search"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {pending && (
                  <span className="shrink-0 text-xs text-[var(--muted)]">跳转中…</span>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-md px-2 py-1 text-sm text-[var(--muted)] sm:hidden"
                >
                  取消
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                {error && (
                  <p className="px-3 py-4 text-sm text-[var(--down)]">{error}</p>
                )}
                {!error && !results.length && query.trim() && (
                  <p className="px-3 py-4 text-sm text-[var(--muted)]">没有匹配结果</p>
                )}
                {!error && !query.trim() && (
                  <p className="px-3 py-4 text-sm text-[var(--muted)]">
                    试试 btc、ETH、nvda、TSLA…
                  </p>
                )}
                <ul className="space-y-1">
                  {results.map((item) => (
                    <li key={`${item.market}-${item.symbol}`}>
                      <button
                        type="button"
                        onClick={() => go(item)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:bg-[var(--panel-2)] hover:bg-[var(--panel-2)] sm:py-2.5"
                      >
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide",
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-left text-sm text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)] sm:max-w-sm sm:px-3"
      >
        <SearchIcon />
        <span className="min-w-0 flex-1 truncate">
          <span className="sm:hidden">搜索</span>
          <span className="hidden sm:inline">搜索股票 / 加密货币</span>
        </span>
        <kbd className="hidden rounded border border-[var(--border)] bg-[var(--panel-2)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)] sm:inline">
          ⌘K
        </kbd>
      </button>
      {dialog}
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

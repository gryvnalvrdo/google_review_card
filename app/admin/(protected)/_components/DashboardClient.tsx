"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  ExternalLink,
  MousePointerClick,
  Plus,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import type { CardRecord, TapLogEntry } from "../../../../lib/types";
import { formatRupiah, getStoreInitials, timeAgo } from "../../../../lib/format";
import { getPublicGoogleReviewUrl, isInstagramUrl } from "../../../../lib/redirect";
import CardForm from "../../components/CardForm";
import QRScanner from "../../components/QRScanner";

const LS_KEY = "admin_dashboard_last_visited";

export default function DashboardClient() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [tapLogs, setTapLogs] = useState<TapLogEntry[]>([]);
  const [stockCodes, setStockCodes] = useState<string[]>([]);
  const [lastVisitedAt, setLastVisitedAt] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedCode, setSelectedCode] = useState("");
  const [editingCard, setEditingCard] = useState<CardRecord | null>(null);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [previewToast, setPreviewToast] = useState<string | null>(null);

  const activeCardMap = useMemo(() => new Map(cards.map((c) => [c.code, c.storeName])), [cards]);
  const activeCodesSet = useMemo(() => new Set(cards.map((c) => c.code)), [cards]);
  const cardUrlMap = useMemo(
    () =>
      new Map(
        cards.map((c) => [c.code, getPublicGoogleReviewUrl(c.googleReviewUrl || "", c.storeName)])
      ),
    [cards]
  );

  const validTapLogs = useMemo(() => {
    const raw =
      cards.length === 0
        ? tapLogs
        : tapLogs
            .filter((l) => activeCodesSet.has(l.code))
            .map((l) => ({
              ...l,
              storeName: activeCardMap.get(l.code) || l.storeName,
            }));

    return [...raw].sort(
      (a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime()
    );
  }, [tapLogs, cards, activeCodesSet, activeCardMap]);

  const unseenTapCount = useMemo(() => {
    if (!lastVisitedAt) return 0;
    const prevDate = new Date(lastVisitedAt);
    if (Number.isNaN(prevDate.getTime())) return 0;
    return validTapLogs.filter((l) => new Date(l.tappedAt).getTime() > prevDate.getTime()).length;
  }, [validTapLogs, lastVisitedAt]);

  const loadAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    const prevVisit =
      typeof window !== "undefined"
        ? localStorage.getItem("admin_taps_last_seen") || localStorage.getItem(LS_KEY)
        : null;
    setLastVisitedAt(prevVisit);

    try {
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 7);
      const [resCards, resTaps, resStock] = await Promise.all([
        fetch(`/api/admin/codes?_t=${ts}&_r=${rand}`, { cache: "no-store" }),
        fetch(`/api/admin/taps?limit=50&_t=${ts}&_r=${rand}`, { cache: "no-store" }),
        fetch(`/api/admin/stock?_t=${ts}&_r=${rand}`, { cache: "no-store" }),
      ]);

      if (resCards.ok) {
        const d = await resCards.json();
        setCards(d.cards ?? []);
      }
      if (resTaps.ok) {
        const d = await resTaps.json();
        setTapLogs(d.logs ?? []);
      }
      if (resStock.ok) {
        const d = await resStock.json();
        setStockCodes(d.codes ?? []);
      }
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll(false);

    const handleSync = () => loadAll(false);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleSync();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "admin_taps_last_seen" || e.key === LS_KEY) {
        loadAll(false);
      }
    };

    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("storage", handleStorage);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadAll(false);
      }
    }, 45000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadAll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const queryCode = params.get("code");
    if (queryCode) {
      setEditingCard(null);
      setSelectedCode(queryCode.trim());
      if (window.innerWidth < 1024) {
        setShowMobileSheet(true);
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = showMobileSheet ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [showMobileSheet]);

  const cardsWithCost = useMemo(
    () => cards.filter((c) => typeof c.cost === "number" && c.cost > 0),
    [cards]
  );
  const totalTaps = useMemo(
    () => cards.reduce((sum, c) => sum + (c.tapCount ?? 0), 0),
    [cards]
  );
  const totalRevenue = useMemo(
    () => cards.reduce((sum, c) => sum + (c.price ?? 50000), 0),
    [cards]
  );
  const totalCost = useMemo(
    () => cardsWithCost.reduce((sum, c) => sum + (c.cost ?? 0), 0),
    [cardsWithCost]
  );
  const totalProfit = useMemo(
    () => cardsWithCost.reduce((sum, c) => sum + ((c.price ?? 50000) - (c.cost ?? 0)), 0),
    [cardsWithCost]
  );
  const missingCostCount = cards.length - cardsWithCost.length;

  function openNewAssign(code = "") {
    setEditingCard(null);
    setSelectedCode(code);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowMobileSheet(true);
    }
  }

  function notifyTestRedirect(storeName: string) {
    setPreviewToast(`Membuka tes redirect untuk ${storeName} (tidak dihitung ke statistik)`);
    setTimeout(() => setPreviewToast(null), 3200);
  }

  return (
    <div className="space-y-5">
      {showScanner && (
        <QRScanner
          onScan={(scannedCode) => {
            setShowScanner(false);
            openNewAssign(scannedCode);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {previewToast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-indigo-500/30 bg-surface px-4 py-2 text-xs font-medium text-indigo-200 shadow-xl md:bottom-6">
          {previewToast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
          Ringkasan Operasional
        </h1>
      </div>

      {missingCostCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5 text-subtle">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong className="tabular-nums text-ink">{missingCostCount} kartu</strong> belum diisi
              modal awal (HPP) sehingga belum masuk hitungan profit.
            </span>
          </div>
          <Link
            href="/admin/cards?sort=missing_cost"
            className="shrink-0 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 font-medium text-ink transition-colors hover:border-white/20"
          >
            Lengkapi
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4">
        <div className="rounded-xl border border-hairline bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>Kartu Aktif</span>
            <CreditCard className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
            {cards.length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Terhubung ke toko</div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-4 md:order-3">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>Total Tap</span>
            <MousePointerClick className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
            {totalTaps.toLocaleString("id-ID")}
          </div>
          <div className="mt-1 text-[11px] text-muted">Tap NFC &amp; scan QR</div>
        </div>

        <div className="col-span-2 rounded-xl border border-emerald-500/20 bg-surface p-4 md:order-2 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-emerald-300/90">
            <span>Keuntungan Bersih</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-emerald-300 sm:text-2xl">
            {formatRupiah(totalProfit)}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted tabular-nums">
            Omzet {formatRupiah(totalRevenue)}, Modal {formatRupiah(totalCost)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="hidden rounded-2xl border border-hairline bg-surface p-5 lg:sticky lg:top-20 lg:col-span-5 lg:block xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              {editingCard ? "Edit Kartu Toko" : "Hubungkan Kartu ke Toko"}
            </h2>
            {editingCard && (
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300">
                Mode Edit
              </span>
            )}
          </div>

          <CardForm
            initialCard={editingCard}
            initialCode={selectedCode}
            stockCodes={stockCodes}
            onSaved={async () => {
              await loadAll(false);
            }}
            onStockChanged={async () => {
              await loadAll(false);
            }}
            onCancel={editingCard ? () => setEditingCard(null) : undefined}
            onOpenScanner={() => setShowScanner(true)}
          />
        </div>

        <div className="space-y-5 lg:col-span-7 xl:col-span-8">
          <div className="rounded-2xl border border-hairline bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-ink">Aktivitas Tap Terbaru</h2>
                {unseenTapCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {unseenTapCount} Baru
                  </span>
                ) : (
                  <span className="text-[11px] text-muted">Tersinkron</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadAll(true)}
                  disabled={refreshing}
                  aria-label="Refresh"
                  title="Refresh"
                  className="inline-flex h-8 w-8 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-elevated text-xs font-medium text-subtle transition-colors hover:text-ink disabled:opacity-50 sm:w-auto sm:px-3"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <Link
                  href="/admin/taps"
                  onClick={() => {
                    const now = new Date().toISOString();
                    try {
                      localStorage.setItem("admin_taps_last_seen", now);
                      localStorage.setItem(LS_KEY, now);
                    } catch {}
                  }}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-ink transition-colors hover:border-white/20"
                >
                  <span>Lihat Semua</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-subtle" />
                </Link>
              </div>
            </div>

            {loadingData ? (
              <div className="space-y-2.5 p-5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl border border-hairline bg-elevated/40"
                  />
                ))}
              </div>
            ) : validTapLogs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-ink">Belum ada aktivitas tap</p>
                <p className="mt-1 text-xs text-muted">
                  Tap NFC atau scan QR pada kartu aktif akan tampil langsung di sini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {validTapLogs.slice(0, 8).map((log, i) => {
                  const isNew =
                    lastVisitedAt &&
                    new Date(log.tappedAt).getTime() > new Date(lastVisitedAt).getTime();
                  const resolvedStoreName =
                    (log.storeName && log.storeName.trim()) ||
                    activeCardMap.get(log.code) ||
                    `Kartu ${log.code}`;
                  const reviewUrl =
                    cardUrlMap.get(log.code) || getPublicGoogleReviewUrl("", resolvedStoreName);
                  const isIg = isInstagramUrl(reviewUrl);
                  const ld = new Date(log.tappedAt);
                  const isPrevYear = ld.getFullYear() !== new Date().getFullYear();

                  return (
                    <div
                      key={`${log.code}-${log.tappedAt}-${i}`}
                      className={`flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
                        isNew ? "bg-emerald-500/[0.04]" : ""
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-elevated text-xs font-semibold text-subtle">
                          {getStoreInitials(resolvedStoreName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-ink">
                              {resolvedStoreName}
                            </span>
                            {isNew && (
                              <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                                Baru
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                            <span className="shrink-0 rounded border border-hairline bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-indigo-300">
                              {log.code}
                            </span>
                            <span className="whitespace-nowrap tabular-nums">
                              {ld.toLocaleString("id-ID", {
                                day: "numeric",
                                month: "short",
                                ...(isPrevYear ? { year: "numeric" } : {}),
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pl-12 sm:shrink-0 sm:justify-end sm:pl-0">
                        <span className="whitespace-nowrap rounded-full border border-hairline bg-elevated px-2.5 py-1 text-[11px] font-medium tabular-nums text-emerald-300">
                          {timeAgo(log.tappedAt)}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <a
                            href={`/c/${log.code}?preview=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => notifyTestRedirect(resolvedStoreName)}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 text-[11px] font-medium text-subtle transition-colors hover:border-white/20 hover:text-ink"
                            title="Tes redirect kartu tanpa mencatat tap ke statistik"
                          >
                            <span>Tes</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          {reviewUrl && (
                            <a
                              href={reviewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 text-[11px] font-medium transition-colors ${
                                isIg
                                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                              }`}
                            >
                              <span>{isIg ? "IG" : "Ulasan"}</span>
                              <ArrowUpRight className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {!showMobileSheet && !showScanner && (
        <button
          type="button"
          onClick={() => openNewAssign("")}
          aria-label="Tambah kartu baru"
          title="Tambah kartu baru"
          className="fixed bottom-24 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl ring-1 ring-white/15 transition-transform hover:bg-indigo-500 active:scale-95 md:bottom-6 lg:hidden"
        >
          <Plus className="h-6 w-6" strokeWidth={2.25} />
        </button>
      )}

      {showMobileSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm lg:hidden"
          onClick={() => setShowMobileSheet(false)}
        >
          <div
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface px-4 pb-8 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">
                {editingCard ? "Edit Kartu Toko" : "Hubungkan Kartu ke Toko"}
              </h2>
              <button
                type="button"
                onClick={() => setShowMobileSheet(false)}
                className="rounded-lg border border-hairline bg-elevated p-2 text-subtle hover:text-ink"
                aria-label="Tutup form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CardForm
              initialCard={editingCard}
              initialCode={selectedCode}
              stockCodes={stockCodes}
              onSaved={async () => {
                await loadAll(false);
              }}
              onStockChanged={async () => {
                await loadAll(false);
              }}
              onCancel={() => setShowMobileSheet(false)}
              onCloseAfterSave={() => setShowMobileSheet(false)}
              onOpenScanner={() => {
                setShowMobileSheet(false);
                setShowScanner(true);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

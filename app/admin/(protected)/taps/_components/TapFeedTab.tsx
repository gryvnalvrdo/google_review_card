"use client";

import { useState } from "react";
import { ArrowUpRight, Clock, Store, X } from "lucide-react";
import {
  formatDateShortIndo,
  formatFullDateTime,
  getStoreInitials,
  timeAgo,
} from "../../../../../lib/format";
import { getPublicGoogleReviewUrl, isInstagramUrl } from "../../../../../lib/redirect";
import type { CardRecord, TapLogEntry } from "../../../../../lib/types";
import type { CafeSummary } from "../_lib/analytics";

interface TapFeedTabProps {
  dailyMode: "today" | "last7" | "last30" | "all" | "custom";
  customDate: string;
  search: string;
  onClearSearch: () => void;
  onShowAllPeriod: () => void;
  onOpenSleepingTab: () => void;
  activePeriodInfo: {
    title: string;
    subtitle: string;
    entries: TapLogEntry[];
    emptyMsg: string;
  };
  filteredTotalCount: number;
  tapDisplayLimit: number;
  onSetTapDisplayLimit: (limit: number) => void;
  activeCardMap: Map<string, string>;
  cardUrlMap: Map<string, string>;
  cafeBreakdownList: CafeSummary[];
  availableStoresCount: number;
  cards: CardRecord[];
  sleepingCardsCount: number;
}

export default function TapFeedTab({
  dailyMode,
  customDate,
  search,
  onClearSearch,
  onShowAllPeriod,
  onOpenSleepingTab,
  activePeriodInfo,
  filteredTotalCount,
  tapDisplayLimit,
  onSetTapDisplayLimit,
  activeCardMap,
  cardUrlMap,
  cafeBreakdownList,
  availableStoresCount,
  cards,
  sleepingCardsCount,
}: TapFeedTabProps) {
  const [mobileSubView, setMobileSubView] = useState<"feed" | "outlets">("feed");
  const [showAllStores, setShowAllStores] = useState(false);

  const entries = activePeriodInfo.entries;
  const hasSearch = Boolean(search.trim());

  const counts = Array(24).fill(0);
  entries.forEach((l) => {
    const h = new Date(l.tappedAt).getHours();
    if (h >= 0 && h < 24) counts[h]++;
  });
  const maxHour = Math.max(...counts);
  const peakHourIdx = maxHour > 0 ? counts.indexOf(maxHour) : -1;
  const peakHourLabel =
    peakHourIdx >= 0
      ? `${String(peakHourIdx).padStart(2, "0")}.00 s/d ${String((peakHourIdx + 1) % 24).padStart(2, "0")}.00 WIB`
      : null;

  const targetStores = hasSearch
    ? cafeBreakdownList.filter(
        (c) =>
          c.storeName.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase())
      )
    : cafeBreakdownList.filter((c) => c.count > 0);

  const visibleStores = showAllStores ? targetStores : targetStores.slice(0, 5);

  return (
    <div className="space-y-4">
      {!hasSearch && (
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-hairline bg-surface p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSubView("feed")}
            className={`min-h-[40px] rounded-lg px-3 text-xs font-semibold transition-colors ${
              mobileSubView === "feed" ? "bg-indigo-600 text-white" : "text-subtle hover:text-ink"
            }`}
          >
            Aliran Tap ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileSubView("outlets")}
            className={`min-h-[40px] rounded-lg px-3 text-xs font-semibold transition-colors ${
              mobileSubView === "outlets"
                ? "bg-indigo-600 text-white"
                : "text-subtle hover:text-ink"
            }`}
          >
            Ringkasan Outlet
          </button>
        </div>
      )}

      <div
        className={`grid grid-cols-1 items-start gap-5 ${
          hasSearch ? "" : "lg:grid-cols-12"
        }`}
      >
        <div
          className={`${hasSearch ? "" : "lg:col-span-8"} ${
            !hasSearch && mobileSubView === "outlets" ? "hidden lg:block" : ""
          }`}
        >
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-hairline bg-surface px-6 py-12 text-center">
              <p className="text-sm font-semibold text-ink">Tidak Ada Data Tap</p>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-subtle">
                {hasSearch
                  ? `Toko "${search.trim()}" belum memiliki aktivitas tap pada periode ini.`
                  : activePeriodInfo.emptyMsg}
              </p>
              {dailyMode !== "all" && filteredTotalCount > 0 && (
                <button
                  type="button"
                  onClick={onShowAllPeriod}
                  className="mt-4 inline-flex min-h-[38px] items-center rounded-lg border border-hairline bg-elevated px-4 text-xs font-semibold text-indigo-300 transition-colors hover:border-white/20"
                >
                  Lihat Semua Riwayat ({filteredTotalCount} tap)
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {hasSearch ? `Riwayat Tap: ${search.trim()}` : activePeriodInfo.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-subtle">
                    {hasSearch
                      ? `Menampilkan riwayat khusus toko "${search.trim()}"`
                      : activePeriodInfo.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {hasSearch && (
                    <button
                      type="button"
                      onClick={onClearSearch}
                      className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs font-medium text-subtle hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Semua Toko</span>
                    </button>
                  )}
                  <span className="rounded-full border border-hairline bg-elevated px-3 py-1 text-xs font-semibold tabular-nums text-ink">
                    {entries.length} tap
                  </span>
                </div>
              </div>

              <div className="divide-y divide-hairline">
                {entries.slice(0, tapDisplayLimit).map((log, i) => {
                  const resolvedStoreName =
                    (log.storeName && log.storeName.trim()) ||
                    activeCardMap.get(log.code) ||
                    `Kartu ${log.code}`;
                  const reviewUrl =
                    cardUrlMap.get(log.code) || getPublicGoogleReviewUrl("", resolvedStoreName);
                  const isIg = isInstagramUrl(reviewUrl);
                  const d = new Date(log.tappedAt);
                  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(
                    d.getMinutes()
                  ).padStart(2, "0")}`;
                  const isPrevYear = d.getFullYear() !== new Date().getFullYear();
                  const dateStr = d.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    ...(isPrevYear ? { year: "numeric" } : {}),
                  });

                  return (
                    <div
                      key={`${log.code}-${log.tappedAt}-${i}`}
                      className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-elevated text-xs font-semibold text-subtle">
                          {getStoreInitials(resolvedStoreName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">
                            {resolvedStoreName}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                            <span className="shrink-0 rounded border border-hairline bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-indigo-300">
                              {log.code}
                            </span>
                            <span className="whitespace-nowrap tabular-nums">
                              {dateStr}, {timeStr}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pl-12 sm:shrink-0 sm:justify-end sm:pl-0">
                        <div className="tabular-nums sm:text-right" title={formatFullDateTime(log.tappedAt)}>
                          <span className="whitespace-nowrap rounded-full border border-hairline bg-elevated px-2.5 py-1 text-[11px] font-medium text-emerald-300 sm:border-0 sm:bg-transparent sm:p-0 sm:text-xs">
                            {timeAgo(log.tappedAt)}
                          </span>
                          <div className="hidden font-mono text-[11px] text-muted sm:block">{timeStr}</div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          {reviewUrl && (
                            <a
                              href={reviewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 text-[11px] font-medium ${
                                isIg
                                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
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

              {entries.length > tapDisplayLimit && (
                <div className="border-t border-hairline p-4">
                  <button
                    type="button"
                    onClick={() => onSetTapDisplayLimit(entries.length)}
                    className="min-h-[40px] w-full rounded-xl border border-hairline bg-elevated text-xs font-semibold text-indigo-300 transition-colors hover:border-white/20"
                  >
                    Tampilkan Semua ({entries.length} Tap)
                  </button>
                </div>
              )}

              {entries.length > 10 && entries.length <= tapDisplayLimit && (
                <div className="flex items-center justify-center gap-3 border-t border-hairline bg-canvas/30 px-4 py-3 text-xs text-subtle">
                  <span>Menampilkan seluruh {entries.length} tap</span>
                  <button
                    type="button"
                    onClick={() => onSetTapDisplayLimit(10)}
                    className="font-semibold text-indigo-300 hover:text-indigo-200"
                  >
                    Ringkas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {!hasSearch && (
          <div
            className={`space-y-4 lg:col-span-4 ${
              mobileSubView === "feed" ? "hidden lg:block" : ""
            }`}
          >
            <div className="rounded-2xl border border-hairline bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Jam Tersibuk</span>
                </span>
                <span className="rounded-full border border-hairline bg-elevated px-2 py-0.5 text-[10px] font-medium text-subtle">
                  {customDate
                    ? formatDateShortIndo(customDate)
                    : dailyMode === "today"
                    ? "Hari Ini"
                    : dailyMode === "last7"
                    ? "7 Hari"
                    : dailyMode === "last30"
                    ? "30 Hari"
                    : "Semua"}
                </span>
              </div>

              {peakHourLabel ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-3">
                  <div className="text-sm font-semibold tabular-nums text-emerald-300">
                    {peakHourLabel}
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums text-subtle">
                    {maxHour} tap tercatat di jam ini
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">Belum ada tap pada periode ini.</p>
              )}
            </div>

            <div className="rounded-2xl border border-hairline bg-surface p-4">
              <div className="mb-3 text-xs font-semibold text-ink">Status Operasional Kartu</div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-hairline bg-canvas/50 p-3">
                  <div className="text-[11px] text-muted">Toko Aktif</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-ink">
                    {availableStoresCount}
                  </div>
                </div>
                <div className="rounded-xl border border-hairline bg-canvas/50 p-3">
                  <div className="text-[11px] text-muted">Sudah Ada Tap</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">
                    {Math.max(0, cards.length - sleepingCardsCount)}
                  </div>
                </div>
              </div>
              {sleepingCardsCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenSleepingTab}
                  className="mt-3 flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                >
                  <span>{sleepingCardsCount} Kartu Belum Ada Tap</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
              <div className="flex items-center justify-between border-b border-hairline px-4 py-3.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Store className="h-3.5 w-3.5 text-amber-400" />
                  <span>Total Tap per Outlet</span>
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-subtle">
                  {entries.length} tap
                </span>
              </div>

              {targetStores.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted">
                  Belum ada outlet yang mendapat tap pada periode ini.
                </div>
              ) : (
                <div className="divide-y divide-hairline">
                  {visibleStores.map((c, idx) => (
                    <div
                      key={c.storeName}
                      className="flex items-center justify-between gap-2 px-4 py-3 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="w-5 shrink-0 font-mono text-[11px] font-semibold text-muted">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{c.storeName}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                            <span className="font-mono text-indigo-300">{c.code}</span>
                            <span className="tabular-nums">{c.pct}%</span>
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-ink">
                        {c.count} tap
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {targetStores.length > 5 && (
                <div className="border-t border-hairline p-3">
                  <button
                    type="button"
                    onClick={() => setShowAllStores((v) => !v)}
                    className="min-h-[34px] w-full rounded-lg border border-hairline bg-elevated text-xs font-medium text-subtle hover:text-ink"
                  >
                    {showAllStores
                      ? "Tampilkan Lebih Sedikit"
                      : `Tampilkan Semua (${targetStores.length} Outlet)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

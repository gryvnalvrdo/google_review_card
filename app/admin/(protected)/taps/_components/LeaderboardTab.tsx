"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { formatFullDateTime, formatTapDateTime, timeAgo } from "../../../../../lib/format";
import type { TapLogEntry } from "../../../../../lib/types";
import type { MonthGroup } from "../_lib/analytics";

interface LeaderboardTabProps {
  selectedMonthKey: string;
  thisMonthKey: string;
  onSelectMonth: (key: string) => void;
  monthsByYear: {
    year: string;
    months: MonthGroup[];
  }[];
  selectedMonthGroup: MonthGroup | null;
  tapsByStoreMonth: Map<string, TapLogEntry[]>;
  search: string;
}

export default function LeaderboardTab({
  selectedMonthKey,
  thisMonthKey,
  onSelectMonth,
  monthsByYear,
  selectedMonthGroup,
  tapsByStoreMonth,
  search,
}: LeaderboardTabProps) {
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  if (!selectedMonthGroup && monthsByYear.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface px-6 py-12 text-center">
        <Trophy className="mx-auto mb-3 h-8 w-8 text-muted" />
        <p className="text-sm font-semibold text-ink">Belum Ada Data Leaderboard</p>
        <p className="mt-1 text-xs text-subtle">
          {search
            ? `Tidak ada toko yang cocok dengan pencarian "${search}".`
            : "Tap kartu NFC atau scan QR pada kartu aktif untuk mulai merekam peringkat."}
        </p>
      </div>
    );
  }

  const mg = selectedMonthGroup;
  const maxCount = mg ? Math.max(...mg.byStore.map((s) => s.count), 1) : 1;
  const isCurrent = selectedMonthKey === thisMonthKey;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectMonth(thisMonthKey);
              setExpandedStore(null);
            }}
            className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold transition-colors ${
              selectedMonthKey === thisMonthKey
                ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                : "border-hairline bg-elevated text-subtle hover:text-ink"
            }`}
          >
            Bulan Ini
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectMonth("all");
              setExpandedStore(null);
            }}
            className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold transition-colors ${
              selectedMonthKey === "all"
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                : "border-hairline bg-elevated text-subtle hover:text-ink"
            }`}
          >
            Sepanjang Masa
          </button>

          <select
            value={selectedMonthKey === "all" ? "" : selectedMonthKey}
            onChange={(e) => {
              if (e.target.value) {
                onSelectMonth(e.target.value);
                setExpandedStore(null);
              }
            }}
            className="min-h-[36px] rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-ink outline-none"
          >
            {selectedMonthKey === "all" && (
              <option value="" disabled>
                Pilih Bulan...
              </option>
            )}
            {monthsByYear.map(({ year, months }) => (
              <optgroup key={year} label={`Arsip ${year}`}>
                {months.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    {m.monthKey === thisMonthKey ? `${m.label} (Bulan Ini)` : m.label} ({m.total} Tap)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            selectedMonthKey === "all"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : isCurrent
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
          }`}
        >
          {selectedMonthKey === "all"
            ? "All-Time"
            : isCurrent
            ? "Bulan Berjalan"
            : "Arsip Historis"}
        </span>
      </div>

      {mg ? (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-ink sm:text-base">Rekap {mg.label}</h3>
              <p className="mt-0.5 text-xs text-subtle tabular-nums">
                {mg.byStore.filter((s) => s.count > 0).length} toko aktif, {mg.total} total tap
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-semibold tabular-nums text-amber-300">{mg.total}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">Total Tap</div>
            </div>
          </div>

          {mg.total === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-subtle">
              Belum ada aktivitas tap pada periode {mg.label}.
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {mg.byStore
                .filter((s) => s.count > 0)
                .map((s, idx) => {
                  const storeKey = `${mg.monthKey}::${s.storeName}`;
                  const isOpen = expandedStore === storeKey;
                  const storeTaps = tapsByStoreMonth.get(storeKey) ?? [];
                  const pct = Math.round((s.count / maxCount) * 100);
                  const delta = s.lastMonthCount > 0 ? s.count - s.lastMonthCount : null;

                  return (
                    <div key={s.storeName} className="px-5 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold ${
                              idx === 0
                                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                                : idx === 1
                                ? "bg-slate-400/15 text-slate-200 ring-1 ring-slate-400/30"
                                : idx === 2
                                ? "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30"
                                : "bg-elevated text-muted"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-ink">
                              {s.storeName}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                              <span className="font-mono text-indigo-300">{s.code}</span>
                              {delta !== null && (
                                <span
                                  className={`tabular-nums ${
                                    delta >= 0 ? "text-emerald-400" : "text-rose-400"
                                  }`}
                                >
                                  {delta >= 0 ? `+${delta}` : delta} vs bln lalu
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right font-semibold tabular-nums text-ink">
                          <span className={idx === 0 ? "text-amber-300" : ""}>{s.count}</span>
                          <span className="ml-1 text-xs font-normal text-muted">tap</span>
                        </div>
                      </div>

                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={`h-full rounded-full ${
                            idx === 0 ? "bg-amber-400" : "bg-indigo-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setExpandedStore(isOpen ? null : storeKey)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200"
                        >
                          {isOpen ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" />
                              <span>Tutup detail tap</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" />
                              <span>Lihat detail {s.count} tap</span>
                            </>
                          )}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="mt-3 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-hairline bg-canvas/60 p-2.5">
                          {storeTaps.map((t, ti) => (
                            <div
                              key={`${t.tappedAt}-${ti}`}
                              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs odd:bg-white/[0.02]"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="w-7 shrink-0 font-mono text-[11px] text-muted">
                                  #{ti + 1}
                                </span>
                                <span
                                  className="truncate tabular-nums text-ink"
                                  title={formatFullDateTime(t.tappedAt)}
                                >
                                  {formatTapDateTime(t.tappedAt)}
                                </span>
                              </div>
                              <span className="shrink-0 font-mono text-[11px] tabular-nums text-emerald-300">
                                {timeAgo(t.tappedAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-hairline bg-surface px-6 py-12 text-center text-xs text-subtle">
          Tidak ada data aktivitas tap untuk bulan yang dipilih.
        </div>
      )}
    </div>
  );
}

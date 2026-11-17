"use client";

import Link from "next/link";
import { CheckCircle2, Clock, ExternalLink, Moon } from "lucide-react";
import { formatTapDateTime, timeAgo } from "../../../../../lib/format";
import type { CardRecord, TapLogEntry } from "../../../../../lib/types";

interface IdleCardsTabProps {
  sleepingPeriod: "today" | "last7" | "last30";
  sleepingCards: CardRecord[];
  validLogs: TapLogEntry[];
  onNotifyTest: (storeName: string) => void;
}

export default function IdleCardsTab({
  sleepingPeriod,
  sleepingCards,
  validLogs,
  onNotifyTest,
}: IdleCardsTabProps) {
  if (sleepingCards.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-surface px-6 py-12 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
        <h3 className="text-sm font-semibold text-emerald-300">
          {sleepingPeriod === "today"
            ? "Semua Kartu Sudah Tap Hari Ini"
            : sleepingPeriod === "last7"
            ? "Semua Kartu Aktif dalam 7 Hari Terakhir"
            : "Semua Kartu Aktif dalam 30 Hari Terakhir"}
        </h3>
        <p className="mt-1 text-xs text-subtle">
          Tidak ada kartu yang pasif pada periode ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {sleepingCards.map((card) => {
        const lastTapEntry = validLogs.find((l) => l.code === card.code);
        return (
          <div
            key={card.code}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-surface px-4 py-3.5"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-300">
                <Moon className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{card.storeName}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                  <span className="rounded border border-hairline bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-indigo-300">
                    {card.code}
                  </span>
                  {card.createdAt && (
                    <span className="text-[11px] text-muted">
                      Dibuat {timeAgo(card.createdAt)}
                    </span>
                  )}
                  {lastTapEntry ? (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                      <Clock className="h-3 w-3" />
                      <span>Terakhir: {timeAgo(lastTapEntry.tappedAt)}</span>
                      <span className="hidden text-amber-200/70 sm:inline">
                        ({formatTapDateTime(lastTapEntry.tappedAt)})
                      </span>
                    </span>
                  ) : (
                    <span className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                      Belum pernah di-tap
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`/c/${card.code}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onNotifyTest(card.storeName)}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-ink hover:border-white/20"
              >
                <span>Tes Link</span>
                <ExternalLink className="h-3 w-3 text-indigo-300" />
              </a>
              <Link
                href="/admin/cards"
                className="inline-flex min-h-[34px] items-center rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-subtle hover:text-ink"
              >
                Kelola
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

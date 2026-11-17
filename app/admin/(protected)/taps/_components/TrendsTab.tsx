"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { formatDateIndo, formatDateShortIndo, toDateInputValue } from "../../../../../lib/format";
import type { TapLogEntry } from "../../../../../lib/types";
import {
  buildCustomDailyTrend,
  buildDailyTrend30,
  buildDailyTrend7,
  buildHourChartData,
  buildHourCounts,
  computePeakHour,
  formatMonthLabel,
  formatWeeklyPeriodLabel,
  getWeekNumber,
  getWeekRange,
  WeekBucket,
} from "../_lib/analytics";
import BarChart from "./BarChart";

interface TrendsTabProps {
  storeFilteredLogs: TapLogEntry[];
  activeCardMap: Map<string, string>;
  earliestAssignedDate: Date | null;
  monthsByYear: {
    year: string;
    months: { monthKey: string; label: string; total: number }[];
  }[];
  thisMonthKey: string;
}

function StoreContributionList({
  title,
  subtitle,
  logs,
  activeCardMap,
}: {
  title: string;
  subtitle: string;
  logs: TapLogEntry[];
  activeCardMap: Map<string, string>;
}) {
  const [showAll, setShowAll] = useState(false);

  const stores = useMemo(() => {
    const map = new Map<string, { count: number; code: string; storeName: string }>();
    for (const log of logs) {
      const name =
        (log.storeName && log.storeName.trim()) ||
        activeCardMap.get(log.code) ||
        (log.code ? `Toko (${log.code})` : "Toko Tanpa Nama");
      const key = log.code || name;
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { count: 1, code: log.code, storeName: name });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [logs, activeCardMap]);

  if (stores.length === 0) return null;

  const max = stores[0].count;
  const total = logs.length;
  const visible = showAll ? stores : stores.slice(0, 5);

  return (
    <div className="mt-5 rounded-xl border border-hairline bg-canvas/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-ink">{title}</h4>
          <p className="text-[11px] text-subtle">{subtitle}</p>
        </div>
        <span className="rounded-full border border-hairline bg-elevated px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-subtle">
          {stores.length} Toko, {total} Tap
        </span>
      </div>

      <div className="space-y-2.5">
        {visible.map((s, idx) => {
          const pct = Math.round((s.count / max) * 100);
          return (
            <div key={s.code || s.storeName} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 font-mono text-[11px] font-semibold text-muted">
                    #{idx + 1}
                  </span>
                  <span className="truncate font-medium text-ink">{s.storeName}</span>
                  {s.code && (
                    <span className="rounded border border-hairline bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-indigo-300">
                      {s.code}
                    </span>
                  )}
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-ink">
                  {s.count} tap
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full ${
                    idx === 0 ? "bg-emerald-500" : "bg-indigo-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {stores.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 w-full rounded-lg border border-hairline bg-elevated py-2 text-xs font-medium text-subtle hover:text-ink"
        >
          {showAll ? "Tampilkan Lebih Sedikit" : `Tampilkan Semua (${stores.length} Toko)`}
        </button>
      )}
    </div>
  );
}

export default function TrendsTab({
  storeFilteredLogs,
  activeCardMap,
  earliestAssignedDate,
  monthsByYear,
  thisMonthKey,
}: TrendsTabProps) {
  const [trenView, setTrenView] = useState<"jam" | "harian" | "mingguan">("jam");
  const [hourPeriod, setHourPeriod] = useState<"today" | "last7" | "last30" | "all">("today");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const [trendRange, setTrendRange] = useState<7 | 30 | "custom">(7);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return toDateInputValue(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => toDateInputValue(new Date()));

  const [weeklyPeriodType, setWeeklyPeriodType] = useState<"8w" | "12w" | "month" | "year">("8w");
  const [weekPageOffset, setWeekPageOffset] = useState(0);
  const [selectedWeeklyMonth, setSelectedWeeklyMonth] = useState("");
  const [selectedWeeklyYear, setSelectedWeeklyYear] = useState(() => new Date().getFullYear());
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);

  const [selectedDrilldownDate, setSelectedDrilldownDate] = useState<string | null>(null);

  const periodLogsMap = useMemo(() => {
    const now = new Date();
    const todayYmd = toDateInputValue(now);
    const cutoff7 = new Date(now);
    cutoff7.setDate(now.getDate() - 6);
    cutoff7.setHours(0, 0, 0, 0);
    const cutoff30 = new Date(now);
    cutoff30.setDate(now.getDate() - 29);
    cutoff30.setHours(0, 0, 0, 0);

    const today: TapLogEntry[] = [];
    const last7: TapLogEntry[] = [];
    const last30: TapLogEntry[] = [];

    for (const l of storeFilteredLogs) {
      const d = new Date(l.tappedAt);
      if (toDateInputValue(d) === todayYmd) today.push(l);
      if (d >= cutoff7) last7.push(l);
      if (d >= cutoff30) last30.push(l);
    }

    return { today, last7, last30, all: storeFilteredLogs };
  }, [storeFilteredLogs]);

  const hourFilteredLogs = periodLogsMap[hourPeriod];
  const peakHour = useMemo(() => computePeakHour(hourFilteredLogs), [hourFilteredLogs]);
  const allHourCounts = useMemo(() => buildHourCounts(hourFilteredLogs), [hourFilteredLogs]);
  const activeHour =
    selectedHour !== null
      ? selectedHour
      : peakHour
      ? peakHour.hour
      : allHourCounts.findIndex((c) => c > 0) !== -1
      ? allHourCounts.findIndex((c) => c > 0)
      : null;

  const hourData = useMemo(
    () => buildHourChartData(allHourCounts, activeHour),
    [allHourCounts, activeHour]
  );

  const selectedHourLogs = useMemo(() => {
    if (activeHour === null) return [];
    return hourFilteredLogs.filter((l) => new Date(l.tappedAt).getHours() === activeHour);
  }, [hourFilteredLogs, activeHour]);

  const trendData7 = useMemo(() => buildDailyTrend7(storeFilteredLogs), [storeFilteredLogs]);
  const trendData30 = useMemo(() => buildDailyTrend30(storeFilteredLogs), [storeFilteredLogs]);
  const customTrendData = useMemo(
    () =>
      trendRange === "custom"
        ? buildCustomDailyTrend(storeFilteredLogs, customStartDate, customEndDate)
        : [],
    [trendRange, storeFilteredLogs, customStartDate, customEndDate]
  );

  const trendRangeLogs = useMemo(() => {
    if (trendRange === "custom") {
      const s = new Date(customStartDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEndDate);
      e.setHours(23, 59, 59, 999);
      return storeFilteredLogs.filter((l) => {
        const t = new Date(l.tappedAt);
        return t >= s && t <= e;
      });
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (trendRange === 7 ? 6 : 29));
    cutoff.setHours(0, 0, 0, 0);
    return storeFilteredLogs.filter((l) => new Date(l.tappedAt) >= cutoff);
  }, [storeFilteredLogs, trendRange, customStartDate, customEndDate]);

  const earliestWeekRange = useMemo(
    () => (earliestAssignedDate ? getWeekRange(earliestAssignedDate) : null),
    [earliestAssignedDate]
  );

  const allFlatMonths = useMemo(() => monthsByYear.flatMap((y) => y.months), [monthsByYear]);

  const weeklyTrendData = useMemo((): WeekBucket[] => {
    const weeks: WeekBucket[] = [];
    const now = new Date();
    const currentWeekInfo = getWeekRange(now);

    const pushWeek = (wInfo: ReturnType<typeof getWeekRange>) => {
      const wLogs = storeFilteredLogs.filter((l) => {
        const t = new Date(l.tappedAt).getTime();
        return t >= wInfo.start.getTime() && t <= wInfo.end.getTime();
      });
      const sDay = wInfo.start.getDate();
      const sMo = wInfo.start.getMonth() + 1;
      const eDay = wInfo.end.getDate();
      const eMo = wInfo.end.getMonth() + 1;
      const isCurrentWeek = wInfo.weekKey === currentWeekInfo.weekKey;
      weeks.push({
        weekKey: wInfo.weekKey,
        label: wInfo.label,
        subLabel: isCurrentWeek ? "Minggu ini" : `Minggu ${getWeekNumber(wInfo.start)}`,
        mobileSubLabel: `${sDay}/${sMo}-${eDay}/${eMo}`,
        start: wInfo.start,
        end: wInfo.end,
        count: wLogs.length,
        logs: wLogs,
      });
    };

    if (weeklyPeriodType === "8w" || weeklyPeriodType === "12w") {
      const pageSize = weeklyPeriodType === "12w" ? 12 : 8;
      const startIdx = pageSize - 1 + weekPageOffset * pageSize;
      const endIdx = weekPageOffset * pageSize;
      for (let i = startIdx; i >= endIdx; i--) {
        const refDate = new Date(currentWeekInfo.start);
        refDate.setDate(refDate.getDate() - i * 7);
        const wInfo = getWeekRange(refDate);
        if (earliestWeekRange && wInfo.end.getTime() < earliestWeekRange.start.getTime()) continue;
        pushWeek(wInfo);
      }
    } else if (weeklyPeriodType === "month") {
      const targetMonthKey = selectedWeeklyMonth || thisMonthKey;
      const [yStr, mStr] = targetMonthKey.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      const startWeek = getWeekRange(new Date(y, m, 1));
      const endWeek = getWeekRange(new Date(y, m + 1, 0));
      const cur = new Date(startWeek.start);
      while (cur.getTime() <= endWeek.start.getTime()) {
        pushWeek(getWeekRange(cur));
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      const targetYear = selectedWeeklyYear || now.getFullYear();
      const isThisYear = targetYear === now.getFullYear();
      const startWeek = getWeekRange(new Date(targetYear, 0, 1));
      const endLimit = isThisYear
        ? currentWeekInfo.start
        : getWeekRange(new Date(targetYear, 11, 31)).start;
      let effectiveStart = startWeek.start;
      if (
        earliestWeekRange &&
        earliestWeekRange.start.getFullYear() === targetYear &&
        earliestWeekRange.start.getTime() > effectiveStart.getTime()
      ) {
        effectiveStart = earliestWeekRange.start;
      }
      const cur = new Date(effectiveStart);
      while (cur.getTime() <= endLimit.getTime()) {
        pushWeek(getWeekRange(cur));
        cur.setDate(cur.getDate() + 7);
      }
    }
    return weeks;
  }, [
    storeFilteredLogs,
    weeklyPeriodType,
    weekPageOffset,
    selectedWeeklyMonth,
    selectedWeeklyYear,
    thisMonthKey,
    earliestWeekRange,
  ]);

  const weeklyPeriodLabel = formatWeeklyPeriodLabel(
    weeklyTrendData,
    weeklyPeriodType,
    weekPageOffset,
    selectedWeeklyMonth,
    selectedWeeklyYear,
    thisMonthKey
  );

  const selectedWeekObj = useMemo(
    () => (selectedWeekKey ? weeklyTrendData.find((w) => w.weekKey === selectedWeekKey) || null : null),
    [selectedWeekKey, weeklyTrendData]
  );

  const weekDailyData = useMemo(() => {
    if (!selectedWeekObj) return [];
    const dayNames = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    return dayNames.map((name, i) => {
      const d = new Date(selectedWeekObj.start);
      d.setDate(d.getDate() + i);
      const dateKey = toDateInputValue(d);
      const count = selectedWeekObj.logs.filter(
        (l) => toDateInputValue(new Date(l.tappedAt)) === dateKey
      ).length;
      return {
        label: name,
        subLabel: `${d.getDate()}/${d.getMonth() + 1}`,
        dateKey,
        value: count,
        highlight: dateKey === toDateInputValue(new Date()),
        tooltip: `${name}, ${d.getDate()}/${d.getMonth() + 1}: ${count} tap`,
      };
    });
  }, [selectedWeekObj]);

  const weeklyChartData = useMemo(() => {
    const currentWeekKey = getWeekRange(new Date()).weekKey;
    return weeklyTrendData.map((w) => ({
      label: w.subLabel,
      subLabel: w.label,
      mobileSubLabel: w.mobileSubLabel,
      value: w.count,
      weekKey: w.weekKey,
      highlight: w.weekKey === currentWeekKey,
      tooltip: `${w.subLabel} (${w.label}): ${w.count} tap`,
    }));
  }, [weeklyTrendData]);

  const drilldownLogs = useMemo(() => {
    if (!selectedDrilldownDate) return [];
    return storeFilteredLogs.filter(
      (l) => toDateInputValue(new Date(l.tappedAt)) === selectedDrilldownDate
    );
  }, [storeFilteredLogs, selectedDrilldownDate]);

  const drilldownHourCounts = useMemo(() => buildHourCounts(drilldownLogs), [drilldownLogs]);
  const drilldownHourData = useMemo(
    () => buildHourChartData(drilldownHourCounts, null),
    [drilldownHourCounts]
  );
  const drilldownPeak = useMemo(() => computePeakHour(drilldownLogs), [drilldownLogs]);

  const activeHours = useMemo(() => {
    const list = Array.from({ length: 24 })
      .map((_, h) => h)
      .filter((h) => (allHourCounts[h] || 0) > 0);
    if (list.length > 0 && activeHour !== null && !list.includes(activeHour)) {
      list.push(activeHour);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [allHourCounts, activeHour]);

  const canGoPreviousWeeks = useMemo(() => {
    if (!earliestWeekRange) return false;
    const currentWeekInfo = getWeekRange(new Date());
    const pageSize = weeklyPeriodType === "12w" ? 12 : 8;
    const refDate = new Date(currentWeekInfo.start);
    refDate.setDate(refDate.getDate() - (weekPageOffset + 1) * pageSize * 7);
    return getWeekRange(refDate).end.getTime() >= earliestWeekRange.start.getTime();
  }, [earliestWeekRange, weeklyPeriodType, weekPageOffset]);

  if (storeFilteredLogs.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface px-6 py-12 text-center">
        <p className="text-sm font-semibold text-ink">Belum Ada Data Tren</p>
        <p className="mt-1 text-xs text-subtle">
          Grafik jam sibuk dan tren harian akan muncul otomatis setelah ada tap masuk.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-6">
      {selectedDrilldownDate ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
            <button
              type="button"
              onClick={() => setSelectedDrilldownDate(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-xs font-medium text-ink hover:border-white/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali</span>
            </button>
            <div className="text-xs font-medium text-subtle">
              {formatDateIndo(selectedDrilldownDate)}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Distribusi Jam: {formatDateShortIndo(selectedDrilldownDate)}
              </h3>
              <p className="text-xs text-subtle">Rincian 24 jam kedatangan pelanggan</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full border border-hairline bg-elevated px-2.5 py-1 font-semibold tabular-nums text-ink">
                {drilldownLogs.length} tap
              </span>
              {drilldownPeak && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 font-semibold tabular-nums text-emerald-300">
                  Puncak {drilldownPeak.label}
                </span>
              )}
            </div>
          </div>

          <BarChart data={drilldownHourData} yAxisUnit="Tap" xAxisTitle="Jam" />

          <StoreContributionList
            title={`Outlet pada ${formatDateShortIndo(selectedDrilldownDate)}`}
            subtitle="Kontribusi outlet pada tanggal terpilih."
            logs={drilldownLogs}
            activeCardMap={activeCardMap}
          />
        </div>
      ) : (
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink sm:text-base">
                {trenView === "jam"
                  ? "Distribusi Jam Sibuk"
                  : trenView === "harian"
                  ? "Tren Aktivitas Harian"
                  : selectedWeekObj
                  ? `Rincian ${selectedWeekObj.subLabel} (${selectedWeekObj.label})`
                  : `Tren Mingguan (${weeklyPeriodLabel})`}
              </h3>
              <p className="mt-0.5 text-xs text-subtle">
                {trenView === "jam"
                  ? "Klik batang jam untuk membedah outlet yang aktif di jam tersebut."
                  : trenView === "harian"
                  ? "Klik batang tanggal untuk membedah rincian 24 jam."
                  : selectedWeekObj
                  ? "Klik batang hari untuk melihat distribusi jam."
                  : "Klik batang minggu untuk membedah performa 7 hari di dalamnya."}
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-hairline bg-canvas p-1">
              {(
                [
                  { id: "jam", label: "Jam Sibuk" },
                  { id: "harian", label: "Harian" },
                  { id: "mingguan", label: "Mingguan" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTrenView(tab.id);
                    setSelectedDrilldownDate(null);
                    setSelectedWeekKey(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    trenView === tab.id
                      ? "bg-indigo-600 text-white"
                      : "text-subtle hover:text-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {trenView === "jam" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {(
                  [
                    { id: "today", label: "Hari Ini" },
                    { id: "last7", label: "7 Hari" },
                    { id: "last30", label: "30 Hari" },
                    { id: "all", label: "Semua" },
                  ] as const
                ).map((p) => {
                  const isActive = hourPeriod === p.id;
                  const count = periodLogsMap[p.id].length;
                  const peak = computePeakHour(periodLogsMap[p.id]);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setHourPeriod(p.id);
                        setSelectedHour(null);
                      }}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                        isActive
                          ? "border-indigo-500/60 bg-indigo-500/15"
                          : "border-hairline bg-canvas/50 hover:border-white/20"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-ink">{p.label}</span>
                        <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-indigo-300">
                          {count}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] tabular-nums text-subtle">
                        {peak ? `Puncak ${peak.label}` : "Belum ada tap"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <BarChart
                data={hourData}
                yAxisUnit="Tap"
                xAxisTitle="Jam"
                selectedIndex={activeHour}
                onBarClick={(i) => {
                  if (hourFilteredLogs.length > 0) setSelectedHour(i);
                }}
              />

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-subtle">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#10B981]" />
                  <span>Tertinggi</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#525BB8]" />
                  <span>Jam Lainnya</span>
                </span>
                {activeHour !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#818CF8]" />
                    <span>Dipilih</span>
                  </span>
                )}
              </div>

              {activeHour !== null && activeHours.length > 0 && (
                <div className="rounded-xl border border-hairline bg-canvas/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                      <Clock className="h-3.5 w-3.5 text-indigo-400" />
                      <span>
                        Outlet pada jam {String(activeHour).padStart(2, "0")}.00 s/d{" "}
                        {String((activeHour + 1) % 24).padStart(2, "0")}.00
                      </span>
                    </div>
                    <select
                      value={activeHour}
                      onChange={(e) => setSelectedHour(Number(e.target.value))}
                      className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-ink outline-none"
                    >
                      {activeHours.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}.00 s/d {String((h + 1) % 24).padStart(2, "0")}.00 (
                          {allHourCounts[h]} tap)
                        </option>
                      ))}
                    </select>
                  </div>

                  <StoreContributionList
                    title=""
                    subtitle={`${selectedHourLogs.length} tap tercatat pada jam terpilih.`}
                    logs={selectedHourLogs}
                    activeCardMap={activeCardMap}
                  />
                </div>
              )}
            </div>
          )}

          {trenView === "harian" && (() => {
            const activeDaily =
              trendRange === 7 ? trendData7 : trendRange === 30 ? trendData30 : customTrendData;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {(
                    [
                      { id: 7, label: "7 Hari Terakhir", count: trendData7.reduce((s, d) => s + d.value, 0) },
                      { id: 30, label: "30 Hari Terakhir", count: trendData30.reduce((s, d) => s + d.value, 0) },
                      { id: "custom", label: "Rentang Kustom", count: customTrendData.reduce((s, d) => s + d.value, 0) },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => setTrendRange(opt.id)}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left text-xs transition-colors ${
                        trendRange === opt.id
                          ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                          : "border-hairline bg-canvas/50 text-subtle hover:border-white/20 hover:text-ink"
                      }`}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="rounded bg-elevated px-2 py-0.5 font-mono font-semibold tabular-nums text-ink">
                        {opt.count} tap
                      </span>
                    </button>
                  ))}
                </div>

                {trendRange === "custom" && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-canvas/50 p-3 text-xs">
                    <span className="font-medium text-subtle">Rentang:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      max={customEndDate || toDateInputValue(new Date())}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-ink"
                    />
                    <span className="text-muted">s/d</span>
                    <input
                      type="date"
                      value={customEndDate}
                      min={customStartDate}
                      max={toDateInputValue(new Date())}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-ink"
                    />
                  </div>
                )}

                <BarChart
                  data={activeDaily}
                  yAxisUnit="Tap"
                  xAxisTitle="Tanggal"
                  onBarClick={(_idx, item) => {
                    if (item.dateKey) setSelectedDrilldownDate(item.dateKey);
                  }}
                />

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-subtle">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#10B981]" />
                    <span>Tertinggi</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#38BDF8]" />
                    <span>Hari Ini</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#525BB8]" />
                    <span>Hari Lainnya</span>
                  </span>
                </div>

                <StoreContributionList
                  title="Peringkat Outlet pada Rentang Ini"
                  subtitle="Akumulasi kontribusi tap per toko."
                  logs={trendRangeLogs}
                  activeCardMap={activeCardMap}
                />
              </div>
            );
          })()}

          {trenView === "mingguan" && (
            <div className="space-y-4">
              {selectedWeekObj ? (
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWeekKey(null)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-xs font-medium text-ink"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Kembali ke Mingguan</span>
                    </button>
                    <span className="text-xs font-semibold tabular-nums text-emerald-300">
                      Total: {selectedWeekObj.count} tap
                    </span>
                  </div>

                  <BarChart
                    data={weekDailyData}
                    yAxisUnit="Tap"
                    xAxisTitle="Hari"
                    onBarClick={(_idx, item) => {
                      if (item.dateKey) setSelectedDrilldownDate(item.dateKey);
                    }}
                  />

                  <StoreContributionList
                    title={`Outlet Teraktif: ${selectedWeekObj.subLabel}`}
                    subtitle={selectedWeekObj.label}
                    logs={selectedWeekObj.logs}
                    activeCardMap={activeCardMap}
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "8w", label: "8 Minggu" },
                          { id: "12w", label: "12 Minggu" },
                          { id: "year", label: `Tahun ${selectedWeeklyYear}` },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setWeeklyPeriodType(opt.id);
                            setWeekPageOffset(0);
                            if (opt.id === "year") setSelectedWeeklyYear(new Date().getFullYear());
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            weeklyPeriodType === opt.id
                              ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                              : "border-hairline bg-canvas/50 text-subtle hover:text-ink"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}

                      {allFlatMonths.length > 0 && (
                        <select
                          value={weeklyPeriodType === "month" ? selectedWeeklyMonth || thisMonthKey : ""}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            setWeeklyPeriodType("month");
                            setSelectedWeeklyMonth(e.target.value);
                            setWeekPageOffset(0);
                          }}
                          className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-ink outline-none"
                        >
                          <option value="">Arsip Bulan...</option>
                          {allFlatMonths.map((m) => (
                            <option key={m.monthKey} value={m.monthKey}>
                              {formatMonthLabel(m.monthKey)} ({m.total} tap)
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {(weeklyPeriodType === "8w" || weeklyPeriodType === "12w") && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!canGoPreviousWeeks}
                          onClick={() => setWeekPageOffset((o) => o + 1)}
                          className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-ink disabled:opacity-35"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          <span>Lalu</span>
                        </button>
                        <button
                          type="button"
                          disabled={weekPageOffset === 0}
                          onClick={() => setWeekPageOffset((o) => Math.max(0, o - 1))}
                          className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-ink disabled:opacity-35"
                        >
                          <span>Maju</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <BarChart
                    data={weeklyChartData}
                    yAxisUnit="Tap"
                    xAxisTitle="Minggu"
                    onBarClick={(_idx, item) => {
                      if (item.weekKey) setSelectedWeekKey(item.weekKey);
                    }}
                  />

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-subtle">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#10B981]" />
                      <span>Tertinggi</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#38BDF8]" />
                      <span>Minggu Ini</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#525BB8]" />
                      <span>Minggu Lainnya</span>
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

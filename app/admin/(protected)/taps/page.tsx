"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BarChart3,
  Calendar,
  ListOrdered,
  Moon,
  RefreshCw,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { formatDateIndo, formatDateShortIndo, toDateInputValue } from "../../../../lib/format";
import { getPublicGoogleReviewUrl } from "../../../../lib/redirect";
import type { CardRecord, TapLogEntry } from "../../../../lib/types";
import IdleCardsTab from "./_components/IdleCardsTab";
import LeaderboardTab from "./_components/LeaderboardTab";
import TapFeedTab from "./_components/TapFeedTab";
import TrendsTab from "./_components/TrendsTab";
import {
  CafeSummary,
  formatMonthLabel,
  getMonthKey,
  matchesDate,
  MonthGroup,
} from "./_lib/analytics";

export default function TapsPage() {
  const [logs, setLogs] = useState<TapLogEntry[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const [isDesktop, setIsDesktop] = useState(true);
  const [activeTab, setActiveTab] = useState<"tren" | "harian" | "bulanan" | "tidur">("harian");
  const [dailyMode, setDailyMode] = useState<"today" | "last7" | "last30" | "all" | "custom">(
    "today"
  );
  const [customDate, setCustomDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [tapDisplayLimit, setTapDisplayLimit] = useState(10);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const syncDesktop = (matches: boolean) => {
      setIsDesktop(matches);
      if (!matches) {
        setActiveTab((prev) => (prev === "tren" ? "harian" : prev));
      }
    };
    syncDesktop(mq.matches);

    const onChange = (e: MediaQueryListEvent) => syncDesktop(e.matches);
    mq.addEventListener("change", onChange);

    const params = new URLSearchParams(window.location.search);
    const urlSearch = params.get("search") || params.get("store") || params.get("q");
    const urlPeriod = params.get("period");

    if (urlSearch) {
      setSearch(urlSearch);
      setActiveTab("harian");
      setDailyMode("all");
    } else if (
      urlPeriod === "all" ||
      urlPeriod === "today" ||
      urlPeriod === "last7" ||
      urlPeriod === "last30"
    ) {
      setDailyMode(urlPeriod);
      setActiveTab("harian");
    }

    return () => mq.removeEventListener("change", onChange);
  }, []);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setIsUpdating(true);

    try {
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 7);
      const [tapRes, cardRes] = await Promise.all([
        fetch(`/api/admin/taps?limit=25000&_t=${ts}&_r=${rand}`, { cache: "no-store" }),
        fetch(`/api/admin/codes?_t=${ts}&_r=${rand}`, { cache: "no-store" }),
      ]);

      if (tapRes.ok) {
        const tapData = await tapRes.json();
        const incoming: TapLogEntry[] = (tapData.logs ?? []).sort(
          (a: TapLogEntry, b: TapLogEntry) =>
            new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime()
        );
        setLogs(incoming);
        try {
          const nowIso = new Date().toISOString();
          localStorage.setItem("admin_taps_last_seen", nowIso);
          localStorage.setItem("admin_dashboard_last_visited", nowIso);
        } catch {}
      }

      if (cardRes.ok) {
        const cardData = await cardRes.json();
        setCards(cardData.cards ?? []);
      }
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchData(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeCardMap = useMemo(() => new Map(cards.map((c) => [c.code, c.storeName])), [cards]);
  const activeCodesSet = useMemo(() => new Set(cards.map((c) => c.code)), [cards]);
  const cardUrlMap = useMemo(
    () =>
      new Map(
        cards.map((c) => [c.code, getPublicGoogleReviewUrl(c.googleReviewUrl || "", c.storeName)])
      ),
    [cards]
  );

  const validLogs = useMemo(() => {
    const raw =
      cards.length === 0
        ? logs
        : logs
            .filter((l) => activeCodesSet.has(l.code))
            .map((l) => ({
              ...l,
              storeName: activeCardMap.get(l.code) || l.storeName,
            }));

    return [...raw].sort(
      (a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime()
    );
  }, [logs, cards, activeCodesSet, activeCardMap]);

  const availableStores = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((c) => {
      if (c.storeName) set.add(c.storeName);
    });
    validLogs.forEach((l) => {
      if (l.storeName) set.add(l.storeName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cards, validLogs]);

  const storeFilteredLogs = useMemo(() => {
    if (!search.trim()) return validLogs;
    const q = search.toLowerCase();
    return validLogs.filter(
      (l) => l.storeName.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [validLogs, search]);

  const todayCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return storeFilteredLogs.filter((l) => new Date(l.tappedAt).toDateString() === todayStr).length;
  }, [storeFilteredLogs]);

  const thisWeekCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);
    return storeFilteredLogs.filter((l) => new Date(l.tappedAt) >= cutoff).length;
  }, [storeFilteredLogs]);

  const thisMonthCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    cutoff.setHours(0, 0, 0, 0);
    return storeFilteredLogs.filter((l) => new Date(l.tappedAt) >= cutoff).length;
  }, [storeFilteredLogs]);

  const hariianPeriods = useMemo(() => {
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

    for (const entry of storeFilteredLogs) {
      const d = new Date(entry.tappedAt);
      if (toDateInputValue(d) === todayYmd) today.push(entry);
      if (d >= cutoff7) last7.push(entry);
      if (d >= cutoff30) last30.push(entry);
    }

    return { today, last7, last30 };
  }, [storeFilteredLogs]);

  const customDateEntries = useMemo(() => {
    if (!customDate) return [];
    return storeFilteredLogs.filter((l) => matchesDate(l.tappedAt, customDate));
  }, [storeFilteredLogs, customDate]);

  const activePeriodInfo = useMemo(() => {
    if (customDate) {
      return {
        title: "Riwayat Tap Spesifik",
        subtitle: formatDateIndo(customDate),
        entries: customDateEntries,
        emptyMsg: `Tidak ada aktivitas tap kartu pada tanggal ${formatDateIndo(customDate)}.`,
      };
    }
    if (dailyMode === "today") {
      return {
        title: "Tap Masuk Hari Ini",
        subtitle: formatDateIndo(new Date()),
        entries: hariianPeriods.today,
        emptyMsg: "Belum ada pelanggan yang men-tap kartu hari ini.",
      };
    }
    if (dailyMode === "last7") {
      return {
        title: "Riwayat 7 Hari Terakhir",
        subtitle: "Akumulasi aktivitas 7 hari ke belakang",
        entries: hariianPeriods.last7,
        emptyMsg: "Belum ada aktivitas tap dalam 7 hari terakhir.",
      };
    }
    if (dailyMode === "last30") {
      return {
        title: "Riwayat 30 Hari Terakhir",
        subtitle: "Akumulasi aktivitas 30 hari ke belakang",
        entries: hariianPeriods.last30,
        emptyMsg: "Belum ada aktivitas tap dalam 30 hari terakhir.",
      };
    }
    return {
      title: "Semua Riwayat Tap",
      subtitle: "Seluruh aktivitas tap sepanjang masa operasional",
      entries: storeFilteredLogs,
      emptyMsg: "Belum ada aktivitas tap yang tercatat.",
    };
  }, [dailyMode, customDate, customDateEntries, hariianPeriods, storeFilteredLogs]);

  const cafeBreakdownList = useMemo((): CafeSummary[] => {
    const countsMap = new Map<string, { count: number; code: string }>();
    availableStores.forEach((s) => {
      const card = cards.find((c) => c.storeName === s);
      countsMap.set(s, { count: 0, code: card?.code || "" });
    });

    activePeriodInfo.entries.forEach((l) => {
      const resolved =
        (l.storeName && l.storeName.trim()) ||
        activeCardMap.get(l.code) ||
        (l.code ? `Kartu ${l.code}` : "Toko Tanpa Nama");
      const cur = countsMap.get(resolved) || { count: 0, code: l.code };
      countsMap.set(resolved, { count: cur.count + 1, code: l.code || cur.code });
    });

    const total = activePeriodInfo.entries.length;
    return Array.from(countsMap.entries())
      .map(([storeName, info]) => ({
        storeName,
        code: info.code,
        count: info.count,
        pct: total > 0 ? Math.round((info.count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.storeName.localeCompare(b.storeName));
  }, [activePeriodInfo.entries, availableStores, cards, activeCardMap]);

  const thisMonthKey = getMonthKey(new Date().toISOString());
  const lastMonthKey = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return getMonthKey(d.toISOString());
  }, []);

  const monthlyGroups = useMemo((): MonthGroup[] => {
    const map = new Map<string, Map<string, { count: number; code: string }>>();
    for (const entry of validLogs) {
      const mk = getMonthKey(entry.tappedAt);
      if (!map.has(mk)) map.set(mk, new Map());
      const sm = map.get(mk)!;
      const cur = sm.get(entry.storeName) || { count: 0, code: entry.code };
      sm.set(entry.storeName, { count: cur.count + 1, code: entry.code });
    }
    const lastMap = map.get(lastMonthKey) ?? new Map<string, { count: number; code: string }>();
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, sm]) => {
        const byStore = Array.from(sm.entries())
          .map(([storeName, info]) => ({
            storeName,
            code: info.code,
            count: info.count,
            lastMonthCount: monthKey === thisMonthKey ? (lastMap.get(storeName)?.count ?? 0) : 0,
          }))
          .sort((a, b) => b.count - a.count);
        return {
          monthKey,
          label: formatMonthLabel(monthKey),
          total: byStore.reduce((s, x) => s + x.count, 0),
          byStore,
        };
      });
  }, [validLogs, lastMonthKey, thisMonthKey]);

  const tapsByStoreMonth = useMemo(() => {
    const map = new Map<string, TapLogEntry[]>();
    for (const entry of validLogs) {
      const mk = getMonthKey(entry.tappedAt);
      const key = `${mk}::${entry.storeName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);

      const allKey = `all::${entry.storeName}`;
      if (!map.has(allKey)) map.set(allKey, []);
      map.get(allKey)!.push(entry);
    }
    map.forEach((arr) =>
      arr.sort((a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime())
    );
    return map;
  }, [validLogs]);

  const allTimeGroup = useMemo((): MonthGroup => {
    const map = new Map<string, { count: number; code: string }>();
    for (const entry of validLogs) {
      const cur = map.get(entry.storeName) || { count: 0, code: entry.code };
      map.set(entry.storeName, { count: cur.count + 1, code: entry.code });
    }
    const byStore = Array.from(map.entries())
      .map(([storeName, info]) => ({
        storeName,
        code: info.code,
        count: info.count,
        lastMonthCount: 0,
      }))
      .sort((a, b) => b.count - a.count);
    return {
      monthKey: "all",
      label: "Sepanjang Masa",
      total: byStore.reduce((s, x) => s + x.count, 0),
      byStore,
    };
  }, [validLogs]);

  const monthsByYear = useMemo(() => {
    const yearMap = new Map<string, MonthGroup[]>();
    for (const mg of monthlyGroups) {
      const year = mg.monthKey.split("-")[0];
      if (!yearMap.has(year)) yearMap.set(year, []);
      yearMap.get(year)!.push(mg);
    }
    const curYear = thisMonthKey.split("-")[0];
    if (!yearMap.has(curYear)) yearMap.set(curYear, []);
    if (!monthlyGroups.some((mg) => mg.monthKey === thisMonthKey)) {
      yearMap.get(curYear)!.unshift({
        monthKey: thisMonthKey,
        label: formatMonthLabel(thisMonthKey),
        total: 0,
        byStore: [],
      });
    }
    return Array.from(yearMap.keys())
      .sort((a, b) => b.localeCompare(a))
      .map((year) => ({
        year,
        months: yearMap.get(year)!.sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
      }));
  }, [monthlyGroups, thisMonthKey]);

  const selectedMonthKey = selectedMonth || thisMonthKey;
  const selectedMonthGroup = useMemo(() => {
    const q = search.toLowerCase();
    if (selectedMonthKey === "all") {
      const matching = allTimeGroup.byStore.filter(
        (s) => s.storeName.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
      );
      return {
        ...allTimeGroup,
        byStore: matching,
        total: matching.reduce((s, x) => s + x.count, 0),
      };
    }
    const found = monthlyGroups.find((mg) => mg.monthKey === selectedMonthKey);
    if (!found) {
      if (selectedMonthKey === thisMonthKey) {
        return {
          monthKey: thisMonthKey,
          label: formatMonthLabel(thisMonthKey),
          total: 0,
          byStore: [],
        };
      }
      return null;
    }
    const matching = found.byStore.filter(
      (s) => s.storeName.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
    return {
      ...found,
      byStore: matching,
      total: matching.reduce((s, x) => s + x.count, 0),
    };
  }, [selectedMonthKey, allTimeGroup, monthlyGroups, search, thisMonthKey]);

  const earliestAssignedDate = useMemo(() => {
    const timestamps: number[] = [];
    cards.forEach((c) => {
      if (c.createdAt) {
        const t = new Date(c.createdAt).getTime();
        if (!Number.isNaN(t)) timestamps.push(t);
      }
    });
    storeFilteredLogs.forEach((l) => {
      const t = new Date(l.tappedAt).getTime();
      if (!Number.isNaN(t)) timestamps.push(t);
    });
    if (timestamps.length === 0) return null;
    const minTs = Math.min(...timestamps);
    return new Date(Math.min(minTs, Date.now()));
  }, [cards, storeFilteredLogs]);

  const sleepingPeriod: "today" | "last7" | "last30" =
    dailyMode === "last30" ? "last30" : dailyMode === "last7" ? "last7" : "today";

  const sleepingCards = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (sleepingPeriod === "today") cutoff.setHours(0, 0, 0, 0);
    else if (sleepingPeriod === "last7") {
      cutoff.setDate(now.getDate() - 6);
      cutoff.setHours(0, 0, 0, 0);
    } else {
      cutoff.setDate(now.getDate() - 29);
      cutoff.setHours(0, 0, 0, 0);
    }

    const activeInPeriod = new Set(
      validLogs.filter((l) => new Date(l.tappedAt) >= cutoff).map((l) => l.code)
    );
    const q = search.toLowerCase();

    return cards
      .filter(
        (c) =>
          !activeInPeriod.has(c.code) &&
          (c.storeName.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cards, validLogs, sleepingPeriod, search]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink sm:text-xl">
            Riwayat &amp; Analitik Tap
          </h1>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isUpdating}
            aria-label="Sinkronkan"
            title="Sinkronkan"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-elevated text-xs font-medium text-ink transition-colors hover:border-white/20 disabled:opacity-50 sm:h-9 sm:w-auto sm:px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sinkronkan</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {(
            [
              { id: "today", label: "Hari Ini", val: todayCount, accent: "text-emerald-300" },
              { id: "last7", label: "7 Hari", val: thisWeekCount, accent: "text-indigo-300" },
              { id: "last30", label: "30 Hari", val: thisMonthCount, accent: "text-amber-300" },
              { id: "all", label: "Semua Tap", val: storeFilteredLogs.length, accent: "text-ink" },
            ] as const
          ).map((chip) => {
            const isActive =
              (activeTab === "harian" || activeTab === "tidur") &&
              dailyMode === chip.id &&
              !customDate;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setDailyMode(chip.id);
                  setCustomDate("");
                  setTapDisplayLimit(10);
                  if (activeTab !== "tidur") setActiveTab("harian");
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  isActive
                    ? "border-indigo-500/60 bg-indigo-500/15"
                    : "border-hairline bg-canvas/50 hover:border-white/15"
                }`}
              >
                <div className="text-[11px] font-medium uppercase tracking-wider text-subtle">
                  {chip.label}
                </div>
                <div className={`mt-1 text-xl font-semibold tabular-nums ${chip.accent}`}>
                  {chip.val.toLocaleString("id-ID")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-hairline bg-surface p-1 md:grid-cols-4">
        {(
          [
            { id: "tren", label: "Tren & Jam", mobileLabel: "Tren & Jam", Icon: BarChart3, desktopOnly: true },
            { id: "harian", label: "Riwayat Tap", mobileLabel: "Riwayat", Icon: ListOrdered, desktopOnly: false },
            { id: "bulanan", label: "Leaderboard", mobileLabel: "Peringkat", Icon: Trophy, desktopOnly: false },
            { id: "tidur", label: "Belum Ada Tap", mobileLabel: "Pasif", Icon: Moon, count: sleepingCards.length, desktopOnly: false },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`${
                tab.desktopOnly ? "hidden md:inline-flex" : "inline-flex"
              } min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors sm:px-3 ${
                isActive
                  ? tab.id === "tidur"
                    ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40"
                    : "bg-indigo-600 text-white"
                  : "text-subtle hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate sm:hidden">{tab.mobileLabel}</span>
              <span className="hidden truncate sm:inline">{tab.label}</span>
              {"count" in tab && tab.count > 0 && (
                <span className="rounded-full bg-rose-500/25 px-1.5 py-0.5 text-[10px] tabular-nums text-rose-200">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari toko atau kode..."
            className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-9 pr-8 text-sm text-ink outline-none placeholder:text-muted focus:border-indigo-500/70"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {activeTab === "harian" && (
          <div className="relative flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => {
                if (datePickerRef.current?.showPicker) datePickerRef.current.showPicker();
                else datePickerRef.current?.focus();
              }}
              className={`inline-flex h-[42px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                customDate
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-hairline bg-surface text-ink hover:border-white/20"
              }`}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {customDate ? (
                <span>{formatDateShortIndo(customDate)}</span>
              ) : (
                <>
                  <span className="sm:hidden">Tanggal</span>
                  <span className="hidden sm:inline">Pilih Tanggal</span>
                </>
              )}
            </button>
            <input
              ref={datePickerRef}
              type="date"
              value={customDate}
              min={earliestAssignedDate ? toDateInputValue(earliestAssignedDate) : undefined}
              max={toDateInputValue(new Date())}
              onChange={(e) => {
                setCustomDate(e.target.value);
                if (e.target.value) {
                  setDailyMode("custom");
                  setTapDisplayLimit(10);
                }
              }}
              className="pointer-events-none absolute inset-0 opacity-0"
            />
            {customDate && (
              <button
                type="button"
                onClick={() => {
                  setCustomDate("");
                  setDailyMode("today");
                }}
                className="ml-1.5 rounded-lg border border-hairline bg-surface p-2.5 text-subtle hover:text-ink"
                title="Hapus filter tanggal"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-hairline bg-surface" />
          ))}
        </div>
      ) : activeTab === "tren" && isDesktop ? (
        <div className="hidden md:block">
          <TrendsTab
            storeFilteredLogs={storeFilteredLogs}
            activeCardMap={activeCardMap}
            earliestAssignedDate={earliestAssignedDate}
            monthsByYear={monthsByYear}
            thisMonthKey={thisMonthKey}
          />
        </div>
      ) : activeTab === "harian" || (activeTab === "tren" && !isDesktop) ? (
        <TapFeedTab
          dailyMode={dailyMode}
          customDate={customDate}
          search={search}
          onClearSearch={() => {
            setSearch("");
            setTapDisplayLimit(10);
          }}
          onShowAllPeriod={() => {
            setDailyMode("all");
            setCustomDate("");
            setTapDisplayLimit(10);
          }}
          onOpenSleepingTab={() => setActiveTab("tidur")}
          activePeriodInfo={activePeriodInfo}
          filteredTotalCount={storeFilteredLogs.length}
          tapDisplayLimit={tapDisplayLimit}
          onSetTapDisplayLimit={setTapDisplayLimit}
          activeCardMap={activeCardMap}
          cardUrlMap={cardUrlMap}
          cafeBreakdownList={cafeBreakdownList}
          availableStoresCount={availableStores.length}
          cards={cards}
          sleepingCardsCount={sleepingCards.length}
        />
      ) : activeTab === "bulanan" ? (
        <LeaderboardTab
          selectedMonthKey={selectedMonthKey}
          thisMonthKey={thisMonthKey}
          onSelectMonth={setSelectedMonth}
          monthsByYear={monthsByYear}
          selectedMonthGroup={selectedMonthGroup}
          tapsByStoreMonth={tapsByStoreMonth}
          search={search}
        />
      ) : (
        <IdleCardsTab
          sleepingPeriod={sleepingPeriod}
          sleepingCards={sleepingCards}
          validLogs={validLogs}
        />
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-elevated text-ink shadow-xl transition-colors hover:border-white/25 md:bottom-6"
          aria-label="Kembali ke atas"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

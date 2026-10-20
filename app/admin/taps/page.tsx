"use client";

import { useEffect, useState, useMemo } from "react";

type TapLogEntry = {
  code: string;
  storeName: string;
  tappedAt: string;
};

type CardRecord = {
  code: string;
  storeName: string;
  tapCount?: number;
  createdAt: string;
};

// ── SVG Bar Chart (pure, no library) ─────────────────────────────────
function BarChart({
  data,
  color = "#F59E0B",
  labelEvery = 1,
  showValue = true,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  color?: string;
  labelEvery?: number;
  showValue?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 800;
  const H = 180;
  const PAD_B = 28;
  const PAD_T = 18;
  const chartH = H - PAD_B - PAD_T;
  const totalW = W - 20;
  const slotW = totalW / data.length;
  const barW = Math.max(Math.floor(slotW * 0.7), 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={10} y1={PAD_T + chartH * (1 - f)}
          x2={W - 10} y2={PAD_T + chartH * (1 - f)}
          stroke="rgba(255,255,255,0.05)" strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * chartH, d.value > 0 ? 2 : 0);
        const x = 10 + i * slotW + (slotW - barW) / 2;
        const y = PAD_T + chartH - barH;
        const isHighlight = d.highlight;
        const barColor = isHighlight ? "#34D399" : d.value === 0 ? "rgba(255,255,255,0.06)" : color;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={barColor} />
            {showValue && d.value > 0 && (
              <text x={x + barW / 2} y={y - 5} fill="#F0F0FF" fontSize={9} textAnchor="middle">
                {d.value}
              </text>
            )}
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - 4} fill="#5A5A72" fontSize={9} textAnchor="middle">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function TapsPage() {
  const [logs, setLogs] = useState<TapLogEntry[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"harian" | "bulanan" | "tren" | "tidur">("harian");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedStore, setExpandedStore] = useState<string | null>(null); // "monthKey::storeName"

  async function fetchData() {
    setLoading(true);
    try {
      const [tapRes, cardRes] = await Promise.all([
        fetch("/api/admin/taps?limit=200"),
        fetch("/api/admin/codes"),
      ]);
      if (tapRes.ok) setLogs((await tapRes.json()).logs ?? []);
      if (cardRes.ok) setCards((await cardRes.json()).cards ?? []);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (activeTab === "bulanan" && logs.length > 0) {
      setExpandedMonth(getMonthKey(new Date().toISOString()));
    }
    // Reset store detail dropdown when switching tabs
    setExpandedStore(null);
  }, [activeTab, logs]);

  // ── Helpers ──────────────────────────────────────────────────────────
  function getMonthKey(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function formatMonthLabel(key: string) {
    const [y, m] = key.split("-");
    return new Date(parseInt(y), parseInt(m) - 1, 1)
      .toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }
  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} jam lalu`;
    const days = Math.floor(hrs / 24);
    return days < 7 ? `${days} hari lalu` : new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }
  function formatFull(iso: string) {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }
  function formatDayHeader(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Hari Ini";
    if (d.toDateString() === yesterday.toDateString()) return "Kemarin";
    return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  // ── Derived data ──────────────────────────────────────────────────────
  const thisMonthKey = getMonthKey(new Date().toISOString());
  const lastMonthKey = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return getMonthKey(d.toISOString());
  })();

  // Stats
  const thisMonthCount = useMemo(() => logs.filter(l => getMonthKey(l.tappedAt) === thisMonthKey).length, [logs]);

  // Tab: Harian
  const filtered = useMemo(() => logs.filter(l => l.storeName.toLowerCase().includes(search.toLowerCase())), [logs, search]);
  type DayGroup = { dayKey: string; label: string; entries: TapLogEntry[] };
  const grouped = useMemo(() => {
    const groups: DayGroup[] = [];
    for (const entry of filtered) {
      const dayKey = new Date(entry.tappedAt).toDateString();
      const last = groups[groups.length - 1];
      if (!last || last.dayKey !== dayKey) groups.push({ dayKey, label: formatDayHeader(entry.tappedAt), entries: [entry] });
      else last.entries.push(entry);
    }
    return groups;
  }, [filtered]);

  // Tab: Bulanan
  type MonthGroup = { monthKey: string; label: string; total: number; byStore: { storeName: string; count: number; lastMonthCount: number }[] };
  const monthlyGroups = useMemo((): MonthGroup[] => {
    const map = new Map<string, Map<string, number>>();
    for (const entry of logs) {
      const mk = getMonthKey(entry.tappedAt);
      if (!map.has(mk)) map.set(mk, new Map());
      const sm = map.get(mk)!;
      sm.set(entry.storeName, (sm.get(entry.storeName) ?? 0) + 1);
    }
    const lastMonthMap = map.get(lastMonthKey) ?? new Map<string, number>();
    const sorted = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    return sorted.map(([monthKey, sm]) => {
      const byStore = Array.from(sm.entries())
        .map(([storeName, count]) => ({
          storeName, count,
          lastMonthCount: monthKey === thisMonthKey ? (lastMonthMap.get(storeName) ?? 0) : 0,
        }))
        .sort((a, b) => b.count - a.count);
      return { monthKey, label: formatMonthLabel(monthKey), total: byStore.reduce((s, x) => s + x.count, 0), byStore };
    });
  }, [logs]);

  // Detail taps per store per month (for dropdown)
  const tapsByStoreMonth = useMemo(() => {
    const map = new Map<string, TapLogEntry[]>(); // key: "monthKey::storeName"
    for (const entry of logs) {
      const mk = getMonthKey(entry.tappedAt);
      const key = `${mk}::${entry.storeName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    // Sort each list newest first
    map.forEach((arr) => arr.sort((a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime()));
    return map;
  }, [logs]);

  const filteredMonthly = useMemo(() =>
    monthlyGroups.map(mg => ({
      ...mg,
      byStore: mg.byStore.filter(s => s.storeName.toLowerCase().includes(search.toLowerCase())),
      total: mg.byStore.filter(s => s.storeName.toLowerCase().includes(search.toLowerCase())).reduce((s, x) => s + x.count, 0),
    })).filter(mg => mg.byStore.length > 0),
    [monthlyGroups, search]
  );

  // Tab: Tren — last 30 days
  const trendData = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const count = logs.filter(l => { const t = new Date(l.tappedAt); return t >= d && t < next; }).length;
      const label = i === 0 ? "Hari ini" : i % 7 === 0 ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "";
      days.push({ label, value: count });
    }
    return days;
  }, [logs]);

  // Tab: Tren — peak hours
  const hourData = useMemo(() => {
    const counts = Array(24).fill(0);
    logs.forEach(l => { counts[new Date(l.tappedAt).getHours()]++; });
    const maxH = Math.max(...counts);
    return counts.map((v, i) => ({
      label: i % 4 === 0 ? `${String(i).padStart(2, "0")}.00` : "",
      value: v,
      highlight: v === maxH && maxH > 0,
    }));
  }, [logs]);

  const peakHour = useMemo(() => {
    const counts = Array(24).fill(0);
    logs.forEach(l => { counts[new Date(l.tappedAt).getHours()]++; });
    const max = Math.max(...counts);
    if (max === 0) return null;
    const h = counts.indexOf(max);
    return { hour: h, count: max, label: `${String(h).padStart(2, "0")}.00–${String(h + 1).padStart(2, "0")}.00` };
  }, [logs]);

  // Tab: Kartu Tidur — cards not in tap log
  const tappedCodes = useMemo(() => new Set(logs.map(l => l.code)), [logs]);
  const sleepingCards = useMemo(() =>
    cards.filter(c => !tappedCodes.has(c.code) && c.storeName.toLowerCase().includes(search.toLowerCase())),
    [cards, tappedCodes, search]
  );
  const activeCards = useMemo(() =>
    cards.filter(c => tappedCodes.has(c.code)),
    [cards, tappedCodes]
  );

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0A0A0F; color: #F0F0FF; font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

    /* ── Layout ── */
    .pw { max-width: 860px; margin: 0 auto; padding: 18px 14px 80px; }
    .back { display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 8px; color: #C0C0D8; text-decoration: none; font-size: 0.78rem; font-weight: 500; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
    .back:hover { background: rgba(255,255,255,0.09); color: #F0F0FF; }

    /* ── Stats ── */
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
    .sc { background: #111118; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 12px 14px; }
    .sv { font-size: 1.35rem; font-weight: 800; margin-bottom: 3px; line-height: 1; }
    .sl { font-size: 0.62rem; color: #5A5A72; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; line-height: 1.3; }

    /* ── Tabs: horizontal scroll on mobile ── */
    .tabs-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 16px; }
    .tabs-scroll::-webkit-scrollbar { display: none; }
    .tabs { display: inline-flex; gap: 4px; padding-bottom: 10px; white-space: nowrap; min-width: 100%; }
    .tab { padding: 7px 13px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; background: transparent; color: #9A9AB0; border: 1px solid transparent; transition: all 0.2s; font-family: inherit; white-space: nowrap; }
    .tab.act { background: rgba(245,158,11,0.12); color: #FCD34D; border-color: rgba(245,158,11,0.3); }
    .tab.act-red { background: rgba(239,68,68,0.1); color: #FCA5A5; border-color: rgba(239,68,68,0.25); }
    .tab:hover:not(.act):not(.act-red) { color: #F0F0FF; background: rgba(255,255,255,0.05); }

    /* ── Toolbar ── */
    .toolbar { display: flex; gap: 8px; margin-bottom: 20px; align-items: center; }
    .sbx { flex: 1; min-width: 0; padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #F0F0FF; font-size: 0.85rem; outline: none; font-family: inherit; transition: border-color .2s; }
    .sbx:focus { border-color: rgba(245,158,11,.5); }
    .last-refresh { font-size: 0.68rem; color: #5A5A72; white-space: nowrap; flex-shrink: 0; }
    .refresh-btn { display: inline-flex; align-items: center; gap: 5px; padding: 9px 13px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px; color: #FCD34D; font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
    .refresh-btn:hover { background: rgba(245,158,11,0.18); }
    .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Harian ── */
    .day-header { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #5A5A72; padding: 14px 0 7px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    .day-count-badge { background: rgba(245,158,11,0.12); color: #FCD34D; border: 1px solid rgba(245,158,11,0.25); padding: 2px 8px; border-radius: 999px; font-size: 0.65rem; font-weight: 700; }
    .day-group { margin-bottom: 6px; }
    .tap-item { display: flex; align-items: center; gap: 10px; padding: 11px 13px; background: #111118; border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid #F59E0B; border-radius: 0 10px 10px 0; margin-bottom: 5px; transition: border-left-color 0.2s; }
    .tap-item:hover { border-left-color: #FCD34D; }
    .tap-icon { width: 32px; height: 32px; border-radius: 9px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0; }
    .tap-info { flex: 1; min-width: 0; }
    .tap-store { font-size: 0.88rem; font-weight: 700; color: #F0F0FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tap-time { font-size: 0.7rem; color: #6A6A82; margin-top: 2px; line-height: 1.4; }
    .tap-badge { font-size: 0.68rem; color: #FCD34D; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); padding: 3px 8px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }

    /* ── Bulanan ── */
    .month-card { background: #111118; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; margin-bottom: 10px; overflow: hidden; transition: border-color 0.2s; }
    .month-card:hover { border-color: rgba(245,158,11,0.2); }
    .month-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; cursor: pointer; gap: 10px; user-select: none; }
    .month-title { font-size: 0.95rem; font-weight: 700; color: #F0F0FF; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
    .bulan-ini-badge { font-size: 0.62rem; background: rgba(245,158,11,0.15); color: #FCD34D; border: 1px solid rgba(245,158,11,0.3); border-radius: 999px; padding: 2px 7px; font-weight: 600; flex-shrink: 0; }
    .month-sub { font-size: 0.68rem; color: #5A5A72; margin-top: 3px; }
    .month-total { font-size: 1.05rem; font-weight: 800; color: #FCD34D; white-space: nowrap; }
    .chevron { font-size: 0.75rem; color: #5A5A72; transition: transform 0.2s; display: inline-block; flex-shrink: 0; }
    .chevron.open { transform: rotate(180deg); }
    .month-body { padding: 0 16px 14px; border-top: 1px solid rgba(255,255,255,0.05); }

    /* ── Store row ── */
    .store-row { display: flex; align-items: center; gap: 8px; padding: 9px 6px; margin: 0 -6px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; border-radius: 6px; transition: background 0.15s; user-select: none; }
    .store-row:last-of-type { border-bottom: none; }
    .store-row:hover { background: rgba(255,255,255,0.04); }
    .store-rank { font-size: 0.7rem; font-weight: 700; color: #5A5A72; width: 20px; text-align: center; flex-shrink: 0; }
    .store-name { flex: 1; font-size: 0.85rem; font-weight: 600; color: #E0E0F0; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .store-bar-wrap { width: 80px; flex-shrink: 0; }
    .store-bar-bg { background: rgba(255,255,255,0.05); border-radius: 999px; height: 4px; overflow: hidden; }
    .store-bar-fill { background: linear-gradient(90deg, #F59E0B, #FCD34D); border-radius: 999px; height: 4px; transition: width 0.4s ease; }
    .store-count { font-size: 0.8rem; font-weight: 700; color: #FCD34D; width: 26px; text-align: right; flex-shrink: 0; }
    .delta-pos { font-size: 0.65rem; color: #34D399; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); padding: 1px 5px; border-radius: 999px; flex-shrink: 0; white-space: nowrap; }
    .delta-neg { font-size: 0.65rem; color: #FCA5A5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); padding: 1px 5px; border-radius: 999px; flex-shrink: 0; white-space: nowrap; }
    .delta-zero { font-size: 0.65rem; color: #5A5A72; padding: 1px 5px; flex-shrink: 0; }
    .store-chevron { font-size: 0.68rem; flex-shrink: 0; transition: transform 0.2s; display: inline-block; }

    /* ── Store detail dropdown ── */
    .store-detail { background: rgba(245,158,11,0.04); border: 1px solid rgba(245,158,11,0.15); border-radius: 10px; margin: 2px 0 10px; padding: 10px 12px; animation: fadeIn 0.18s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .detail-header { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #F59E0B; margin-bottom: 8px; }
    /* Grid layout: num | info | ago — stacks cleanly on narrow screens */
    .detail-tap-item { display: grid; grid-template-columns: 20px 1fr auto; align-items: start; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04); gap: 6px; }
    .detail-tap-item:last-child { border-bottom: none; }
    .detail-tap-num { font-size: 0.68rem; color: #5A5A72; font-weight: 700; padding-top: 1px; }
    .detail-tap-info { min-width: 0; }
    .detail-tap-date { font-size: 0.78rem; color: #C0C0D8; font-weight: 500; }
    .detail-tap-time { font-size: 0.72rem; color: #FCD34D; font-weight: 600; margin-top: 2px; }
    .detail-tap-ago { font-size: 0.65rem; color: #5A5A72; white-space: nowrap; padding-top: 2px; text-align: right; }

    /* ── Charts ── */
    .chart-card { background: #111118; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px; margin-bottom: 14px; }
    .chart-title { font-size: 0.88rem; font-weight: 700; color: #F0F0FF; margin-bottom: 3px; }
    .chart-sub { font-size: 0.72rem; color: #5A5A72; margin-bottom: 14px; }
    .insight-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .insight-pill { padding: 7px 12px; border-radius: 9px; font-size: 0.78rem; font-weight: 600; }

    /* ── Kartu Tidur ── */
    .sleep-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #111118; border: 1px solid rgba(239,68,68,0.15); border-left: 3px solid #EF4444; border-radius: 0 10px 10px 0; margin-bottom: 5px; }
    .sleep-icon { width: 32px; height: 32px; border-radius: 9px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0; }
    .sleep-name { font-size: 0.88rem; font-weight: 700; color: #F0F0FF; }
    .sleep-sub { font-size: 0.68rem; color: #6A6A82; margin-top: 2px; }
    .badge-sleep { font-size: 0.68rem; color: #FCA5A5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); padding: 3px 8px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }

    /* ── Misc ── */
    .empty { text-align: center; padding: 50px 20px; color: #5A5A72; }
    .empty-icon { font-size: 2.8rem; margin-bottom: 14px; }
    .sep { text-align: center; font-size: 0.72rem; color: #5A5A72; margin-top: 24px; line-height: 1.6; }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      .store-bar-wrap { width: 54px; }
      .insight-pill { font-size: 0.74rem; padding: 6px 10px; }
    }
    @media (max-width: 420px) {
      .sv { font-size: 1.1rem; }
      .sl { font-size: 0.58rem; }
      .last-refresh { display: none; }
      .store-bar-wrap { display: none; }
      .detail-tap-date { font-size: 0.72rem; }
    }
  `;

  const Separator = () => (
    <p className="sep">
      Data dari {logs.length} tap tersimpan · tracking aktif sejak fitur ini di-deploy
    </p>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ background: "#0A0A0F", minHeight: "100vh" }}>
        <div className="pw">

          {/* ── Header ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 800, lineHeight: 1.2 }}>📲 Riwayat Tap</h1>
              <p style={{ color: "#9A9AB0", fontSize: "0.75rem", marginTop: 3 }}>Pantau aktivitas tap kartu NFC/QR — harian, bulanan, analitik.</p>
            </div>
            <a href="/admin" className="back">← Dashboard</a>
          </div>

          {/* ── Stats ── */}
          <div className="stats">
            <div className="sc">
              <div className="sv" style={{ color: "#FCD34D" }}>{logs.length}</div>
              <div className="sl">📲 Total Tap</div>
            </div>
            <div className="sc">
              <div className="sv" style={{ color: "#34D399" }}>{thisMonthCount}</div>
              <div className="sl">📅 Bulan Ini</div>
            </div>
            <div className="sc">
              <div className="sv" style={{ color: sleepingCards.length > 0 ? "#FCA5A5" : "#A5B4FC" }}>
                {sleepingCards.length}
              </div>
              <div className="sl">😴 Kartu Tidur</div>
            </div>
          </div>

          {/* ── Tabs: scrollable on mobile ── */}
          <div className="tabs-scroll">
            <div className="tabs">
              <button className={`tab ${activeTab === "harian" ? "act" : ""}`} onClick={() => setActiveTab("harian")}>
                📋 Harian
              </button>
              <button className={`tab ${activeTab === "bulanan" ? "act" : ""}`} onClick={() => setActiveTab("bulanan")}>
                📊 Per Bulan
              </button>
              <button className={`tab ${activeTab === "tren" ? "act" : ""}`} onClick={() => setActiveTab("tren")}>
                📈 Tren &amp; Jam Ramai
              </button>
              <button
                className={`tab ${activeTab === "tidur" ? "act-red" : ""}`}
                onClick={() => setActiveTab("tidur")}
              >
                ⚠️ Kartu Tidur{sleepingCards.length > 0 ? ` (${sleepingCards.length})` : ""}
              </button>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="toolbar">
            <input
              type="text"
              className="sbx"
              placeholder="🔍 Cari nama cafe..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="last-refresh">
              {lastRefresh.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button className="refresh-btn" onClick={fetchData} disabled={loading}>
              {loading ? "⏳" : "🔄"} Refresh
            </button>
          </div>

          {/* ═══ TAB: HARIAN ═══ */}
          {activeTab === "harian" && (
            loading ? <div className="empty"><div className="empty-icon">⏳</div><p>Memuat...</p></div>
            : filtered.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">{search ? "🔍" : "📲"}</div>
                <p style={{ fontWeight: 600, color: "#9A9AB0", marginBottom: 8 }}>
                  {search ? "Tidak ada hasil." : "Belum ada tap tercatat."}
                </p>
                <p style={{ fontSize: "0.82rem" }}>{search ? "Coba kata kunci lain." : "Tap pada kartu NFC/QR akan muncul di sini."}</p>
              </div>
            ) : (
              <div>
                {grouped.map((group) => (
                  <div key={group.dayKey} className="day-group">
                    <div className="day-header">{group.label} · {group.entries.length} tap</div>
                    {group.entries.map((log, i) => (
                      <div key={`${log.code}-${log.tappedAt}-${i}`} className="tap-item">
                        <div className="tap-icon">📲</div>
                        <div className="tap-info">
                          <div className="tap-store">{log.storeName}</div>
                          <div className="tap-time">{formatFull(log.tappedAt)}</div>
                        </div>
                        <span className="tap-badge">{timeAgo(log.tappedAt)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <Separator />
              </div>
            )
          )}

          {/* ═══ TAB: BULANAN ═══ */}
          {activeTab === "bulanan" && (
            loading ? <div className="empty"><div className="empty-icon">⏳</div><p>Memuat...</p></div>
            : filteredMonthly.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">{search ? "🔍" : "📊"}</div>
                <p style={{ fontWeight: 600, color: "#9A9AB0", marginBottom: 8 }}>{search ? "Tidak ada hasil." : "Belum ada data tap."}</p>
              </div>
            ) : (
              <div>
                {filteredMonthly.map((mg) => {
                  const isOpen = expandedMonth === mg.monthKey;
                  const isThisMonth = mg.monthKey === thisMonthKey;
                  const max = Math.max(...mg.byStore.map(s => s.count), 1);
                  return (
                    <div key={mg.monthKey} className="month-card" style={isThisMonth ? { borderColor: "rgba(245,158,11,0.35)" } : {}}>
                      <div className="month-header" onClick={() => { setExpandedMonth(isOpen ? null : mg.monthKey); setExpandedStore(null); }}>
                        <div>
                          <div className="month-title">
                            {isThisMonth && <span className="bulan-ini-badge">Bulan Ini</span>}
                            {mg.label}
                          </div>
                          <div className="month-sub">{mg.byStore.length} cafe · {mg.total} tap</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="month-total">{mg.total}×</div>
                          <span className={`chevron ${isOpen ? "open" : ""}`}>▼</span>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="month-body">
                          <div style={{ paddingTop: 12 }}>
                            {mg.byStore.map((s, idx) => {
                              const delta = s.lastMonthCount > 0 ? s.count - s.lastMonthCount : null;
                              const storeKey = `${mg.monthKey}::${s.storeName}`;
                              const isStoreOpen = expandedStore === storeKey;
                              const storeTaps = tapsByStoreMonth.get(storeKey) ?? [];
                              return (
                                <div key={s.storeName}>
                                  <div
                                    className="store-row"
                                    onClick={() => setExpandedStore(isStoreOpen ? null : storeKey)}
                                    title={isStoreOpen ? "Tutup detail" : "Lihat detail tap"}
                                  >
                                    <div className="store-rank">#{idx + 1}</div>
                                    <div className="store-name">{s.storeName}</div>
                                    <div className="store-bar-wrap">
                                      <div className="store-bar-bg">
                                        <div className="store-bar-fill" style={{ width: `${(s.count / max) * 100}%` }} />
                                      </div>
                                    </div>
                                    <div className="store-count">{s.count}×</div>
                                    {isThisMonth && (
                                      delta === null ? <span className="delta-zero">baru</span>
                                      : delta > 0 ? <span className="delta-pos">+{delta}</span>
                                      : delta < 0 ? <span className="delta-neg">{delta}</span>
                                      : <span className="delta-zero">±0</span>
                                    )}
                                    <span style={{ fontSize: "0.7rem", color: isStoreOpen ? "#FCD34D" : "#5A5A72", marginLeft: 4, transition: "transform 0.2s", display: "inline-block", transform: isStoreOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                                  </div>
                                  {isStoreOpen && (
                                    <div className="store-detail">
                                      <div className="detail-title">📋 Riwayat {storeTaps.length} tap — {s.storeName}</div>
                                      {storeTaps.map((tap, ti) => {
                                        const d = new Date(tap.tappedAt);
                                        const dateStr = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                                        const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                                        return (
                                          <div key={`${tap.tappedAt}-${ti}`} className="detail-tap-item">
                                            <span className="detail-tap-num">{ti + 1}.</span>
                                            <span className="detail-tap-date">{dateStr}</span>
                                            <span className="detail-tap-time">{timeStr}</span>
                                            <span className="detail-tap-ago">{timeAgo(tap.tappedAt)}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {isThisMonth && mg.byStore.some(s => s.lastMonthCount > 0) && (
                            <p style={{ fontSize: "0.7rem", color: "#5A5A72", marginTop: 10 }}>
                              * Delta +/− dibandingkan bulan lalu ({formatMonthLabel(lastMonthKey)})
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <Separator />
              </div>
            )
          )}

          {/* ═══ TAB: TREN & JAM RAMAI ═══ */}
          {activeTab === "tren" && (
            loading ? <div className="empty"><div className="empty-icon">⏳</div><p>Memuat...</p></div>
            : logs.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📈</div>
                <p style={{ fontWeight: 600, color: "#9A9AB0", marginBottom: 8 }}>Belum ada data tap.</p>
                <p style={{ fontSize: "0.82rem" }}>Grafik akan muncul setelah ada aktivitas tap.</p>
              </div>
            ) : (
              <>
                {/* Daily Trend */}
                <div className="chart-card">
                  <div className="chart-title">📈 Tren Tap 30 Hari Terakhir</div>
                  <div className="chart-sub">Jumlah tap per hari. Label muncul setiap 7 hari.</div>
                  <div className="insight-row">
                    <div className="insight-pill" style={{ background: "rgba(245,158,11,0.1)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.2)" }}>
                      Total: {trendData.reduce((s, d) => s + d.value, 0)} tap
                    </div>
                    <div className="insight-pill" style={{ background: "rgba(16,185,129,0.08)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}>
                      Hari ini: {trendData[trendData.length - 1].value} tap
                    </div>
                    <div className="insight-pill" style={{ background: "rgba(99,102,241,0.08)", color: "#A5B4FC", border: "1px solid rgba(99,102,241,0.2)" }}>
                      Rata-rata: {(trendData.reduce((s, d) => s + d.value, 0) / 30).toFixed(1)} tap/hari
                    </div>
                  </div>
                  <BarChart data={trendData} color="#F59E0B" labelEvery={7} showValue={false} />
                </div>

                {/* Peak Hours */}
                <div className="chart-card">
                  <div className="chart-title">🕐 Jam Paling Ramai</div>
                  <div className="chart-sub">Distribusi tap berdasarkan jam dalam sehari (semua waktu).</div>
                  {peakHour && (
                    <div className="insight-row">
                      <div className="insight-pill" style={{ background: "rgba(16,185,129,0.08)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}>
                        🏆 Puncak: {peakHour.label} ({peakHour.count} tap)
                      </div>
                      <div className="insight-pill" style={{ background: "rgba(245,158,11,0.08)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.2)" }}>
                        Aktif {hourData.filter(h => h.value > 0).length} jam dari 24 jam
                      </div>
                    </div>
                  )}
                  <BarChart data={hourData} color="#8B5CF6" labelEvery={1} showValue={false} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#5A5A72", marginTop: 4, paddingLeft: 10 }}>
                    <span>00.00</span><span>06.00</span><span>12.00</span><span>18.00</span><span>23.00</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: "0.72rem", color: "#5A5A72" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#34D399", flexShrink: 0 }} />
                    <span>Jam paling ramai</span>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#8B5CF6", flexShrink: 0, marginLeft: 8 }} />
                    <span>Jam aktif lainnya</span>
                  </div>
                </div>

                <Separator />
              </>
            )
          )}

          {/* ═══ TAB: KARTU TIDUR ═══ */}
          {activeTab === "tidur" && (
            loading ? <div className="empty"><div className="empty-icon">⏳</div><p>Memuat...</p></div>
            : (
              <>
                {/* Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <div className="sc" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
                    <div className="sv" style={{ color: "#FCA5A5" }}>{sleepingCards.length}</div>
                    <div className="sl">😴 Kartu Tidur</div>
                  </div>
                  <div className="sc" style={{ borderColor: "rgba(16,185,129,0.2)" }}>
                    <div className="sv" style={{ color: "#34D399" }}>{activeCards.length}</div>
                    <div className="sl">✅ Sudah Ada Tap</div>
                  </div>
                </div>

                <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: "0.8rem", color: "#FCD34D", lineHeight: 1.6 }}>
                  ℹ️ <strong>Catatan:</strong> &quot;Kartu Tidur&quot; = kartu yang belum pernah di-tap <em>sejak fitur tap log ini aktif</em>. Tap sebelumnya tidak terhitung. Data ini akan makin akurat seiring waktu.
                </div>

                {sleepingCards.length === 0 ? (
                  <div className="empty">
                    <div className="empty-icon">🎉</div>
                    <p style={{ fontWeight: 600, color: "#34D399", marginBottom: 8 }}>Semua kartu sudah aktif di-tap!</p>
                    <p style={{ fontSize: "0.82rem" }}>Tidak ada kartu yang tidur{search ? " untuk pencarian ini" : ""}.</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#5A5A72", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                      {sleepingCards.length} kartu belum ada tap tercatat
                    </div>
                    {sleepingCards.map((card) => (
                      <div key={card.code} className="sleep-item">
                        <div className="sleep-icon">😴</div>
                        <div className="tap-info">
                          <div className="sleep-name">{card.storeName}</div>
                          <div className="sleep-sub">
                            Kode: <span style={{ fontFamily: "monospace", color: "#A5B4FC" }}>{card.code}</span>
                            {" · "}Assign: {new Date(card.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                        <span className="badge-sleep">Belum ada tap</span>
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
              </>
            )
          )}

        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import AdminNav from "../components/AdminNav";
import { getPublicGoogleReviewUrl } from "../../../lib/redirect";

type TapLogEntry = {
  code: string;
  storeName: string;
  tappedAt: string;
};

type CardRecord = {
  code: string;
  storeName: string;
  googleReviewUrl?: string;
  tapCount?: number;
  createdAt: string;
};

// ── SVG Bar Chart (pure, high-DPI responsive) ───────────────────────
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
  const H = 190;
  const PAD_B = 30;
  const PAD_T = 20;
  const chartH = H - PAD_B - PAD_T;
  const totalW = W - 20;
  const slotW = totalW / data.length;
  const barW = Math.max(Math.floor(slotW * 0.72), 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={10} y1={PAD_T + chartH * (1 - f)}
          x2={W - 10} y2={PAD_T + chartH * (1 - f)}
          stroke="rgba(255,255,255,0.06)" strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * chartH, d.value > 0 ? 3 : 0);
        const x = 10 + i * slotW + (slotW - barW) / 2;
        const y = PAD_T + chartH - barH;
        const isHighlight = d.highlight;
        const barColor = isHighlight ? "#10B981" : d.value === 0 ? "rgba(255,255,255,0.05)" : color;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill={barColor} />
            {showValue && d.value > 0 && (
              <text x={x + barW / 2} y={y - 6} fill="#F0F0FF" fontSize={9.5} fontWeight={700} textAnchor="middle">
                {d.value}
              </text>
            )}
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - 5} fill="#7A7A95" fontSize={9} fontWeight={500} textAnchor="middle">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── TapItem — shared item row ──────────────────────────────────────────
function TapItem({ log, reviewUrl, accentColor = "#34D399", timeAgo, formatFull }: {
  log: TapLogEntry;
  reviewUrl?: string;
  accentColor?: string;
  timeAgo: (iso: string) => string;
  formatFull: (iso: string) => string;
}) {
  const d = new Date(log.tappedAt);
  const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "12px 16px",
      background: "#111118",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      borderLeft: `4px solid ${accentColor}`,
      flexWrap: "wrap",
      transition: "background 0.15s",
    }}>
      {/* Kolom Kiri: Jam Tap Tegas + Nama Toko & Kode */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 230px" }}>
        {/* Badge Jam Tap Sangat Menonjol */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: "5px 8px",
            textAlign: "center",
            flexShrink: 0,
            minWidth: 54,
          }}
          title={formatFull(log.tappedAt)}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#F0F0FF", fontFamily: "monospace", lineHeight: 1.1 }}>
            {timeStr}
          </div>
          <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase" }}>
            {dateStr}
          </div>
        </div>

        {/* Info Toko & Kode */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "#F0F0FF", fontSize: "0.92rem", wordBreak: "break-word" }}>
              {log.storeName}
            </span>
            <span style={{
              fontFamily: "monospace", fontSize: "0.68rem", fontWeight: 700,
              color: "#818CF8", background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              padding: "1px 6px", borderRadius: 5, flexShrink: 0,
            }}>
              {log.code}
            </span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "#7A7A95", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🕒 {timeAgo(log.tappedAt)}</span>
          </div>
        </div>
      </div>

      {/* Kolom Kanan: Tombol Menu Ulasan */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
        {reviewUrl && (
          <a
            href={reviewUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: "0.74rem", fontWeight: 700, color: "#FCD34D",
              background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
              padding: "6px 12px", borderRadius: 8, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}
            title="Buka ulasan Google toko ini di browser"
          >
            <span>⭐</span> Menu Ulasan ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── Collapsible period section ─────────────────────────────────────────
function PeriodSection({
  title,
  entries,
  defaultOpen = true,
  accentColor = "#F59E0B",
  cardUrlMap,
  formatFull,
  timeAgo,
}: {
  title: string;
  entries: TapLogEntry[];
  defaultOpen?: boolean;
  accentColor?: string;
  cardUrlMap: Map<string, string>;
  formatFull: (iso: string) => string;
  timeAgo: (iso: string) => string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (entries.length === 0) return null;

  return (
    <div style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px",
          background: "#13131C",
          border: "none",
          borderLeft: `4px solid ${accentColor}`,
          cursor: "pointer", color: "#F0F0FF", fontFamily: "inherit",
          transition: "background 0.15s",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: accentColor, flexShrink: 0, boxShadow: `0 0 8px ${accentColor}99`,
          }} />
          <span style={{ fontSize: "0.82rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#E0E0F0" }}>
            {title}
          </span>
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: "0.74rem", fontWeight: 800,
            color: accentColor,
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}40`,
            padding: "3px 10px", borderRadius: 999,
          }}>
            {entries.length} TAP
          </span>
          <span style={{
            fontSize: "0.72rem", color: "#7A7A95",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s", display: "inline-block",
          }}>▼</span>
        </span>
      </button>

      {open && (
        <div style={{ background: "#0E0E16" }}>
          {entries.map((log, i) => (
            <TapItem
              key={`${log.code}-${log.tappedAt}-${i}`}
              log={log}
              reviewUrl={cardUrlMap.get(log.code) || (log.storeName ? getPublicGoogleReviewUrl("", log.storeName) : "")}
              accentColor={accentColor}
              timeAgo={timeAgo}
              formatFull={formatFull}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function TapsPage() {
  const [logs, setLogs] = useState<TapLogEntry[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(30);
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"harian" | "bulanan" | "tren" | "tidur">("harian");
  const [dailyMode, setDailyMode] = useState<"today" | "yesterday" | "last7" | "all" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [newTapAlert, setNewTapAlert] = useState<TapLogEntry | null>(null);
  const lastKnownTapRef = useRef<string | null>(null);

  async function fetchData(isBackground = false) {
    if (!isBackground) setLoading(true);
    else setIsUpdating(true);

    try {
      const [tapRes, cardRes] = await Promise.all([
        fetch("/api/admin/taps?limit=5000"),
        fetch("/api/admin/codes"),
      ]);
      if (tapRes.ok) {
        const tapData = await tapRes.json();
        const incomingLogs: TapLogEntry[] = tapData.logs ?? [];
        setLogs(incomingLogs);

        // Check if there is a brand new tap arrived during background auto-refresh
        if (incomingLogs.length > 0) {
          const newest = incomingLogs[0];
          if (isBackground && lastKnownTapRef.current && newest.tappedAt !== lastKnownTapRef.current) {
            setNewTapAlert(newest);
            try {
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([60, 40, 60]);
            } catch {}
          }
          lastKnownTapRef.current = newest.tappedAt;
        }
      }
      if (cardRes.ok) setCards((await cardRes.json()).cards ?? []);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }

  useEffect(() => {
    fetchData(false);
  }, []);

  useEffect(() => {
    if (autoRefreshSec <= 0) return;
    const timer = setInterval(() => {
      fetchData(true);
    }, autoRefreshSec * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshSec]);

  function exportCSV() {
    const rows = [
      ["Kode Kartu", "Nama Toko", "Waktu Tap (ISO)", "Tanggal", "Jam"],
      ...validLogs.map(l => {
        const d = new Date(l.tappedAt);
        return [
          l.code,
          `"${l.storeName.replace(/"/g, '""')}"`,
          l.tappedAt,
          d.toLocaleDateString("id-ID"),
          d.toLocaleTimeString("id-ID"),
        ];
      })
    ];
    const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Laporan_Tap_Google_Review_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

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
  function toDateInputValue(d: Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function matchesDate(iso: string, targetYmd: string) {
    const d = new Date(iso);
    return toDateInputValue(d) === targetYmd;
  }
  function formatDateIndo(dateInput: string | Date) {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins}m lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}j lalu`;
    const days = Math.floor(hrs / 24);
    return days < 7 ? `${days} hari lalu` : new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }
  function formatFull(iso: string) {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  // ── CRITICAL FIX: Filter out any logs from deleted cards! ───────────
  // Active cards are the single source of truth.
  const activeCardMap = useMemo(() => new Map(cards.map(c => [c.code, c.storeName])), [cards]);
  const activeCodesSet = useMemo(() => new Set(cards.map(c => c.code)), [cards]);
  const cardUrlMap = useMemo(() => new Map(cards.map(c => [c.code, getPublicGoogleReviewUrl(c.googleReviewUrl || "", c.storeName)])), [cards]);

  const validLogs = useMemo(() => {
    // If cards have loaded, only keep logs whose code exists in active cards
    if (cards.length === 0) return logs;
    return logs
      .filter(l => activeCodesSet.has(l.code))
      .map(l => ({
        ...l,
        storeName: activeCardMap.get(l.code) || l.storeName,
      }));
  }, [logs, cards, activeCodesSet, activeCardMap]);

  const thisMonthKey = getMonthKey(new Date().toISOString());
  const lastMonthKey = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return getMonthKey(d.toISOString());
  })();

  useEffect(() => {
    if (activeTab === "bulanan" && validLogs.length > 0) {
      setExpandedMonth(getMonthKey(new Date().toISOString()));
    }
    setExpandedStore(null);
  }, [activeTab, validLogs]);

  // Stats (Using validLogs only)
  const todayCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return validLogs.filter(l => new Date(l.tappedAt).toDateString() === todayStr).length;
  }, [validLogs]);

  const thisMonthCount = useMemo(() => validLogs.filter(l => getMonthKey(l.tappedAt) === thisMonthKey).length, [validLogs, thisMonthKey]);

  // ── Harian: split by period ──────────────────────────────────────────
  const filtered = useMemo(() => validLogs.filter(l =>
    l.storeName.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  ), [validLogs, search]);

  const customDateEntries = useMemo(() => {
    if (!customDate) return [];
    return filtered.filter(l => matchesDate(l.tappedAt, customDate));
  }, [filtered, customDate]);

  const hariianPeriods = useMemo(() => {
    const now = new Date();
    const todayYmd = toDateInputValue(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yestYmd = toDateInputValue(yesterday);

    const cutoff7 = new Date(now);
    cutoff7.setDate(now.getDate() - 7);
    cutoff7.setHours(0, 0, 0, 0);

    const today: TapLogEntry[] = [];
    const yest: TapLogEntry[] = [];
    const last7: TapLogEntry[] = [];
    const older: TapLogEntry[] = [];

    for (const entry of filtered) {
      const d = new Date(entry.tappedAt);
      const ymd = toDateInputValue(d);
      if (ymd === todayYmd) {
        today.push(entry);
      } else if (ymd === yestYmd) {
        yest.push(entry);
      } else if (d >= cutoff7) {
        last7.push(entry);
      } else {
        older.push(entry);
      }
    }
    return { today, yest, last7, older };
  }, [filtered]);

  // ── Tab: Bulanan (Leaderboard Tanpa Kartu Terhapus) ───────────────────
  type MonthGroup = {
    monthKey: string;
    label: string;
    total: number;
    byStore: { storeName: string; code: string; count: number; lastMonthCount: number }[];
  };

  const monthlyGroups = useMemo((): MonthGroup[] => {
    // Map: monthKey -> (storeName -> count & latest code)
    const map = new Map<string, Map<string, { count: number; code: string }>>();
    for (const entry of validLogs) {
      const mk = getMonthKey(entry.tappedAt);
      if (!map.has(mk)) map.set(mk, new Map());
      const sm = map.get(mk)!;
      const current = sm.get(entry.storeName) || { count: 0, code: entry.code };
      sm.set(entry.storeName, { count: current.count + 1, code: entry.code });
    }

    const lastMonthMap = map.get(lastMonthKey) ?? new Map<string, { count: number; code: string }>();
    const sorted = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    return sorted.map(([monthKey, sm]) => {
      const byStore = Array.from(sm.entries())
        .map(([storeName, info]) => ({
          storeName,
          code: info.code,
          count: info.count,
          lastMonthCount: monthKey === thisMonthKey ? (lastMonthMap.get(storeName)?.count ?? 0) : 0,
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
    }
    map.forEach((arr) => arr.sort((a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime()));
    return map;
  }, [validLogs]);

  const filteredMonthly = useMemo(() =>
    monthlyGroups.map(mg => {
      const matchingStores = mg.byStore.filter(s =>
        s.storeName.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())
      );
      return {
        ...mg,
        byStore: matchingStores,
        total: matchingStores.reduce((s, x) => s + x.count, 0),
      };
    }).filter(mg => mg.byStore.length > 0),
    [monthlyGroups, search]
  );

  const selectedMonthKey = selectedMonth || thisMonthKey;
  const pastMonths = useMemo(() => {
    return monthlyGroups.filter(mg => mg.monthKey !== thisMonthKey);
  }, [monthlyGroups, thisMonthKey]);

  const selectedMonthGroup = useMemo(() => {
    return (
      filteredMonthly.find(mg => mg.monthKey === selectedMonthKey) ||
      monthlyGroups.find(mg => mg.monthKey === selectedMonthKey) ||
      null
    );
  }, [filteredMonthly, monthlyGroups, selectedMonthKey]);

  const isCurrentSelected = selectedMonthKey === thisMonthKey;

  // ── Tab: Tren ────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const count = validLogs.filter(l => { const t = new Date(l.tappedAt); return t >= d && t < next; }).length;
      const label = i === 0 ? "Hari ini" : i % 7 === 0 ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "";
      days.push({ label, value: count });
    }
    return days;
  }, [validLogs]);

  const hourData = useMemo(() => {
    const counts = Array(24).fill(0);
    validLogs.forEach(l => { counts[new Date(l.tappedAt).getHours()]++; });
    const maxH = Math.max(...counts);
    return counts.map((v, i) => ({
      label: i % 4 === 0 ? `${String(i).padStart(2, "0")}.00` : "",
      value: v,
      highlight: v === maxH && maxH > 0,
    }));
  }, [validLogs]);

  const peakHour = useMemo(() => {
    const counts = Array(24).fill(0);
    validLogs.forEach(l => { counts[new Date(l.tappedAt).getHours()]++; });
    const max = Math.max(...counts);
    if (max === 0) return null;
    const h = counts.indexOf(max);
    return { hour: h, count: max, label: `${String(h).padStart(2, "0")}.00–${String(h + 1).padStart(2, "0")}.00` };
  }, [validLogs]);

  // ── Tab: Kartu Tidur (Belum Pernah Tap) ──────────────────────────────
  const tappedCodes = useMemo(() => new Set(validLogs.map(l => l.code)), [validLogs]);
  const sleepingCards = useMemo(() =>
    cards.filter(c => !tappedCodes.has(c.code) && (
      c.storeName.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
    )),
    [cards, tappedCodes, search]
  );
  const activeCards = useMemo(() =>
    cards.filter(c => tappedCodes.has(c.code)),
    [cards, tappedCodes]
  );

  return (
    <>
      <AdminNav active="taps" />

      <div style={{ background: "#0A0A0F", minHeight: "calc(100vh - 65px)", paddingBottom: "100px" }}>
        <div className="mobile-container-pad" style={{ maxWidth: 940, margin: "0 auto", padding: "24px 16px" }}>

          {/* Top Title & Quick Description */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                📲 Riwayat &amp; Analitik Tap
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 4 }}>
                Pantau performa kartu pelanggan, leaderboard terbanyak per bulan, dan verifikasi ulasan Google langsung.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Auto-Refresh Toggle Pill */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 10px",
                background: autoRefreshSec > 0 ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)",
                border: autoRefreshSec > 0 ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, fontSize: "0.75rem",
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: autoRefreshSec > 0 ? "#10B981" : "#7A7A95",
                  boxShadow: autoRefreshSec > 0 ? "0 0 8px #10B981" : "none",
                  animation: autoRefreshSec > 0 ? "pulseDot 2s infinite" : "none",
                }} />
                <span style={{ color: autoRefreshSec > 0 ? "#34D399" : "#7A7A95", fontWeight: 700 }}>
                  {isUpdating ? "Sinkron..." : "Live:"}
                </span>
                <select
                  value={autoRefreshSec}
                  onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                  style={{
                    background: "transparent", border: "none", color: "#F0F0FF",
                    fontSize: "0.75rem", fontWeight: 700, outline: "none", cursor: "pointer",
                  }}
                >
                  <option value={15} style={{ background: "#111118" }}>15 detik</option>
                  <option value={30} style={{ background: "#111118" }}>30 detik</option>
                  <option value={60} style={{ background: "#111118" }}>60 detik</option>
                  <option value={0} style={{ background: "#111118" }}>Mati</option>
                </select>
              </div>

              {/* Unduh CSV Button */}
              {validLogs.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="btn btn-ghost"
                  style={{
                    padding: "6px 12px", fontSize: "0.78rem",
                    color: "#A5B4FC", borderColor: "rgba(99,102,241,0.25)",
                    background: "rgba(99,102,241,0.06)",
                  }}
                  title="Unduh seluruh data tap ke file Excel/CSV"
                >
                  📥 CSV
                </button>
              )}

              <button
                onClick={() => fetchData(false)}
                disabled={loading}
                className="btn btn-ghost"
                style={{ padding: "6px 12px", fontSize: "0.78rem" }}
              >
                {loading || isUpdating ? "⏳" : "🔄"} Refresh
              </button>
            </div>
          </div>

          {/* Live Alert Banner: Tap Baru Masuk Secara Realtime (Sebelum Manual Refresh) */}
          {newTapAlert && (
            <div style={{
              background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(99,102,241,0.18))",
              border: "2px solid #10B981",
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              boxShadow: "0 8px 30px rgba(16,185,129,0.25)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 240px" }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: "#10B981", color: "#FFF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.3rem", flexShrink: 0,
                  boxShadow: "0 0 16px rgba(16,185,129,0.6)",
                }}>
                  ⚡
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 800, color: "#10B981",
                      background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)",
                      padding: "2px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>
                      Tap Baru Masuk Live!
                    </span>
                    <strong style={{ color: "#F0F0FF", fontSize: "0.95rem" }}>
                      {newTapAlert.storeName}
                    </strong>
                    <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#A5B4FC" }}>
                      ({newTapAlert.code})
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#C0C0D8", marginTop: 3 }}>
                    {formatFull(newTapAlert.tappedAt)} · <span style={{ color: "#34D399", fontWeight: 700 }}>{timeAgo(newTapAlert.tappedAt)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {cardUrlMap.get(newTapAlert.code) ? (
                  <a
                    href={cardUrlMap.get(newTapAlert.code)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{
                      fontSize: "0.82rem",
                      padding: "9px 16px",
                      background: "linear-gradient(135deg, #10B981, #059669)",
                      border: "none",
                      boxShadow: "0 4px 16px rgba(16,185,129,0.4)",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      textDecoration: "none",
                    }}
                    title="Buka menu ulasan Google publik toko ini untuk membaca ulasan pelanggan"
                  >
                    <span>⭐</span> Buka Menu Ulasan Toko ↗
                  </a>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    (Link ulasan belum terisi)
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setNewTapAlert(null)}
                  className="btn btn-ghost"
                  style={{ padding: "8px 12px", fontSize: "0.78rem" }}
                  title="Tutup notifikasi"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Quick Review Verification Bar (Tap Terakhir) */}
          {validLogs.length > 0 && !newTapAlert && (
            <div style={{
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: "1 1 220px" }}>
                <span style={{ fontSize: "1.1rem" }}>📲</span>
                <div style={{ minWidth: 0, fontSize: "0.78rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Tap Terakhir: </span>
                  <strong style={{ color: "#F0F0FF" }}>{validLogs[0].storeName}</strong>
                  <span style={{ color: "#34D399", marginLeft: 6 }}>({timeAgo(validLogs[0].tappedAt)})</span>
                </div>
              </div>

              {cardUrlMap.get(validLogs[0].code) && (
                <a
                  href={cardUrlMap.get(validLogs[0].code)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    color: "#A5B4FC",
                    background: "rgba(99,102,241,0.15)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  title="Buka menu ulasan Google publik toko ini untuk membaca ulasan pelanggan"
                >
                  <span>⭐</span> Menu Ulasan Toko ↗
                </a>
              )}
            </div>
          )}

          {/* KPI Stat Cards (Grid kiri-kanan seperti di Dashboard) */}
          <div
            className="mobile-kpi-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <div className="card" style={{ padding: "14px 16px", borderColor: "rgba(16,185,129,0.25)", background: "linear-gradient(180deg, rgba(16,185,129,0.06), #111118)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hari Ini</span>
                <span style={{ fontSize: "1.2rem" }}>☀️</span>
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#34D399", lineHeight: 1 }}>{todayCount}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>Tap tercatat hari ini</div>
            </div>

            <div className="card" style={{ padding: "14px 16px", borderColor: "rgba(245,158,11,0.25)", background: "linear-gradient(180deg, rgba(245,158,11,0.06), #111118)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#FCD34D", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bulan Ini</span>
                <span style={{ fontSize: "1.2rem" }}>📅</span>
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#FCD34D", lineHeight: 1 }}>{thisMonthCount}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>{formatMonthLabel(thisMonthKey)}</div>
            </div>

            <div className="card" style={{ padding: "14px 16px", borderColor: "rgba(99,102,241,0.25)", background: "linear-gradient(180deg, rgba(99,102,241,0.06), #111118)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Tap</span>
                <span style={{ fontSize: "1.2rem" }}>📲</span>
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#A5B4FC", lineHeight: 1 }}>{validLogs.length}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>Kartu aktif terdaftar</div>
            </div>

            <div className="card" style={{ padding: "14px 16px", borderColor: sleepingCards.length > 0 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)", background: "linear-gradient(180deg, rgba(255,255,255,0.02), #111118)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: sleepingCards.length > 0 ? "#FCA5A5" : "#34D399", textTransform: "uppercase", letterSpacing: "0.05em" }}>Belum Ada Tap</span>
                <span style={{ fontSize: "1.2rem" }}>😴</span>
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: sleepingCards.length > 0 ? "#FCA5A5" : "#34D399", lineHeight: 1 }}>
                {sleepingCards.length}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>Perlu follow up/promosi</div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              onClick={() => setActiveTab("harian")}
              className={`btn ${activeTab === "harian" ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "8px 16px", fontSize: "0.85rem", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>📋</span> Riwayat Tap Harian
            </button>
            <button
              onClick={() => setActiveTab("bulanan")}
              className={`btn ${activeTab === "bulanan" ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "8px 16px", fontSize: "0.85rem", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>📊</span> Rekap Bulanan & Peringkat
            </button>
            <button
              onClick={() => setActiveTab("tren")}
              className={`btn ${activeTab === "tren" ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "8px 16px", fontSize: "0.85rem", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>📈</span> Tren & Jam Sibuk
            </button>
            <button
              onClick={() => setActiveTab("tidur")}
              className={`btn ${activeTab === "tidur" ? "btn-danger" : "btn-ghost"}`}
              style={{ padding: "8px 16px", fontSize: "0.85rem", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>😴</span> Belum Ada Tap {sleepingCards.length > 0 && `(${sleepingCards.length})`}
            </button>
          </div>

          {/* Search bar */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <input
              type="text"
              className="input"
              placeholder="🔍 Cari nama cafe, resto, atau kode kartu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 14, paddingRight: search ? 38 : 14, background: "rgba(255,255,255,0.03)" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* ═════════ TAB 1: RIWAYAT TAP HARIAN (DEFAULT UTAMA) ═════════ */}
          {activeTab === "harian" && (
            loading ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div className="spinner" style={{ margin: "0 auto 12px", width: 24, height: 24 }} />
                <p style={{ color: "var(--text-muted)" }}>Memuat aktivitas riwayat tap...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.5 }}>📲</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Tidak Ada Data</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  {search ? `Tidak ditemukan tap untuk "${search}".` : "Belum ada aktivitas tap yang tercatat."}
                </p>
              </div>
            ) : (
              <div>
                {/* Banner Pintasan Rekap Bulan Ini */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
                  borderRadius: 10, marginBottom: 16, flexWrap: "wrap", gap: 10,
                }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Total tap bulan ini ({formatMonthLabel(thisMonthKey)}): <strong style={{ color: "#FCD34D" }}>{thisMonthCount} tap</strong>
                  </div>
                  <button
                    onClick={() => { setActiveTab("bulanan"); setSelectedMonth(thisMonthKey); }}
                    className="btn btn-ghost"
                    style={{ padding: "5px 12px", fontSize: "0.75rem", color: "#A5B4FC", borderColor: "rgba(99,102,241,0.3)" }}
                  >
                    📊 Buka Rekap Bulan Ini & Peringkat Toko ↗
                  </button>
                </div>

                {/* Filter Cepat Periode & Kalender Pemilih Tanggal */}
                <div style={{
                  display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 18,
                  padding: "12px 14px", background: "#111118", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                }}>
                  {/* Pills Filter Periode Cepat */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => { setDailyMode("today"); setCustomDate(""); }}
                      className={`btn ${dailyMode === "today" && !customDate ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "7px 12px", fontSize: "0.78rem", borderRadius: 8 }}
                    >
                      ☀️ Hari Ini ({hariianPeriods.today.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => { setDailyMode("yesterday"); setCustomDate(""); }}
                      className={`btn ${dailyMode === "yesterday" && !customDate ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "7px 12px", fontSize: "0.78rem", borderRadius: 8 }}
                    >
                      ⏱️ Kemarin ({hariianPeriods.yest.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => { setDailyMode("last7"); setCustomDate(""); }}
                      className={`btn ${dailyMode === "last7" && !customDate ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "7px 12px", fontSize: "0.78rem", borderRadius: 8 }}
                    >
                      📅 7 Hari Terakhir ({hariianPeriods.today.length + hariianPeriods.yest.length + hariianPeriods.last7.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => { setDailyMode("all"); setCustomDate(""); }}
                      className={`btn ${dailyMode === "all" && !customDate ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "7px 12px", fontSize: "0.78rem", borderRadius: 8 }}
                    >
                      📑 Semua ({filtered.length})
                    </button>
                  </div>

                  {/* Kalender Pemilih Tanggal */}
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <label htmlFor="custom-date-picker" style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      🗓️ Pilih Hari / Tanggal:
                    </label>
                    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                      <input
                        id="custom-date-picker"
                        type="date"
                        value={customDate}
                        onChange={(e) => {
                          setCustomDate(e.target.value);
                          if (e.target.value) setDailyMode("custom");
                        }}
                        style={{
                          background: customDate ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                          border: customDate ? "1px solid #6366F1" : "1px solid rgba(255,255,255,0.12)",
                          color: "#F0F0FF",
                          padding: "6px 12px",
                          borderRadius: 8,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          outline: "none",
                          cursor: "pointer",
                        }}
                      />
                      {customDate && (
                        <button
                          type="button"
                          onClick={() => { setCustomDate(""); setDailyMode("today"); }}
                          style={{
                            marginLeft: 6, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                            color: "#FCA5A5", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem",
                            padding: "4px 8px", borderRadius: 6,
                          }}
                          title="Reset filter tanggal"
                        >
                          ✕ Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* MODE 1: HARI INI */}
                {dailyMode === "today" && !customDate && (
                  hariianPeriods.today.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>☀️</div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6, color: "#F0F0FF" }}>
                        Belum Ada Tap Masuk Hari Ini
                      </h3>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 440, margin: "0 auto 18px", lineHeight: 1.5 }}>
                        Pelanggan belum men-tap kartu NFC atau scan QR toko hari ini ({formatDateIndo(new Date())}).
                        Tap baru akan otomatis terdeteksi via live auto-refresh.
                      </p>
                      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                        {hariianPeriods.yest.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setDailyMode("yesterday")}
                            className="btn btn-ghost"
                            style={{ padding: "8px 16px", fontSize: "0.8rem", color: "#F59E0B", borderColor: "rgba(245,158,11,0.3)" }}
                          >
                            ⏱️ Lihat Tap Kemarin ({hariianPeriods.yest.length} tap)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDailyMode("all")}
                          className="btn btn-ghost"
                          style={{ padding: "8px 16px", fontSize: "0.8rem", color: "#A5B4FC", borderColor: "rgba(99,102,241,0.3)" }}
                        >
                          📑 Lihat Semua Riwayat ({filtered.length} tap)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{
                        padding: "12px 16px", background: "#13131C", borderLeft: "4px solid #10B981",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <span style={{ fontWeight: 800, fontSize: "0.84rem", color: "#34D399", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          ☀️ Tap Masuk Hari Ini — {formatDateIndo(new Date())}
                        </span>
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 800, color: "#34D399",
                          background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)",
                          padding: "3px 10px", borderRadius: 999,
                        }}>
                          {hariianPeriods.today.length} TAP
                        </span>
                      </div>
                      <div>
                        {hariianPeriods.today.map((log, i) => (
                          <TapItem
                            key={`${log.code}-${log.tappedAt}-${i}`}
                            log={log}
                            reviewUrl={cardUrlMap.get(log.code) || (log.storeName ? getPublicGoogleReviewUrl("", log.storeName) : "")}
                            accentColor="#10B981"
                            timeAgo={timeAgo}
                            formatFull={formatFull}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )}

                {/* MODE 2: KEMARIN */}
                {dailyMode === "yesterday" && !customDate && (
                  hariianPeriods.yest.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>⏱️</div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6, color: "#F0F0FF" }}>
                        Tidak Ada Tap Kemarin
                      </h3>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 400, margin: "0 auto 16px" }}>
                        Tidak ada aktivitas tap kartu yang tercatat pada hari kemarin.
                      </p>
                      <button
                        type="button"
                        onClick={() => setDailyMode("today")}
                        className="btn btn-ghost"
                        style={{ padding: "8px 16px", fontSize: "0.8rem", color: "#10B981", borderColor: "rgba(16,185,129,0.3)" }}
                      >
                        Kembali ke Hari Ini
                      </button>
                    </div>
                  ) : (
                    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{
                        padding: "12px 16px", background: "#13131C", borderLeft: "4px solid #F59E0B",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <span style={{ fontWeight: 800, fontSize: "0.84rem", color: "#FCD34D", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          ⏱️ Tap Kemarin ({hariianPeriods.yest.length} tap)
                        </span>
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 800, color: "#FCD34D",
                          background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)",
                          padding: "3px 10px", borderRadius: 999,
                        }}>
                          {hariianPeriods.yest.length} TAP
                        </span>
                      </div>
                      <div>
                        {hariianPeriods.yest.map((log, i) => (
                          <TapItem
                            key={`${log.code}-${log.tappedAt}-${i}`}
                            log={log}
                            reviewUrl={cardUrlMap.get(log.code) || (log.storeName ? getPublicGoogleReviewUrl("", log.storeName) : "")}
                            accentColor="#F59E0B"
                            timeAgo={timeAgo}
                            formatFull={formatFull}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )}

                {/* MODE 3: 7 HARI TERAKHIR */}
                {dailyMode === "last7" && !customDate && (
                  <div>
                    <PeriodSection
                      title="Hari Ini"
                      entries={hariianPeriods.today}
                      defaultOpen={true}
                      accentColor="#10B981"
                      cardUrlMap={cardUrlMap}
                      formatFull={formatFull}
                      timeAgo={timeAgo}
                    />
                    <PeriodSection
                      title="Kemarin"
                      entries={hariianPeriods.yest}
                      defaultOpen={true}
                      accentColor="#F59E0B"
                      cardUrlMap={cardUrlMap}
                      formatFull={formatFull}
                      timeAgo={timeAgo}
                    />
                    <PeriodSection
                      title="2 – 7 Hari Terakhir"
                      entries={hariianPeriods.last7}
                      defaultOpen={true}
                      accentColor="#6366F1"
                      cardUrlMap={cardUrlMap}
                      formatFull={formatFull}
                      timeAgo={timeAgo}
                    />
                  </div>
                )}

                {/* MODE 4: SEMUA RIWAYAT */}
                {dailyMode === "all" && !customDate && (
                  <div>
                    <PeriodSection
                      title="Hari Ini"
                      entries={hariianPeriods.today}
                      defaultOpen={true}
                      accentColor="#10B981"
                      cardUrlMap={cardUrlMap}
                      formatFull={formatFull}
                      timeAgo={timeAgo}
                    />
                    <PeriodSection
                      title="Kemarin"
                      entries={hariianPeriods.yest}
                      defaultOpen={hariianPeriods.today.length === 0}
                      accentColor="#F59E0B"
                      cardUrlMap={cardUrlMap}
                      formatFull={formatFull}
                      timeAgo={timeAgo}
                    />
                    <PeriodSection
                      title="7 Hari Terakhir"
                      entries={hariianPeriods.last7}
                      defaultOpen={false}
                      accentColor="#6366F1"
                      cardUrlMap={cardUrlMap}
                      formatFull={formatFull}
                      timeAgo={timeAgo}
                    />
                    <PeriodSection
                      title="Lebih Lama"
                      entries={hariianPeriods.older}
                      defaultOpen={false}
                      accentColor="#6B7280"
                      cardUrlMap={cardUrlMap}
                      formatFull={formatFull}
                      timeAgo={timeAgo}
                    />
                  </div>
                )}

                {/* MODE 5: PILIH TANGGAL SPESIFIK */}
                {customDate && (
                  customDateEntries.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>📅</div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6, color: "#F0F0FF" }}>
                        Tidak Ada Data Tap
                      </h3>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 440, margin: "0 auto 16px" }}>
                        Tidak ada aktivitas tap kartu pada tanggal <strong>{formatDateIndo(customDate)}</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setCustomDate(""); setDailyMode("today"); }}
                        className="btn btn-ghost"
                        style={{ padding: "8px 16px", fontSize: "0.8rem", color: "#34D399", borderColor: "rgba(16,185,129,0.3)" }}
                      >
                        Kembali ke Hari Ini
                      </button>
                    </div>
                  ) : (
                    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{
                        padding: "12px 16px", background: "#13131C", borderLeft: "4px solid #6366F1",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <span style={{ fontWeight: 800, fontSize: "0.84rem", color: "#A5B4FC", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          🗓️ Riwayat Tap: {formatDateIndo(customDate)}
                        </span>
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 800, color: "#A5B4FC",
                          background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)",
                          padding: "3px 10px", borderRadius: 999,
                        }}>
                          {customDateEntries.length} TAP
                        </span>
                      </div>
                      <div>
                        {customDateEntries.map((log, i) => (
                          <TapItem
                            key={`${log.code}-${log.tappedAt}-${i}`}
                            log={log}
                            reviewUrl={cardUrlMap.get(log.code) || (log.storeName ? getPublicGoogleReviewUrl("", log.storeName) : "")}
                            accentColor="#6366F1"
                            timeAgo={timeAgo}
                            formatFull={formatFull}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            )
          )}

          {/* ═════════ TAB 2: REKAP BULANAN & PERINGKAT TOKO ═════════ */}
          {activeTab === "bulanan" && (
            loading ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div className="spinner" style={{ margin: "0 auto 12px", width: 24, height: 24 }} />
                <p style={{ color: "var(--text-muted)" }}>Memuat data ranking bulanan...</p>
              </div>
            ) : filteredMonthly.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.5 }}>🏆</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Belum Ada Data Tap</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 420, margin: "0 auto" }}>
                  {search
                    ? `Tidak ada toko yang cocok dengan pencarian "${search}".`
                    : "Tap kartu NFC atau scan QR code pada kartu aktif untuk mulai merekam leaderboard."}
                </p>
              </div>
            ) : (
              <div>
                {/* Selector Pemilih Bulan */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 12, marginBottom: 18, flexWrap: "wrap",
                  background: "#111118", padding: "12px 16px",
                  borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#E0E0F0" }}>
                      Pilih Bulan:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedMonth(thisMonthKey)}
                      className={`btn ${selectedMonthKey === thisMonthKey ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "6px 14px", fontSize: "0.8rem", borderRadius: 8 }}
                    >
                      🌟 Bulan Ini ({formatMonthLabel(thisMonthKey)})
                    </button>
                  </div>

                  {pastMonths.length > 0 && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <label htmlFor="past-month-select" style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        Bulan Sebelumnya:
                      </label>
                      <select
                        id="past-month-select"
                        value={selectedMonthKey !== thisMonthKey ? selectedMonthKey : ""}
                        onChange={(e) => {
                          if (e.target.value) setSelectedMonth(e.target.value);
                        }}
                        style={{
                          background: "#13131C", border: "1px solid rgba(255,255,255,0.15)",
                          color: "#F0F0FF", padding: "6px 12px", borderRadius: 8,
                          fontSize: "0.8rem", fontWeight: 600, outline: "none", cursor: "pointer",
                        }}
                      >
                        <option value="" disabled>-- Pilih Bulan Lalu --</option>
                        {pastMonths.map(pm => (
                          <option key={pm.monthKey} value={pm.monthKey} style={{ background: "#111118" }}>
                            {pm.label} ({pm.total} Tap)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Tampilan Rekap Bulan Terpilih */}
                {selectedMonthGroup ? (() => {
                  const mg = selectedMonthGroup;
                  const isThisMonth = mg.monthKey === thisMonthKey;
                  const maxCount = Math.max(...mg.byStore.map(s => s.count), 1);

                  return (
                    <div
                      className="card"
                      style={{
                        padding: 0,
                        overflow: "hidden",
                        borderColor: isThisMonth ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.08)",
                        background: "#111118",
                      }}
                    >
                      {/* Month Header Banner */}
                      <div
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "16px 20px",
                          background: isThisMonth ? "rgba(245,158,11,0.06)" : "transparent",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          flexWrap: "wrap", gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#F0F0FF" }}>
                              🏆 Rekap {mg.label}
                            </span>
                            {isThisMonth && (
                              <span style={{
                                fontSize: "0.65rem", fontWeight: 800,
                                background: "rgba(245,158,11,0.18)", color: "#FCD34D",
                                border: "1px solid rgba(245,158,11,0.4)",
                                padding: "2px 8px", borderRadius: 999, textTransform: "uppercase",
                              }}>
                                Bulan Berjalan
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
                            {mg.byStore.length} Toko Terdaftar Aktif · Total {mg.total} Tap Pelanggan
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#FCD34D" }}>
                            {mg.total}×
                          </span>
                          <span style={{ display: "block", fontSize: "0.68rem", color: "var(--text-muted)" }}>Total Tap</span>
                        </div>
                      </div>

                      {/* Store Rankings List */}
                      <div style={{ padding: "8px 14px 16px" }}>
                        {mg.byStore.map((s, idx) => {
                          const delta = s.lastMonthCount > 0 ? s.count - s.lastMonthCount : null;
                          const storeKey = `${mg.monthKey}::${s.storeName}`;
                          const isStoreOpen = expandedStore === storeKey;
                          const storeTaps = tapsByStoreMonth.get(storeKey) ?? [];
                          const percent = Math.round((s.count / maxCount) * 100);
                          const storeReviewUrl = cardUrlMap.get(s.code) || (s.storeName ? getPublicGoogleReviewUrl("", s.storeName) : "");

                          const rankMedal =
                            idx === 0 ? "🥇" :
                            idx === 1 ? "🥈" :
                            idx === 2 ? "🥉" : `#${idx + 1}`;

                          return (
                            <div key={s.storeName} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <div
                                style={{
                                  padding: "12px 6px",
                                  borderRadius: 8,
                                  background: isStoreOpen ? "rgba(99,102,241,0.05)" : "transparent",
                                  transition: "background 0.15s",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                }}
                              >
                                {/* Top row: Rank, Store Name, Count, Delta */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                                    <span style={{
                                      fontSize: idx < 3 ? "1.2rem" : "0.85rem",
                                      fontWeight: 800,
                                      width: 28,
                                      textAlign: "center",
                                      flexShrink: 0,
                                      color: idx < 3 ? undefined : "var(--text-muted)",
                                    }}>
                                      {rankMedal}
                                    </span>

                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#F0F0FF", wordBreak: "break-word" }}>
                                        {s.storeName}
                                      </div>
                                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontFamily: "monospace", color: "#A5B4FC" }}>{s.code}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                    <span style={{ fontWeight: 800, fontSize: "1.05rem", color: idx === 0 ? "#FCD34D" : "#E0E0F0" }}>
                                      {s.count}×
                                    </span>

                                    {isThisMonth ? (
                                      delta === null ? (
                                        <span style={{ fontSize: "0.65rem", color: "#A5B4FC", background: "rgba(99,102,241,0.12)", padding: "2px 6px", borderRadius: 999 }}>
                                          baru
                                        </span>
                                      ) : delta > 0 ? (
                                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#34D399", background: "rgba(16,185,129,0.12)", padding: "2px 6px", borderRadius: 999 }}>
                                          +{delta}
                                        </span>
                                      ) : delta < 0 ? (
                                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#FCA5A5", background: "rgba(239,68,68,0.12)", padding: "2px 6px", borderRadius: 999 }}>
                                          {delta}
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>±0</span>
                                      )
                                    ) : (
                                      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>selesai</span>
                                    )}
                                  </div>
                                </div>

                                {/* Middle row: Progress bar */}
                                <div style={{ background: "rgba(255,255,255,0.06)", height: 6, borderRadius: 999, overflow: "hidden", margin: "2px 0" }}>
                                  <div
                                    style={{
                                      width: `${percent}%`,
                                      height: "100%",
                                      background: idx === 0
                                        ? "linear-gradient(90deg, #F59E0B, #FCD34D)"
                                        : "linear-gradient(90deg, #4F46E5, #818CF8)",
                                      borderRadius: 999,
                                    }}
                                  />
                                </div>

                                {/* Bottom row: Actions (Detail tap + Google Review link) */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: "0.72rem" }}>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedStore(isStoreOpen ? null : storeKey)}
                                    style={{
                                      background: "none", border: "none", color: "#A5B4FC",
                                      cursor: "pointer", fontSize: "0.72rem", padding: "4px 0",
                                      display: "flex", alignItems: "center", gap: 4,
                                    }}
                                  >
                                    {isStoreOpen ? "▲ Tutup rincian jam" : `▼ Lihat detail ${s.count} tap`}
                                  </button>

                                  {storeReviewUrl && (
                                    <a
                                      href={storeReviewUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        color: "#FCD34D", textDecoration: "none", fontWeight: 600,
                                        display: "inline-flex", alignItems: "center", gap: 4,
                                        background: "rgba(245,158,11,0.08)", padding: "3px 8px", borderRadius: 6,
                                        border: "1px solid rgba(245,158,11,0.25)",
                                      }}
                                      title="Buka menu ulasan Google publik toko ini untuk membaca ulasan pelanggan"
                                    >
                                      ⭐ Menu Ulasan ↗
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Expanded Store Tap Drilldown */}
                              {isStoreOpen && (
                                <div style={{
                                  margin: "4px 0 12px 10px",
                                  padding: "12px 14px",
                                  background: "rgba(0,0,0,0.3)",
                                  border: "1px solid rgba(255,255,255,0.06)",
                                  borderRadius: 10,
                                }}>
                                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#FCD34D", marginBottom: 8 }}>
                                    📋 Riwayat {storeTaps.length} Tap — {s.storeName}
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                                    {storeTaps.map((t, ti) => (
                                      <div key={`${t.tappedAt}-${ti}`} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#C0C0D8", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: 4 }}>
                                        <span>
                                          <strong style={{ color: "#7A7A95", marginRight: 6 }}>#{ti + 1}</strong>
                                          {formatFull(t.tappedAt)}
                                        </span>
                                        <span style={{ color: "#34D399", fontWeight: 600 }}>{timeAgo(t.tappedAt)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {isThisMonth && mg.byStore.some(s => s.lastMonthCount > 0) && (
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 12, paddingLeft: 6 }}>
                            * Delta (+/−) menunjukkan perbandingan aktivitas tap dibanding bulan lalu ({formatMonthLabel(lastMonthKey)}).
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                    <p style={{ color: "var(--text-muted)" }}>Tidak ada data aktivitas tap untuk bulan yang dipilih.</p>
                  </div>
                )}
              </div>
            )
          )}

          {/* ═════════ TAB 3: TREN & JAM RAMAI ═════════ */}
          {activeTab === "tren" && (
            loading ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div className="spinner" style={{ margin: "0 auto 12px", width: 24, height: 24 }} />
                <p style={{ color: "var(--text-muted)" }}>Menghitung analitik tren...</p>
              </div>
            ) : validLogs.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.5 }}>📈</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Belum Ada Data Tap</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Grafik tren harian dan distribusi jam akan otomatis digambar setelah ada tap.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* 30 Day Trend */}
                <div className="card" style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#F0F0FF" }}>📈 Tren Aktivitas 30 Hari Terakhir</h3>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Jumlah tap per hari pada semua kartu aktif.
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="badge badge-orange">
                        Total 30 Hari: {trendData.reduce((s, d) => s + d.value, 0)} tap
                      </span>
                    </div>
                  </div>
                  <BarChart data={trendData} color="#F59E0B" labelEvery={7} showValue={false} />
                </div>

                {/* Peak Hours */}
                <div className="card" style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#F0F0FF" }}>🕐 Distribusi Jam Paling Ramai</h3>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Analisis jam berapa pelanggan paling sering men-tap kartu / scan QR review.
                      </p>
                    </div>
                    {peakHour && (
                      <span className="badge badge-green">
                        🏆 Jam Puncak: {peakHour.label} ({peakHour.count} tap)
                      </span>
                    )}
                  </div>
                  <BarChart data={hourData} color="#6366F1" labelEvery={1} showValue={false} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6, padding: "0 10px" }}>
                    <span>00.00</span><span>06.00</span><span>12.00 (Siang)</span><span>18.00 (Sore)</span><span>23.00</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10B981" }} />
                      <span>Jam puncak tertinggi</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: "#6366F1" }} />
                      <span>Aktivitas normal</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* ═════════ TAB 4: KARTU TIDUR ═════════ */}
          {activeTab === "tidur" && (
            loading ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div className="spinner" style={{ margin: "0 auto 12px", width: 24, height: 24 }} />
                <p style={{ color: "var(--text-muted)" }}>Memeriksa kartu tidur...</p>
              </div>
            ) : (
              <div>
                <div style={{
                  padding: "14px 18px", marginBottom: 16,
                  background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 12, color: "#FCD34D", fontSize: "0.82rem", lineHeight: 1.6,
                }}>
                  💡 <strong>Informasi Follow-Up:</strong> Daftar toko di bawah sudah membeli/menerima kartu, namun belum mencatat tap sama sekali sejak pelacakan tap aktif. Anda dapat menghubungi mereka untuk memastikan kartu sudah dipajang di kasir/meja.
                </div>

                {sleepingCards.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎉</div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#34D399", marginBottom: 6 }}>
                      Luar Biasa! Semua Kartu Sudah Aktif
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      Tidak ada kartu tidur. Semua toko binaan sudah mendapatkan minimal 1 tap ulasan Google!
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {sleepingCards.map((card) => (
                      <div
                        key={card.code}
                        className="card"
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "14px 18px", borderLeft: "4px solid #EF4444",
                          flexWrap: "wrap", gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem",
                          }}>😴</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#F0F0FF" }}>
                              {card.storeName}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                              <span>Kode: <strong style={{ fontFamily: "monospace", color: "#A5B4FC" }}>{card.code}</strong></span>
                              <span>·</span>
                              <span>Assign: {new Date(card.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: "0.72rem", fontWeight: 600,
                            color: "#FCA5A5", background: "rgba(239,68,68,0.12)",
                            border: "1px solid rgba(239,68,68,0.25)",
                            padding: "4px 10px", borderRadius: 999,
                          }}>
                            Belum Ada Tap
                          </span>
                          <a
                            href={`/c/${card.code}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost"
                            style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                            title="Buka link kartu untuk uji coba"
                          >
                            Tes Link ↗
                          </a>
                          {card.googleReviewUrl && (
                            <a
                              href={getPublicGoogleReviewUrl(card.googleReviewUrl, card.storeName)}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: "6px 10px", fontSize: "0.75rem",
                                color: "#FCD34D", textDecoration: "none", fontWeight: 600,
                                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                                borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4,
                              }}
                              title="Buka menu ulasan Google publik toko ini"
                            >
                              ⭐ Menu Ulasan Toko ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* Footer note */}
          <div style={{ textAlign: "center", marginTop: 36, fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Review Card Tap Analytics · Sinkronisasi realtime dengan Google Review Card Engine
          </div>

        </div>
      </div>
    </>
  );
}

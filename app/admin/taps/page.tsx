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

// ── Helper to calculate clean, rounded Y-axis ticks ──────────────────
function getNiceYScale(maxVal: number) {
  if (maxVal <= 0) return { niceMax: 4, ticks: [0, 1, 2, 3, 4] };
  if (maxVal <= 4) return { niceMax: 4, ticks: [0, 1, 2, 3, 4] };
  if (maxVal <= 8) return { niceMax: 8, ticks: [0, 2, 4, 6, 8] };
  if (maxVal <= 12) return { niceMax: 12, ticks: [0, 3, 6, 9, 12] };
  if (maxVal <= 20) return { niceMax: 20, ticks: [0, 5, 10, 15, 20] };
  if (maxVal <= 40) return { niceMax: 40, ticks: [0, 10, 20, 30, 40] };
  if (maxVal <= 60) return { niceMax: 60, ticks: [0, 15, 30, 45, 60] };
  if (maxVal <= 100) return { niceMax: 100, ticks: [0, 25, 50, 75, 100] };

  const pow10 = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const normalized = maxVal / pow10;
  let mult = 10;
  if (normalized <= 1.2) mult = 1.2;
  else if (normalized <= 1.5) mult = 1.5;
  else if (normalized <= 2) mult = 2;
  else if (normalized <= 2.5) mult = 2.5;
  else if (normalized <= 3) mult = 3;
  else if (normalized <= 4) mult = 4;
  else if (normalized <= 5) mult = 5;
  else if (normalized <= 6) mult = 6;
  else if (normalized <= 8) mult = 8;

  const niceMax = Math.ceil(maxVal / (mult * pow10 / 4)) * (mult * pow10 / 4);
  const step = niceMax / 4;
  return {
    niceMax,
    ticks: [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), Math.round(niceMax)],
  };
}

// ── SVG Bar Chart (explicit X & Y axes, scale numbers, gridlines, values) ─
function BarChart({
  data,
  color = "#F59E0B",
  yAxisUnit = "Tap",
  xAxisTitle = "Waktu",
  showValue = true,
  onBarClick,
  selectedIndex,
}: {
  data: {
    label: string;
    subLabel?: string;
    value: number;
    highlight?: boolean;
    tooltip?: string;
    dateKey?: string;
  }[];
  color?: string;
  yAxisUnit?: string;
  xAxisTitle?: string;
  showValue?: boolean;
  onBarClick?: (index: number, item: any) => void;
  selectedIndex?: number | null;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 0);
  const { niceMax, ticks } = getNiceYScale(maxVal);

  const W = 820;
  const H = 220;
  const PAD_L = 46;
  const PAD_R = 24;
  const PAD_T = 26;
  const PAD_B = 34;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const y0 = PAD_T + chartH; // Baseline Y position

  const slotW = data.length > 0 ? chartW / data.length : chartW;
  const barW = Math.max(Math.min(Math.floor(slotW * 0.72), 34), 5);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", minWidth: 460, height: "auto", display: "block" }}
        role="img"
        aria-label="Grafik Batang"
      >
        <defs>
          <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10B981" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* ── Sumbu Y: Horizontal Grid Lines & Tick Labels ── */}
        {ticks.map((val) => {
          const y = y0 - (val / niceMax) * chartH;
          const isBaseline = val === 0;
          return (
            <g key={val}>
              {!isBaseline && (
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}
              {/* Tick Mark on Y-axis line */}
              <line
                x1={PAD_L - 4}
                y1={y}
                x2={PAD_L}
                y2={y}
                stroke="#64748B"
                strokeWidth={1.5}
              />
              {/* Tick Number Label on Y-axis */}
              <text
                x={PAD_L - 8}
                y={y + 3.5}
                fill="#94A3B8"
                fontSize={10}
                fontWeight={600}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* ── Sumbu Y: Vertical Axis Line & Unit ── */}
        <line
          x1={PAD_L}
          y1={PAD_T - 6}
          x2={PAD_L}
          y2={y0}
          stroke="#64748B"
          strokeWidth={1.5}
        />
        <text
          x={PAD_L - 6}
          y={PAD_T - 12}
          fill="#CBD5E1"
          fontSize={10}
          fontWeight={700}
          textAnchor="start"
        >
          {yAxisUnit} ↑
        </text>

        {/* ── Sumbu X: Baseline Line & Direction ── */}
        <line
          x1={PAD_L}
          y1={y0}
          x2={W - PAD_R + 6}
          y2={y0}
          stroke="#64748B"
          strokeWidth={1.5}
        />
        {xAxisTitle && (
          <text
            x={W - PAD_R + 10}
            y={y0 + 3.5}
            fill="#64748B"
            fontSize={9.5}
            fontWeight={600}
            textAnchor="start"
          >
            {xAxisTitle} →
          </text>
        )}

        {/* ── Data Bars & Sumbu X Labels ── */}
        {data.map((d, i) => {
          const cx = PAD_L + i * slotW + slotW / 2;
          const bx = cx - barW / 2;
          const barH = d.value > 0 ? Math.max((d.value / niceMax) * chartH, 4) : 2;
          const by = y0 - barH;
          const isHighlight = Boolean(d.highlight);
          const isSelected = selectedIndex === i;
          const isClickable = Boolean(onBarClick);
          const barFill = isSelected
            ? "#38BDF8"
            : isHighlight
            ? "#10B981"
            : d.value === 0
            ? "rgba(255, 255, 255, 0.04)"
            : color;

          return (
            <g
              key={i}
              onClick={() => {
                if (onBarClick) onBarClick(i, d);
              }}
              style={{ cursor: isClickable ? "pointer" : "default" }}
            >
              <title>{d.tooltip || `${d.label || "Data"}: ${d.value} ${yAxisUnit.toLowerCase()}`}</title>

              {/* Bar Rect */}
              <rect
                x={bx}
                y={by}
                width={barW}
                height={barH}
                rx={Math.min(barW / 2, 4)}
                fill={barFill}
                stroke={isSelected ? "#FFF" : undefined}
                strokeWidth={isSelected ? 1.5 : 0}
                filter={isHighlight && d.value > 0 ? "url(#barGlow)" : undefined}
                style={{ transition: "all 0.2s ease" }}
              />

              {/* Value on top of bar */}
              {showValue && d.value > 0 && (
                <text
                  x={cx}
                  y={by - 5}
                  fill={isHighlight ? "#34D399" : "#F8FAFC"}
                  fontSize={barW < 14 ? 8.5 : 9.5}
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {d.value}
                </text>
              )}

              {/* Sumbu X: Tick Mark on baseline for labeled slots */}
              {d.label && (
                <line
                  x1={cx}
                  y1={y0}
                  x2={cx}
                  y2={y0 + 4}
                  stroke={isHighlight ? "#10B981" : "#64748B"}
                  strokeWidth={1.5}
                />
              )}

              {/* Sumbu X: Primary Label */}
              {d.label && (
                <text
                  x={cx}
                  y={y0 + (d.subLabel ? 14 : 17)}
                  fill={isHighlight ? "#34D399" : "#94A3B8"}
                  fontSize={9}
                  fontWeight={isHighlight ? 700 : 500}
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              )}

              {/* Sumbu X: Sub-label (e.g. date under day name) */}
              {d.subLabel && (
                <text
                  x={cx}
                  y={y0 + 26}
                  fill={isHighlight ? "#A7F3D0" : "#64748B"}
                  fontSize={8}
                  fontWeight={isHighlight ? 600 : 400}
                  textAnchor="middle"
                >
                  {d.subLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
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
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const timeStr = `${hours}:${minutes}`;
  const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 14px",
        background: "#111118",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        borderLeft: `4px solid ${accentColor}`,
        transition: "background 0.15s",
      }}
    >
      {/* Kolom Kiri: Jam Tap Box + Info Toko */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        {/* Time Badge (Clean digital time without spacing) */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 7,
            padding: "4px 6px",
            textAlign: "center",
            flexShrink: 0,
            width: 52,
          }}
          title={formatFull(log.tappedAt)}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#F0F0FF", fontFamily: "ui-monospace, monospace", lineHeight: 1.1 }}>
            {timeStr}
          </div>
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase" }}>
            {dateStr}
          </div>
        </div>

        {/* Info Toko: Nama & Kode di atas, Time Ago di bawah */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{
              fontWeight: 700,
              color: "#F0F0FF",
              fontSize: "0.88rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {log.storeName}
            </span>
            <span style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.65rem",
              fontWeight: 700,
              color: "#818CF8",
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              padding: "1px 5px",
              borderRadius: 4,
              flexShrink: 0,
            }}>
              {log.code}
            </span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <span>🕒 {timeAgo(log.tappedAt)}</span>
          </div>
        </div>
      </div>

      {/* Kolom Kanan: Tombol Menu Ulasan */}
      {reviewUrl && (
        <a
          href={reviewUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#FCD34D",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            padding: "5px 10px",
            borderRadius: 7,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
          title="Buka ulasan Google toko ini di browser"
        >
          <span>⭐</span> Menu Ulasan ↗
        </a>
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
  const [dailyMode, setDailyMode] = useState<"today" | "last7" | "last30" | "all" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [newTapAlert, setNewTapAlert] = useState<TapLogEntry | null>(null);
  const [trendRange, setTrendRange] = useState<7 | 30>(7);
  const [trenView, setTrenView] = useState<"jam" | "harian">("jam");
  const [hourPeriod, setHourPeriod] = useState<"today" | "last7" | "last30" | "all">("today");
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
  function formatTapDateTime(iso: string) {
    const d = new Date(iso);
    const date = d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date} · ${time}`;
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

    const cutoff30 = new Date(now);
    cutoff30.setDate(now.getDate() - 30);
    cutoff30.setHours(0, 0, 0, 0);

    const today: TapLogEntry[] = [];
    const last7: TapLogEntry[] = [];
    const last30: TapLogEntry[] = [];

    for (const entry of filtered) {
      const d = new Date(entry.tappedAt);
      const ymd = toDateInputValue(d);
      if (ymd === todayYmd) {
        today.push(entry);
      }
      if (d >= cutoff7) {
        last7.push(entry);
      }
      if (d >= cutoff30) {
        last30.push(entry);
      }
    }

    return {
      today,
      last7,
      last30,
      todayTotal: today.length,
      last7Total: last7.length,
      last30Total: last30.length,
    };
  }, [filtered]);

  // Active period list to display directly (no hidden accordion barriers)
  const activePeriodInfo = useMemo(() => {
    if (customDate) {
      return {
        title: `🗓️ Riwayat Tap: ${formatDateIndo(customDate)}`,
        color: "#6366F1",
        entries: customDateEntries,
        emptyMsg: `Tidak ada aktivitas tap kartu pada tanggal ${formatDateIndo(customDate)}.`,
      };
    }
    if (dailyMode === "today") {
      return {
        title: `☀️ Tap Masuk Hari Ini — ${formatDateIndo(new Date())}`,
        color: "#10B981",
        entries: hariianPeriods.today,
        emptyMsg: `Pelanggan belum men-tap kartu toko hari ini (${formatDateIndo(new Date())}). Tap baru akan otomatis terdeteksi via live auto-refresh.`,
      };
    }
    if (dailyMode === "last7") {
      return {
        title: "📅 Riwayat Tap 7 Hari Terakhir",
        color: "#6366F1",
        entries: hariianPeriods.last7,
        emptyMsg: "Belum ada aktivitas tap dalam 7 hari terakhir.",
      };
    }
    if (dailyMode === "last30") {
      return {
        title: "🗓️ Riwayat Tap 1 Bulan Terakhir",
        color: "#EC4899",
        entries: hariianPeriods.last30,
        emptyMsg: "Belum ada aktivitas tap dalam 30 hari terakhir.",
      };
    }
    return {
      title: "📑 Semua Riwayat Tap",
      color: "#8B5CF6",
      entries: filtered,
      emptyMsg: "Belum ada aktivitas tap yang tercatat.",
    };
  }, [dailyMode, customDate, customDateEntries, hariianPeriods, filtered]);

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
  const trendData7 = useMemo(() => {
    const days: { label: string; subLabel?: string; value: number; highlight?: boolean; tooltip: string; dateKey: string }[] = [];
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const count = validLogs.filter(l => {
        const t = new Date(l.tappedAt);
        return t >= d && t < next;
      }).length;

      const dayName = i === 0 ? "Hari ini" : dayNames[d.getDay()];
      const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      const fullDate = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const dateKey = toDateInputValue(d);

      days.push({
        label: dayName,
        subLabel: dateStr,
        value: count,
        highlight: i === 0,
        tooltip: `${fullDate}: ${count} tap (Klik untuk bedah rincian jam)`,
        dateKey,
      });
    }
    return days;
  }, [validLogs]);

  const trendData30 = useMemo(() => {
    const days: { label: string; subLabel?: string; value: number; highlight?: boolean; tooltip: string; dateKey: string }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const count = validLogs.filter(l => {
        const t = new Date(l.tappedAt);
        return t >= d && t < next;
      }).length;

      let label = "";
      if (i === 0) {
        label = "Hari ini";
      } else if (i % 5 === 0 || i === 29) {
        label = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      }

      const fullDate = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const dateKey = toDateInputValue(d);

      days.push({
        label,
        value: count,
        highlight: i === 0,
        tooltip: `${fullDate}: ${count} tap (Klik untuk bedah rincian jam)`,
        dateKey,
      });
    }
    return days;
  }, [validLogs]);

  // ── Tab: Riwayat Jam Masuk (Hourly Distribution & Jam Puncak per Periode) ───
  const periodLogsMap = useMemo(() => {
    const now = new Date();
    const todayYmd = toDateInputValue(now);
    const cutoff7 = new Date(now);
    cutoff7.setDate(now.getDate() - 7);
    cutoff7.setHours(0, 0, 0, 0);
    const cutoff30 = new Date(now);
    cutoff30.setDate(now.getDate() - 30);
    cutoff30.setHours(0, 0, 0, 0);

    const sourceLogs = search.trim() ? filtered : validLogs;
    const todayLogs: TapLogEntry[] = [];
    const last7Logs: TapLogEntry[] = [];
    const last30Logs: TapLogEntry[] = [];

    for (const l of sourceLogs) {
      const d = new Date(l.tappedAt);
      if (toDateInputValue(d) === todayYmd) todayLogs.push(l);
      if (d >= cutoff7) last7Logs.push(l);
      if (d >= cutoff30) last30Logs.push(l);
    }

    return {
      today: todayLogs,
      last7: last7Logs,
      last30: last30Logs,
      all: sourceLogs,
    };
  }, [validLogs, filtered, search]);

  const hourPeriodCounts = useMemo(() => ({
    today: periodLogsMap.today.length,
    last7: periodLogsMap.last7.length,
    last30: periodLogsMap.last30.length,
    all: periodLogsMap.all.length,
  }), [periodLogsMap]);

  const peakByPeriod = useMemo(() => {
    function computePeak(logs: TapLogEntry[]) {
      const counts = Array(24).fill(0);
      logs.forEach(l => {
        const h = new Date(l.tappedAt).getHours();
        if (h >= 0 && h < 24) counts[h]++;
      });
      const max = Math.max(...counts);
      if (max === 0) return null;
      const h = counts.indexOf(max);
      return {
        hour: h,
        count: max,
        label: `${String(h).padStart(2, "0")}.00–${String((h + 1) % 24).padStart(2, "0")}.00`,
      };
    }

    return {
      today: computePeak(periodLogsMap.today),
      last7: computePeak(periodLogsMap.last7),
      last30: computePeak(periodLogsMap.last30),
      all: computePeak(periodLogsMap.all),
    };
  }, [periodLogsMap]);

  const hourFilteredLogs = periodLogsMap[hourPeriod];
  const peakHour = peakByPeriod[hourPeriod];

  const hourData = useMemo(() => {
    const counts = Array(24).fill(0);
    hourFilteredLogs.forEach(l => {
      const h = new Date(l.tappedAt).getHours();
      if (h >= 0 && h < 24) counts[h]++;
    });
    const maxH = Math.max(...counts);
    return counts.map((v, i) => {
      const isLabeled = i % 4 === 0 || i === 23;
      const hourStr = String(i).padStart(2, "0");
      const nextHourStr = String((i + 1) % 24).padStart(2, "0");
      return {
        label: isLabeled ? `${hourStr}.00` : "",
        value: v,
        highlight: v === maxH && maxH > 0,
        tooltip: `Pukul ${hourStr}.00 - ${nextHourStr}.00: ${v} tap`,
      };
    });
  }, [hourFilteredLogs]);

  // ── Drill-Down: Rincian Jam Spesifik Tanggal (Saat Batang Tanggal Diklik) ───
  const [selectedDrilldownDate, setSelectedDrilldownDate] = useState<string | null>(null);

  const drilldownLogs = useMemo(() => {
    if (!selectedDrilldownDate) return [];
    const sourceLogs = search.trim() ? filtered : validLogs;
    return sourceLogs.filter(l => toDateInputValue(new Date(l.tappedAt)) === selectedDrilldownDate);
  }, [validLogs, filtered, search, selectedDrilldownDate]);

  const drilldownHourData = useMemo(() => {
    const counts = Array(24).fill(0);
    drilldownLogs.forEach(l => {
      const h = new Date(l.tappedAt).getHours();
      if (h >= 0 && h < 24) counts[h]++;
    });
    const maxH = Math.max(...counts);
    return counts.map((v, i) => {
      const isLabeled = i % 4 === 0 || i === 23;
      const hourStr = String(i).padStart(2, "0");
      const nextHourStr = String((i + 1) % 24).padStart(2, "0");
      return {
        label: isLabeled ? `${hourStr}.00` : "",
        value: v,
        highlight: v === maxH && maxH > 0,
        tooltip: `Pukul ${hourStr}.00 - ${nextHourStr}.00: ${v} tap`,
      };
    });
  }, [drilldownLogs]);

  const drilldownPeakHour = useMemo(() => {
    const counts = Array(24).fill(0);
    drilldownLogs.forEach(l => {
      const h = new Date(l.tappedAt).getHours();
      if (h >= 0 && h < 24) counts[h]++;
    });
    const max = Math.max(...counts);
    if (max === 0) return null;
    const h = counts.indexOf(max);
    return {
      hour: h,
      count: max,
      label: `${String(h).padStart(2, "0")}.00–${String((h + 1) % 24).padStart(2, "0")}.00`,
    };
  }, [drilldownLogs]);

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
            <div className="card stat-card-compact" style={{ borderColor: "rgba(16,185,129,0.25)", background: "linear-gradient(180deg, rgba(16,185,129,0.06), #111118)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="stat-card-title" style={{ fontWeight: 700, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hari Ini</span>
                <span className="stat-card-icon">☀️</span>
              </div>
              <div className="stat-card-value" style={{ fontWeight: 800, color: "#34D399" }}>{todayCount}</div>
              <div className="mobile-hide-sm" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>Tap tercatat hari ini</div>
            </div>

            <div className="card stat-card-compact" style={{ borderColor: "rgba(245,158,11,0.25)", background: "linear-gradient(180deg, rgba(245,158,11,0.06), #111118)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="stat-card-title" style={{ fontWeight: 700, color: "#FCD34D", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bulan Ini</span>
                <span className="stat-card-icon">📅</span>
              </div>
              <div className="stat-card-value" style={{ fontWeight: 800, color: "#FCD34D" }}>{thisMonthCount}</div>
              <div className="mobile-hide-sm" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>{formatMonthLabel(thisMonthKey)}</div>
            </div>

            <div className="card stat-card-compact" style={{ borderColor: "rgba(99,102,241,0.25)", background: "linear-gradient(180deg, rgba(99,102,241,0.06), #111118)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="stat-card-title" style={{ fontWeight: 700, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Tap</span>
                <span className="stat-card-icon">📲</span>
              </div>
              <div className="stat-card-value" style={{ fontWeight: 800, color: "#A5B4FC" }}>{validLogs.length}</div>
              <div className="mobile-hide-sm" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>Kartu aktif terdaftar</div>
            </div>

            <div className="card stat-card-compact" style={{ borderColor: sleepingCards.length > 0 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)", background: "linear-gradient(180deg, rgba(255,255,255,0.02), #111118)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="stat-card-title" style={{ fontWeight: 700, color: sleepingCards.length > 0 ? "#FCA5A5" : "#34D399", textTransform: "uppercase", letterSpacing: "0.05em" }}>Belum Ada Tap</span>
                <span className="stat-card-icon">😴</span>
              </div>
              <div className="stat-card-value" style={{ fontWeight: 800, color: sleepingCards.length > 0 ? "#FCA5A5" : "#34D399" }}>
                {sleepingCards.length}
              </div>
              <div className="mobile-hide-sm" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>Perlu follow up/promosi</div>
            </div>
          </div>

          {/* Sub Navigation Tabs (Grid 2x2 di Mobile agar Belum Ada Tap terlihat dan mudah ditekan) */}
          <div className="taps-nav-grid">
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


                {/* Filter Cepat Periode & Kalender Pemilih Tanggal (2x2 Grid di Mobile, Rapi & Sejajar) */}
                <div className="filter-toolbar-box">
                  {/* Pills Filter Periode Cepat: 2x2 Grid di Mobile */}
                  <div className="filter-pills-group">
                    <button
                      type="button"
                      onClick={() => { setDailyMode("today"); setCustomDate(""); }}
                      className={`btn ${dailyMode === "today" && !customDate ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "8px 10px", fontSize: "0.76rem", borderRadius: 8 }}
                    >
                      ☀️ Hari Ini ({hariianPeriods.todayTotal})
                    </button>

                    <button
                      type="button"
                      onClick={() => { setDailyMode("last7"); setCustomDate(""); }}
                      className={`btn ${dailyMode === "last7" && !customDate ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "8px 10px", fontSize: "0.76rem", borderRadius: 8 }}
                    >
                      📅 7 Hari Terakhir ({hariianPeriods.last7Total})
                    </button>

                    <button
                      type="button"
                      onClick={() => { setDailyMode("last30"); setCustomDate(""); }}
                      className={`btn ${dailyMode === "last30" && !customDate ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "8px 10px", fontSize: "0.76rem", borderRadius: 8 }}
                    >
                      🗓️ 1 Bulan Terakhir ({hariianPeriods.last30Total})
                    </button>

                    <button
                      type="button"
                      onClick={() => { setDailyMode("all"); setCustomDate(""); }}
                      className={`btn ${dailyMode === "all" && !customDate ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "8px 10px", fontSize: "0.76rem", borderRadius: 8 }}
                    >
                      📑 Semua ({filtered.length})
                    </button>
                  </div>

                  {/* Kalender Pemilih Tanggal */}
                  <div className="filter-date-group">
                    <label htmlFor="custom-date-picker" style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                      🗓️ Pilih Tanggal:
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
                          padding: "6px 10px",
                          borderRadius: 8,
                          fontSize: "0.76rem",
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

                {/* DAFTAR DATA TAP LANGSUNG TAMPIL (Tanpa Accordion / Dropdown Tersembunyi) */}
                {activePeriodInfo.entries.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>
                      {dailyMode === "today" ? "☀️" : dailyMode === "last7" ? "📅" : dailyMode === "last30" ? "🗓️" : "📑"}
                    </div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6, color: "#F0F0FF" }}>
                      Tidak Ada Data Tap
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 440, margin: "0 auto 18px", lineHeight: 1.5 }}>
                      {activePeriodInfo.emptyMsg}
                    </p>
                    {dailyMode !== "all" && filtered.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setDailyMode("all"); setCustomDate(""); }}
                        className="btn btn-ghost"
                        style={{ padding: "8px 16px", fontSize: "0.8rem", color: "#A5B4FC", borderColor: "rgba(99,102,241,0.3)" }}
                      >
                        📑 Lihat Semua Riwayat ({filtered.length} tap)
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{
                      padding: "10px 14px",
                      background: "#13131C",
                      borderLeft: `4px solid ${activePeriodInfo.color}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: activePeriodInfo.color, letterSpacing: "0.02em" }}>
                        {activePeriodInfo.title}
                      </div>
                      <span style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        color: activePeriodInfo.color,
                        background: `${activePeriodInfo.color}18`,
                        border: `1px solid ${activePeriodInfo.color}40`,
                        padding: "3px 10px",
                        borderRadius: 999,
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}>
                        {activePeriodInfo.entries.length} TAP
                      </span>
                    </div>

                    <div>
                      {activePeriodInfo.entries.map((log, i) => (
                        <TapItem
                          key={`${log.code}-${log.tappedAt}-${i}`}
                          log={log}
                          reviewUrl={cardUrlMap.get(log.code) || (log.storeName ? getPublicGoogleReviewUrl("", log.storeName) : "")}
                          accentColor={activePeriodInfo.color}
                          timeAgo={timeAgo}
                          formatFull={formatFull}
                        />
                      ))}
                    </div>
                  </div>
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

                                  <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 240, overflowY: "auto" }}>
                                    {storeTaps.map((t, ti) => (
                                      <div
                                        key={`${t.tappedAt}-${ti}`}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          gap: 10,
                                          padding: "7px 8px",
                                          borderRadius: 6,
                                          background: ti % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                                        }}
                                      >
                                        {/* Kolom Kiri: #Nomor + Tanggal & Jam */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                                          <span
                                            style={{
                                              fontFamily: "monospace",
                                              fontSize: "0.72rem",
                                              fontWeight: 700,
                                              color: ti === 0 ? "#FCD34D" : "#7A7A95",
                                              minWidth: 26,
                                              flexShrink: 0,
                                            }}
                                          >
                                            #{ti + 1}
                                          </span>
                                          <span
                                            style={{
                                              color: "#E2E8F0",
                                              fontSize: "0.75rem",
                                              whiteSpace: "nowrap",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                            }}
                                            title={formatFull(t.tappedAt)}
                                          >
                                            {formatTapDateTime(t.tappedAt)}
                                          </span>
                                        </div>

                                        {/* Kolom Kanan: 18m lalu / 2 hari lalu sejajar rapi */}
                                        <div style={{ flexShrink: 0, textAlign: "right" }}>
                                          <span
                                            style={{
                                              display: "inline-block",
                                              fontSize: "0.68rem",
                                              fontWeight: 700,
                                              color: "#34D399",
                                              background: "rgba(16,185,129,0.12)",
                                              border: "1px solid rgba(16,185,129,0.25)",
                                              padding: "2px 8px",
                                              borderRadius: 6,
                                              whiteSpace: "nowrap",
                                              fontFamily: "monospace",
                                            }}
                                          >
                                            {timeAgo(t.tappedAt)}
                                          </span>
                                        </div>
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
              <div className="card" style={{ padding: "20px" }}>
                {/* ── Tampilan 1: Mode Drill-Down Tanggal Spesifik ── */}
                {selectedDrilldownDate ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                          <button
                            type="button"
                            onClick={() => setSelectedDrilldownDate(null)}
                            style={{
                              padding: "5px 12px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              borderRadius: 8,
                              background: "rgba(255, 255, 255, 0.08)",
                              color: "#FFF",
                              border: "1px solid rgba(255, 255, 255, 0.18)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span>←</span>
                            <span>Kembali ke Tren Harian</span>
                          </button>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>• Rincian Jam Spesifik</span>
                        </div>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F0F0FF" }}>
                          🔍 Distribusi Jam Masuk: {formatDateIndo(selectedDrilldownDate)}
                        </h3>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                          Rincian jam kedatangan pelanggan khusus pada hari {formatDateIndo(selectedDrilldownDate)}.
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="badge badge-indigo" style={{ background: "rgba(56,189,248,0.15)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.3)" }}>
                          Total: {drilldownLogs.length} tap
                        </span>
                        {drilldownPeakHour ? (
                          <span className="badge badge-green" style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                            🏆 Jam Puncak: <strong>{drilldownPeakHour.label}</strong> ({drilldownPeakHour.count} tap)
                          </span>
                        ) : (
                          <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                            Tidak ada tap
                          </span>
                        )}
                      </div>
                    </div>

                    <BarChart
                      data={drilldownHourData}
                      color="#38BDF8"
                      yAxisUnit="Tap"
                      xAxisTitle="Jam"
                      showValue={true}
                    />

                    {drilldownLogs.length === 0 && (
                      <div style={{
                        textAlign: "center",
                        padding: "16px",
                        marginTop: "12px",
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: "8px",
                        border: "1px dashed rgba(255,255,255,0.1)",
                        color: "var(--text-muted)",
                        fontSize: "0.8rem",
                      }}>
                        ℹ️ Tidak ada riwayat tap yang tercatat pada {formatDateIndo(selectedDrilldownDate)}.
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* ── Header Card dengan Mode Switcher Terpadu ── */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F0F0FF" }}>
                          {trenView === "jam"
                            ? `⏱️ Distribusi Jam Masuk ${hourPeriod === "today" ? "(Hari Ini)" : hourPeriod === "last7" ? "(7 Hari Terakhir)" : hourPeriod === "last30" ? "(1 Bulan Terakhir)" : "(Semua Riwayat)"}`
                            : `📈 Tren Aktivitas Harian (${trendRange} Hari Terakhir)`}
                        </h3>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {trenView === "jam"
                            ? (hourPeriod === "today"
                                ? `Analisis jam berapa pelanggan men-tap kartu khusus hari ini (${formatDateIndo(new Date())}).`
                                : hourPeriod === "last7"
                                ? "Analisis jam sibuk pelanggan men-tap kartu dalam 7 hari terakhir."
                                : hourPeriod === "last30"
                                ? "Analisis jam sibuk pelanggan men-tap kartu dalam 1 bulan terakhir."
                                : "Analisis jam sibuk pelanggan men-tap kartu dari seluruh riwayat tap yang tercatat.")
                            : "Jumlah tap per hari pada semua kartu aktif. Klik pada salah satu batang tanggal untuk membedah jam sibuknya."}
                        </p>
                      </div>

                      {/* Mode Switcher: Distribusi Jam Masuk vs Tren Harian */}
                      <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.06)", padding: 4, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                        <button
                          type="button"
                          onClick={() => setTrenView("jam")}
                          style={{
                            padding: "6px 14px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            borderRadius: 8,
                            background: trenView === "jam" ? "#6366F1" : "transparent",
                            color: trenView === "jam" ? "#FFF" : "var(--text-muted)",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            transition: "all 0.15s ease",
                            boxShadow: trenView === "jam" ? "0 2px 8px rgba(99,102,241,0.35)" : "none",
                          }}
                        >
                          <span>⏱️</span>
                          <span>Distribusi Jam Masuk</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrenView("harian")}
                          style={{
                            padding: "6px 14px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            borderRadius: 8,
                            background: trenView === "harian" ? "#F59E0B" : "transparent",
                            color: trenView === "harian" ? "#000" : "var(--text-muted)",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            transition: "all 0.15s ease",
                            boxShadow: trenView === "harian" ? "0 2px 8px rgba(245,158,11,0.35)" : "none",
                          }}
                        >
                          <span>📅</span>
                          <span>Tren Harian ({trendRange} Hari)</span>
                        </button>
                      </div>
                    </div>

                    {/* ── View 1: Distribusi Jam Masuk Global ── */}
                    {trenView === "jam" && (
                      <div>
                        {/* Badges Info */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span className="badge badge-indigo" style={{ background: "rgba(99,102,241,0.15)", color: "#A5B4FC", border: "1px solid rgba(99,102,241,0.3)" }}>
                              Total: {hourFilteredLogs.length} tap
                            </span>
                            {peakHour ? (
                              <span className="badge badge-green" style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                🏆 Jam Puncak {hourPeriod === "today" ? "Hari Ini" : hourPeriod === "last7" ? "(7 Hari Terakhir)" : hourPeriod === "last30" ? "(1 Bulan Terakhir)" : "(Semua Riwayat)"}: <strong>{peakHour.label}</strong> ({peakHour.count} tap)
                              </span>
                            ) : (
                              <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                                Belum ada aktivitas
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Filter Periode & Ringkasan Jam Puncak per Periode */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 16 }}>
                          {(
                            [
                              { id: "today", icon: "☀️", label: "Hari Ini" },
                              { id: "last7", icon: "📅", label: "7 Hari Terakhir" },
                              { id: "last30", icon: "🗓️", label: "1 Bulan Terakhir" },
                              { id: "all", icon: "📑", label: "Semua Riwayat" },
                            ] as const
                          ).map(p => {
                            const isAct = hourPeriod === p.id;
                            const count = hourPeriodCounts[p.id];
                            const peak = peakByPeriod[p.id];
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setHourPeriod(p.id)}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                  padding: "10px 14px",
                                  borderRadius: 10,
                                  background: isAct ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                  border: isAct ? "1.5px solid #6366F1" : "1px solid rgba(255, 255, 255, 0.08)",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "all 0.15s ease",
                                  boxShadow: isAct ? "0 0 14px rgba(99,102,241,0.25)" : "none",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
                                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: isAct ? "#A5B4FC" : "#E2E8F0" }}>
                                    {p.icon} {p.label}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.72rem",
                                      fontWeight: 700,
                                      padding: "2px 7px",
                                      borderRadius: 6,
                                      background: isAct ? "#6366F1" : "rgba(255,255,255,0.08)",
                                      color: "#FFF",
                                    }}
                                  >
                                    {count} tap
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.72rem", color: isAct ? "#CBD5E1" : "var(--text-muted)", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
                                  <span>🏆 Puncak:</span>
                                  <strong style={{ color: isAct ? "#34D399" : "#94A3B8" }}>
                                    {peak ? `${peak.label} (${peak.count} tap)` : "Belum ada"}
                                  </strong>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <BarChart
                          data={hourData}
                          color="#6366F1"
                          yAxisUnit="Tap"
                          xAxisTitle="Jam"
                          showValue={true}
                        />

                        {hourFilteredLogs.length === 0 && (
                          <div style={{
                            textAlign: "center",
                            padding: "16px",
                            marginTop: "12px",
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: "8px",
                            border: "1px dashed rgba(255,255,255,0.1)",
                            color: "var(--text-muted)",
                            fontSize: "0.8rem",
                          }}>
                            ℹ️ Belum ada tap yang masuk pada periode ini. Jika ada pelanggan men-tap kartu, tap baru akan otomatis terhitung via live auto-refresh.
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── View 2: Tren Harian dengan Fitur Drill-Down ── */}
                    {trenView === "harian" && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {/* Range Switcher (7 Hari vs 30 Hari) */}
                            <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.06)", padding: 3, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                              <button
                                type="button"
                                onClick={() => setTrendRange(7)}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: "0.74rem",
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  background: trendRange === 7 ? "#F59E0B" : "transparent",
                                  color: trendRange === 7 ? "#000" : "#94A3B8",
                                  border: "none",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                7 Hari
                              </button>
                              <button
                                type="button"
                                onClick={() => setTrendRange(30)}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: "0.74rem",
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  background: trendRange === 30 ? "#F59E0B" : "transparent",
                                  color: trendRange === 30 ? "#000" : "#94A3B8",
                                  border: "none",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                30 Hari
                              </button>
                            </div>

                            <span className="badge badge-orange">
                              Total {trendRange} Hari: {(trendRange === 7 ? trendData7 : trendData30).reduce((s, d) => s + d.value, 0)} tap
                            </span>

                            {(() => {
                              const currentData = trendRange === 7 ? trendData7 : trendData30;
                              const maxDay = currentData.reduce((prev, cur) => (cur.value > prev.value ? cur : prev), currentData[0]);
                              if (maxDay && maxDay.value > 0) {
                                return (
                                  <span className="badge badge-green">
                                    🏆 Hari Teramai: {maxDay.label || maxDay.subLabel} ({maxDay.value} tap)
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {/* Petunjuk Interaktif Drill-Down */}
                          <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            background: "rgba(56, 189, 248, 0.08)",
                            border: "1px dashed rgba(56, 189, 248, 0.3)",
                            borderRadius: 8,
                            fontSize: "0.72rem",
                            color: "#7DD3FC",
                          }}>
                            <span>👆</span>
                            <span><strong>Klik salah satu batang tanggal</strong> untuk membedah jam ramainya</span>
                          </div>
                        </div>

                        <BarChart
                          data={trendRange === 7 ? trendData7 : trendData30}
                          color="#F59E0B"
                          yAxisUnit="Tap"
                          xAxisTitle="Tanggal"
                          showValue={true}
                          onBarClick={(_idx, item: any) => {
                            if (item.dateKey) {
                              setSelectedDrilldownDate(item.dateKey);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
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
                    {sleepingCards.map((card) => {
                      const reviewUrl = card.googleReviewUrl ? getPublicGoogleReviewUrl(card.googleReviewUrl, card.storeName) : "";
                      const targetUrl = reviewUrl || `/c/${card.code}`;
                      return (
                        <div
                          key={card.code}
                          className="card"
                          onClick={() => {
                            window.open(targetUrl, "_blank");
                          }}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 16px",
                            borderLeft: "4px solid #EF4444",
                            gap: 12,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            background: "rgba(239,68,68,0.03)",
                          }}
                          title="Klik kartu ini untuk membuka menu ulasan Google / tes link"
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: 10,
                              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem",
                              flexShrink: 0,
                            }}>😴</div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#F0F0FF", wordBreak: "break-word" }}>
                                {card.storeName}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span>Kode: <strong style={{ fontFamily: "monospace", color: "#A5B4FC" }}>{card.code}</strong></span>
                                <span>·</span>
                                <span>Dibuat: {new Date(card.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                              </div>
                            </div>
                          </div>

                          <div
                            style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span style={{
                              fontSize: "0.7rem", fontWeight: 700,
                              color: "#FCA5A5", background: "rgba(239,68,68,0.12)",
                              border: "1px solid rgba(239,68,68,0.25)",
                              padding: "4px 8px", borderRadius: 999,
                              whiteSpace: "nowrap",
                            }}>
                              Belum Ada Tap
                            </span>
                            <a
                              href={`/c/${card.code}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-ghost"
                              style={{ padding: "5px 9px", fontSize: "0.72rem", borderRadius: 7 }}
                              title="Buka link kartu untuk uji coba tap"
                            >
                              Tes Link ↗
                            </a>
                            {reviewUrl && (
                              <a
                                href={reviewUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: "5px 9px", fontSize: "0.72rem",
                                  color: "#FCD34D", textDecoration: "none", fontWeight: 700,
                                  background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                                  borderRadius: 7, display: "inline-flex", alignItems: "center", gap: 4,
                                  whiteSpace: "nowrap",
                                }}
                                title="Buka menu ulasan Google publik toko ini"
                              >
                                ⭐ Menu Ulasan ↗
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

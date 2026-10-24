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

// ── SVG Bar Chart (Mobile-Adaptive, Large Numbers, Zero-Squish) ──────
function BarChart({
  data,
  color = "#6366F1",
  yAxisUnit = "Tap",
  xAxisTitle = "",
  showValue = true,
  onBarClick,
  selectedIndex,
}: {
  data: {
    label: string;
    subLabel?: string;
    mobileSubLabel?: string;
    value: number;
    highlight?: boolean;
    tooltip?: string;
    dateKey?: string;
    weekKey?: string;
  }[];
  color?: string;
  yAxisUnit?: string;
  xAxisTitle?: string;
  showValue?: boolean;
  onBarClick?: (index: number, item: any) => void;
  selectedIndex?: number | null;
}) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const maxVal = Math.max(...data.map((d) => d.value), 0);
  const { niceMax, ticks } = getNiceYScale(maxVal);

  const isFewBars = data.length <= 8;
  const W = isMobile ? (isFewBars ? 380 : Math.max(data.length * 32, 600)) : 820;
  const H = 220;
  const PAD_L = isMobile ? 32 : 46;
  const PAD_R = isMobile ? 12 : 24;
  const PAD_T = isMobile ? 32 : 28;
  const PAD_B = 38;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const y0 = PAD_T + chartH;

  const slotW = data.length > 0 ? chartW / data.length : chartW;
  const barW = Math.max(Math.min(Math.floor(slotW * 0.72), isMobile && isFewBars ? 28 : 34), 6);

  const valFontSize = isMobile ? (isFewBars ? 16 : 13) : (isFewBars ? 14 : 12);
  const xLabelFontSize = isMobile ? (isFewBars ? 11.5 : 10) : 10;
  const xSubLabelFontSize = isMobile ? (isFewBars ? 9.5 : 8.5) : 8.5;

  return (
    <div style={{ width: "100%", overflowX: isMobile && !isFewBars ? "auto" : "hidden", WebkitOverflowScrolling: "touch" }}>
      {isMobile && !isFewBars && (
        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
          <span>↔ Geser grafik untuk melihat 24 jam / hari lainnya</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: "100%",
          minWidth: isMobile && !isFewBars ? W : "100%",
          height: "auto",
          display: "block",
        }}
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
                x={PAD_L - 6}
                y={y + 3.5}
                fill="#94A3B8"
                fontSize={isMobile ? 10 : 10.5}
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
            x={W - PAD_R + 8}
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

              {/* Invisible full-height hit area for effortless clicking / touch targets */}
              {isClickable && (
                <rect
                  x={cx - slotW / 2}
                  y={PAD_T}
                  width={slotW}
                  height={chartH + PAD_B}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                />
              )}

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

              {/* Value on top of bar (Large, Bold & Crisp on Mobile) */}
              {showValue && d.value > 0 && (
                <text
                  x={cx}
                  y={by - 6}
                  fill={isHighlight ? "#34D399" : "#FFFFFF"}
                  fontSize={valFontSize}
                  fontWeight={800}
                  textAnchor="middle"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
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

              {/* Sumbu X: Primary Label & Sub-label */}
              {isMobile && d.label && d.label.startsWith("Minggu ") ? (
                <>
                  <text
                    x={cx}
                    y={y0 + 11}
                    fill={isHighlight ? "#34D399" : "#94A3B8"}
                    fontSize={8.5}
                    fontWeight={600}
                    textAnchor="middle"
                  >
                    Minggu
                  </text>
                  <text
                    x={cx}
                    y={y0 + 22}
                    fill={isHighlight ? "#34D399" : "#E2E8F0"}
                    fontSize={10}
                    fontWeight={800}
                    textAnchor="middle"
                  >
                    {d.label.replace("Minggu ", "")}
                  </text>
                  {d.subLabel && (
                    <text
                      x={cx}
                      y={y0 + 33}
                      fill={isHighlight ? "#A7F3D0" : "#64748B"}
                      fontSize={7.5}
                      fontWeight={isHighlight ? 700 : 500}
                      textAnchor="middle"
                    >
                      {d.mobileSubLabel || d.subLabel}
                    </text>
                  )}
                </>
              ) : (
                <>
                  {d.label && (
                    <text
                      x={cx}
                      y={y0 + (d.subLabel ? 14 : 17)}
                      fill={isHighlight ? "#34D399" : "#94A3B8"}
                      fontSize={xLabelFontSize}
                      fontWeight={isHighlight ? 700 : 600}
                      textAnchor="middle"
                    >
                      {d.label}
                    </text>
                  )}
                  {d.subLabel && (
                    <text
                      x={cx}
                      y={y0 + 26}
                      fill={isHighlight ? "#A7F3D0" : "#64748B"}
                      fontSize={xSubLabelFontSize}
                      fontWeight={isHighlight ? 700 : 500}
                      textAnchor="middle"
                    >
                      {d.subLabel}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}



// ── InteractiveBreadcrumb — Navigasi Mundur-Maju 3 Level ─────────────
function InteractiveBreadcrumb({
  items,
  onBack,
  backLabel = "Kembali",
}: {
  items: {
    label: string;
    icon?: string;
    active?: boolean;
    onClick?: () => void;
  }[];
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="interactive-breadcrumb-bar">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="breadcrumb-back-btn"
          title={backLabel}
        >
          <span>←</span>
          <span>{backLabel}</span>
        </button>
      )}

      <div className="breadcrumb-trail">
        {items.map((item, idx) => {
          return (
            <div key={idx} className="breadcrumb-item-wrapper">
              {idx > 0 && <span className="breadcrumb-separator">›</span>}
              {item.onClick && !item.active ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="breadcrumb-chip clickable"
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              ) : (
                <span className={`breadcrumb-chip ${item.active ? "active" : ""}`}>
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CafeBreakdownCard — Ranking kontribusi toko/cafe ───────────────────
function CafeBreakdownCard({
  title,
  subtitle,
  logs,
  cardUrlMap,
}: {
  title: string;
  subtitle: string;
  logs: TapLogEntry[];
  cardUrlMap: Map<string, string>;
}) {
  const [showAll, setShowAll] = useState(false);
  const countsByStore = useMemo(() => {
    const map = new Map<string, { count: number; code: string; storeName: string }>();
    for (const log of logs) {
      const name = log.storeName || "Toko Tanpa Nama";
      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(name, { count: 1, code: log.code, storeName: name });
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [logs]);

  const total = logs.length;
  const max = countsByStore.length > 0 ? countsByStore[0].count : 1;
  const visibleStores = showAll ? countsByStore : countsByStore.slice(0, 5);

  if (countsByStore.length === 0) {
    return (
      <div className="cafe-breakdown-card" style={{ textAlign: "center", padding: "24px 16px" }}>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
          ☕ Belum ada aktivitas tap cafe pada rentang waktu ini.
        </p>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="cafe-breakdown-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F0F0FF", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
            <span>☕</span> {title}
          </h4>
          <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2, marginBottom: 0 }}>
            {subtitle}
          </p>
        </div>
        <span className="badge badge-indigo" style={{ fontSize: "0.74rem", fontWeight: 700 }}>
          {countsByStore.length} Toko · {total} Tap
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleStores.map((store, i) => {
          const relativePercent = Math.round((store.count / max) * 100);
          const reviewUrl = cardUrlMap.get(store.code) || (store.storeName ? getPublicGoogleReviewUrl("", store.storeName) : "");

          return (
            <div key={store.storeName} className="cafe-breakdown-item">
              <div className="cafe-breakdown-row1">
                <div className="cafe-breakdown-info">
                  <span className="cafe-rank-badge">
                    {i < 3 ? medals[i] : `#${i + 1}`}
                  </span>
                  <span className="cafe-store-name">
                    {store.storeName}
                  </span>
                  <span className="cafe-code-badge">
                    {store.code}
                  </span>
                </div>

                <div className="cafe-breakdown-stats">
                  <span className="cafe-tap-count">
                    {store.count} tap
                  </span>
                  {reviewUrl && (
                    <a
                      href={reviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="cafe-review-link"
                      title="Buka menu ulasan toko ini"
                    >
                      <span>⭐</span> ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ background: "rgba(255,255,255,0.06)", height: 6, borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${relativePercent}%`,
                    height: "100%",
                    background: i === 0
                      ? "linear-gradient(90deg, #F59E0B, #FCD34D)"
                      : "linear-gradient(90deg, #6366F1, #818CF8)",
                    borderRadius: 999,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {countsByStore.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          style={{
            marginTop: 10,
            padding: "8px 12px",
            fontSize: "0.78rem",
            fontWeight: 600,
            borderRadius: 8,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.09)",
            color: "#CBD5E1",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            transition: "all 0.15s ease",
          }}
        >
          <span>{showAll ? "▴ Ciutkan (Tampilkan Top 5 Saja)" : `▾ Tampilkan Semua (${countsByStore.length} Toko)`}</span>
        </button>
      )}
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
      className="tap-item-row"
      style={{ borderLeftColor: accentColor }}
    >
      {/* Kolom Kiri: Jam Tap Box */}
      <div
        className="tap-item-time"
        title={formatFull(log.tappedAt)}
      >
        <span className="tap-item-clock">{timeStr}</span>
        <span className="tap-item-date">{dateStr}</span>
      </div>

      {/* Kolom Kanan: Body Toko & Action */}
      <div className="tap-item-body">
        {/* Info Toko Utama: Nama Toko Penuh */}
        <div className="tap-item-main-info">
          <div className="tap-item-store-name" title={log.storeName}>
            {log.storeName}
          </div>

          {/* Desktop Only Meta: Tampil di bawah nama toko saat desktop */}
          <div className="tap-item-meta desktop-only-meta">
            <span className="tap-item-code">{log.code}</span>
            <span className="tap-item-dot">·</span>
            <span className="tap-item-ago">
              <span style={{ opacity: 0.8 }}>🕒</span> {timeAgo(log.tappedAt)}
            </span>
          </div>
        </div>

        {/* Action Wrap: Di mobile baris kedua (kiri: meta, kanan: tombol ulasan) */}
        <div className="tap-item-actions-wrap">
          {/* Mobile Only Meta: Sejajar dengan tombol ulasan di mobile */}
          <div className="tap-item-meta mobile-only-meta">
            <span className="tap-item-code">{log.code}</span>
            <span className="tap-item-ago">
              <span style={{ opacity: 0.8 }}>🕒</span> {timeAgo(log.tappedAt)}
            </span>
          </div>

          {reviewUrl && (
            <a
              href={reviewUrl}
              target="_blank"
              rel="noreferrer"
              className="tap-item-review-btn"
              title="Buka menu ulasan Google publik toko ini"
            >
              <span>⭐</span>
              <span>Menu Ulasan ↗</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}



// ── Main Page ─────────────────────────────────────────────────────────
export default function TapsPage() {
  const [logs, setLogs] = useState<TapLogEntry[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"harian" | "bulanan" | "tren" | "tidur">("harian");
  const [dailyMode, setDailyMode] = useState<"today" | "last7" | "last30" | "all" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [trendRange, setTrendRange] = useState<7 | 30 | "custom">(7);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return toDateInputValue(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => toDateInputValue(new Date()));
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("all");
  const [trenView, setTrenView] = useState<"jam" | "harian" | "mingguan">("jam");
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
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
    // Sinkronisasi data otomatis di latar belakang setiap 30 detik (default otomatis)
    const timer = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // ── Tombol Melayang: Scroll Kembali ke Atas ─────────────────────────
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 320) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }


  // ── Helpers ──────────────────────────────────────────────────────────
  function getWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  function getWeekRange(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const startStr = monday.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const endStr = sunday.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

    const weekKey = `${monday.getFullYear()}-W${String(getWeekNumber(monday)).padStart(2, "0")}`;
    const label = `${startStr} - ${endStr}`;

    return { start: monday, end: sunday, label, weekKey };
  }
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
  function formatDateShortIndo(dateInput: string | Date) {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
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

      const allKey = `all::${entry.storeName}`;
      if (!map.has(allKey)) map.set(allKey, []);
      map.get(allKey)!.push(entry);
    }
    map.forEach((arr) => arr.sort((a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime()));
    return map;
  }, [validLogs]);

  const allTimeGroup = useMemo((): MonthGroup => {
    const map = new Map<string, { count: number; code: string }>();
    for (const entry of validLogs) {
      const current = map.get(entry.storeName) || { count: 0, code: entry.code };
      map.set(entry.storeName, { count: current.count + 1, code: entry.code });
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
      label: "Sepanjang Masa (All-Time)",
      total: byStore.reduce((s, x) => s + x.count, 0),
      byStore,
    };
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

  // Kelompokkan bulan per tahun untuk dropdown yang bersih, rapi, dan tahan masa depan
  const monthsByYear = useMemo(() => {
    const yearMap = new Map<string, MonthGroup[]>();

    for (const mg of monthlyGroups) {
      const year = mg.monthKey.split("-")[0];
      if (!yearMap.has(year)) yearMap.set(year, []);
      yearMap.get(year)!.push(mg);
    }

    // Pastikan bulan berjalan selalu ada di dalam list meski belum ada tap
    const curYear = thisMonthKey.split("-")[0];
    if (!yearMap.has(curYear)) yearMap.set(curYear, []);
    if (!monthlyGroups.some(mg => mg.monthKey === thisMonthKey)) {
      yearMap.get(curYear)!.unshift({
        monthKey: thisMonthKey,
        label: formatMonthLabel(thisMonthKey),
        total: 0,
        byStore: [],
      });
    }

    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b.localeCompare(a));
    return sortedYears.map(year => ({
      year,
      months: yearMap.get(year)!.sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    }));
  }, [monthlyGroups, thisMonthKey]);

  const selectedMonthGroup = useMemo(() => {
    if (selectedMonthKey === "all") {
      const matchingStores = allTimeGroup.byStore.filter(s =>
        s.storeName.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())
      );
      return {
        ...allTimeGroup,
        byStore: matchingStores,
        total: matchingStores.reduce((s, x) => s + x.count, 0),
      };
    }
    return (
      filteredMonthly.find(mg => mg.monthKey === selectedMonthKey) ||
      monthlyGroups.find(mg => mg.monthKey === selectedMonthKey) ||
      null
    );
  }, [selectedMonthKey, allTimeGroup, filteredMonthly, monthlyGroups, search]);

  const isCurrentSelected = selectedMonthKey === thisMonthKey;

  // ── Tab: Tren (Global Outlet Filter & Perhitungan Dinamis) ───────────
  const availableStores = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => { if (c.storeName) set.add(c.storeName); });
    validLogs.forEach(l => { if (l.storeName) set.add(l.storeName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cards, validLogs]);

  const storeFilteredLogs = useMemo(() => {
    let list = validLogs;
    if (selectedStoreFilter !== "all") {
      list = list.filter(l => l.storeName === selectedStoreFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => l.storeName.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
    }
    return list;
  }, [validLogs, selectedStoreFilter, search]);

  const trendData7 = useMemo(() => {
    const days: { label: string; subLabel?: string; value: number; highlight?: boolean; tooltip: string; dateKey: string }[] = [];
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const count = storeFilteredLogs.filter(l => {
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
  }, [storeFilteredLogs]);

  const trendData30 = useMemo(() => {
    const days: { label: string; subLabel?: string; value: number; highlight?: boolean; tooltip: string; dateKey: string }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const count = storeFilteredLogs.filter(l => {
        const t = new Date(l.tappedAt);
        return t >= d && t < next;
      }).length;

      const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      let label = "";
      if (i === 0) {
        label = "Hari ini";
      } else if (i % 5 === 0 || i === 29) {
        label = dateStr;
      }

      const fullDate = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const dateKey = toDateInputValue(d);

      days.push({
        label,
        subLabel: dateStr,
        value: count,
        highlight: i === 0,
        tooltip: `${fullDate}: ${count} tap (Klik untuk bedah rincian jam)`,
        dateKey,
      });
    }
    return days;
  }, [storeFilteredLogs]);

  const customTrendData = useMemo(() => {
    if (trendRange !== "custom") return [];
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

    const days: { label: string; subLabel?: string; value: number; highlight?: boolean; tooltip: string; dateKey: string }[] = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endLimit = new Date(end);
    endLimit.setHours(23, 59, 59, 999);

    let stepCount = 0;
    while (current <= endLimit && stepCount < 90) {
      const d = new Date(current);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const count = storeFilteredLogs.filter(l => {
        const t = new Date(l.tappedAt);
        return t >= d && t < next;
      }).length;

      const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      const fullDate = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const dateKey = toDateInputValue(d);

      days.push({
        label: dateStr,
        subLabel: dateStr,
        value: count,
        highlight: false,
        tooltip: `${fullDate}: ${count} tap (Klik untuk bedah rincian jam)`,
        dateKey,
      });

      current.setDate(current.getDate() + 1);
      stepCount++;
    }
    return days;
  }, [trendRange, customStartDate, customEndDate, storeFilteredLogs]);

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

    const todayLogs: TapLogEntry[] = [];
    const last7Logs: TapLogEntry[] = [];
    const last30Logs: TapLogEntry[] = [];

    for (const l of storeFilteredLogs) {
      const d = new Date(l.tappedAt);
      if (toDateInputValue(d) === todayYmd) todayLogs.push(l);
      if (d >= cutoff7) last7Logs.push(l);
      if (d >= cutoff30) last30Logs.push(l);
    }

    return {
      today: todayLogs,
      last7: last7Logs,
      last30: last30Logs,
      all: storeFilteredLogs,
    };
  }, [storeFilteredLogs]);

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
    return storeFilteredLogs.filter(l => toDateInputValue(new Date(l.tappedAt)) === selectedDrilldownDate);
  }, [storeFilteredLogs, selectedDrilldownDate]);

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

  // ── Tren Mingguan (8 Minggu Terakhir) & Drilldown ─────────────────────
  const weeklyTrendData = useMemo(() => {
    const weeks: {
      weekKey: string;
      label: string;
      subLabel: string;
      mobileSubLabel: string;
      start: Date;
      end: Date;
      count: number;
      logs: TapLogEntry[];
    }[] = [];

    const now = new Date();
    const currentWeekInfo = getWeekRange(now);

    for (let i = 7; i >= 0; i--) {
      const refDate = new Date(currentWeekInfo.start);
      refDate.setDate(refDate.getDate() - (i * 7));
      const wInfo = getWeekRange(refDate);

      const wLogs = storeFilteredLogs.filter(l => {
        const t = new Date(l.tappedAt).getTime();
        return t >= wInfo.start.getTime() && t <= wInfo.end.getTime();
      });

      const sDay = wInfo.start.getDate();
      const sMo = wInfo.start.getMonth() + 1;
      const eDay = wInfo.end.getDate();
      const eMo = wInfo.end.getMonth() + 1;
      const mobileRange = `${sDay}/${sMo}-${eDay}/${eMo}`;

      weeks.push({
        weekKey: wInfo.weekKey,
        label: wInfo.label,
        subLabel: `Minggu ${getWeekNumber(wInfo.start)}`,
        mobileSubLabel: mobileRange,
        start: wInfo.start,
        end: wInfo.end,
        count: wLogs.length,
        logs: wLogs,
      });
    }

    return weeks;
  }, [storeFilteredLogs]);

  const selectedWeekObj = useMemo(() => {
    if (!selectedWeekKey) return null;
    return weeklyTrendData.find(w => w.weekKey === selectedWeekKey) || null;
  }, [selectedWeekKey, weeklyTrendData]);

  const weekDailyData = useMemo(() => {
    if (!selectedWeekObj) return [];
    const days: {
      label: string;
      subLabel: string;
      dateKey: string;
      date: Date;
      value: number;
      logs: TapLogEntry[];
      highlight?: boolean;
      tooltip?: string;
    }[] = [];

    const dayNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
    const maxVal = Math.max(...dayNames.map((_, i) => {
      const d = new Date(selectedWeekObj.start);
      d.setDate(d.getDate() + i);
      const dateKey = toDateInputValue(d);
      return selectedWeekObj.logs.filter(l => toDateInputValue(new Date(l.tappedAt)) === dateKey).length;
    }), 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(selectedWeekObj.start);
      d.setDate(d.getDate() + i);
      const dateKey = toDateInputValue(d);
      const dLogs = selectedWeekObj.logs.filter(l => toDateInputValue(new Date(l.tappedAt)) === dateKey);

      days.push({
        label: dayNames[i],
        subLabel: `${d.getDate()}/${d.getMonth() + 1}`,
        dateKey,
        date: d,
        value: dLogs.length,
        logs: dLogs,
        highlight: dLogs.length === maxVal && maxVal > 0,
        tooltip: `${dayNames[i]}, ${d.getDate()}/${d.getMonth() + 1}: ${dLogs.length} tap`,
      });
    }

    return days;
  }, [selectedWeekObj]);

  const weeklyChartData = useMemo(() => {
    const maxV = Math.max(...weeklyTrendData.map(w => w.count), 0);
    return weeklyTrendData.map(w => {
      const isSelected = selectedWeekKey === w.weekKey;
      return {
        label: w.subLabel,
        subLabel: w.label,
        mobileSubLabel: w.mobileSubLabel,
        value: w.count,
        weekKey: w.weekKey,
        highlight: isSelected || (w.count === maxV && maxV > 0),
        tooltip: `${w.subLabel} (${w.label}): ${w.count} tap`,
      };
    });
  }, [weeklyTrendData, selectedWeekKey]);

  const eightWeeksLogs = useMemo(() => {
    if (weeklyTrendData.length === 0) return [];
    const earliest = weeklyTrendData[0].start.getTime();
    const latest = weeklyTrendData[weeklyTrendData.length - 1].end.getTime();
    return storeFilteredLogs.filter(l => {
      const t = new Date(l.tappedAt).getTime();
      return t >= earliest && t <= latest;
    });
  }, [storeFilteredLogs, weeklyTrendData]);

  const trendRangeLogs = useMemo(() => {
    if (trendRange === "custom") {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return storeFilteredLogs.filter(l => {
        const t = new Date(l.tappedAt);
        return t >= start && t <= end;
      });
    }
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - trendRange);
    cutoff.setHours(0, 0, 0, 0);
    return storeFilteredLogs.filter(l => new Date(l.tappedAt) >= cutoff);
  }, [storeFilteredLogs, trendRange, customStartDate, customEndDate]);
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Clean Live Sync Badge (30 detik default) */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 12px",
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                }}
                title="Data tap otomatis diperbarui setiap 30 detik di latar belakang"
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#10B981",
                    boxShadow: "0 0 8px #10B981",
                    animation: isUpdating ? "none" : "pulseDot 2s infinite",
                  }}
                />
                <span style={{ color: "#34D399", fontWeight: 700 }}>
                  {isUpdating ? "Sinkronisasi..." : "Live Auto-Sync (30s)"}
                </span>
              </div>
            </div>
          </div>





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
            <div
              className="card stat-card-compact"
              onClick={() => { setActiveTab("harian"); setDailyMode("today"); setCustomDate(""); }}
              style={{ borderColor: "rgba(16,185,129,0.25)", background: "linear-gradient(180deg, rgba(16,185,129,0.06), #111118)", cursor: "pointer", transition: "all 0.2s ease" }}
              title="Klik untuk membuka Riwayat Hari Ini"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="stat-card-title" style={{ fontWeight: 700, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hari Ini</span>
                <span className="stat-card-icon">☀️</span>
              </div>
              <div className="stat-card-value" style={{ fontWeight: 800, color: "#34D399" }}>{todayCount}</div>
              <div className="mobile-hide-sm" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>Tap tercatat hari ini</div>
            </div>

            <div
              className="card stat-card-compact"
              onClick={() => { setActiveTab("bulanan"); setSelectedMonth(thisMonthKey); }}
              style={{ borderColor: "rgba(245,158,11,0.25)", background: "linear-gradient(180deg, rgba(245,158,11,0.06), #111118)", cursor: "pointer", transition: "all 0.2s ease" }}
              title="Klik untuk membuka Rekap Bulanan"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="stat-card-title" style={{ fontWeight: 700, color: "#FCD34D", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bulan Ini</span>
                <span className="stat-card-icon">📅</span>
              </div>
              <div className="stat-card-value" style={{ fontWeight: 800, color: "#FCD34D" }}>{thisMonthCount}</div>
              <div className="mobile-hide-sm" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>{formatMonthLabel(thisMonthKey)}</div>
            </div>

            <div
              className="card stat-card-compact"
              onClick={() => setActiveTab("tren")}
              style={{ borderColor: "rgba(99,102,241,0.25)", background: "linear-gradient(180deg, rgba(99,102,241,0.06), #111118)", cursor: "pointer", transition: "all 0.2s ease" }}
              title="Klik untuk membuka Tren & Analitik"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="stat-card-title" style={{ fontWeight: 700, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Tap</span>
                <span className="stat-card-icon">📲</span>
              </div>
              <div className="stat-card-value" style={{ fontWeight: 800, color: "#A5B4FC" }}>{validLogs.length}</div>
              <div className="mobile-hide-sm" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>Kartu aktif terdaftar</div>
            </div>

            <div
              className="card stat-card-compact"
              onClick={() => setActiveTab("tidur")}
              style={{ borderColor: sleepingCards.length > 0 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)", background: "linear-gradient(180deg, rgba(255,255,255,0.02), #111118)", cursor: "pointer", transition: "all 0.2s ease" }}
              title="Klik untuk melihat Kartu Belum Ada Tap"
            >
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
              onClick={() => { setActiveTab("tren"); setTrenView("mingguan"); }}
              className={`btn ${activeTab === "tren" ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "8px 16px", fontSize: "0.85rem", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>📈</span> Tren, Jam & Cafe
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
                {/* Selector Pemilih Bulan Terpadu (Dropdown Rapi Dikelompokkan per Tahun) */}
                <div className="month-selector-bar" style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 12, marginBottom: 18, flexWrap: "wrap",
                  background: "#111118", padding: "12px 16px",
                  borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <label
                      htmlFor="unified-month-select"
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "#E0E0F0",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>📅</span>
                      <span>Pilih Bulan:</span>
                    </label>

                    <div style={{ position: "relative", display: "inline-block" }}>
                      <select
                        id="unified-month-select"
                        value={selectedMonthKey}
                        onChange={(e) => {
                          if (e.target.value) setSelectedMonth(e.target.value);
                        }}
                        style={{
                          background: "#181824",
                          border: "1.5px solid rgba(99, 102, 241, 0.45)",
                          color: "#F0F0FF",
                          padding: "7px 32px 7px 12px",
                          borderRadius: 8,
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          outline: "none",
                          cursor: "pointer",
                          appearance: "none",
                          WebkitAppearance: "none",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                        }}
                      >
                        <optgroup
                          label="── Akumulasi Global ──"
                          style={{ background: "#111118", color: "#FCD34D", fontWeight: 800 }}
                        >
                          <option
                            value="all"
                            style={{ background: "#181824", color: "#FCD34D", fontWeight: 700 }}
                          >
                            🌐 Sepanjang Masa (All-Time) · {validLogs.length} Tap
                          </option>
                        </optgroup>

                        {monthsByYear.map(({ year, months }) => (
                          <optgroup
                            key={year}
                            label={`── Tahun ${year} ──`}
                            style={{ background: "#111118", color: "#A5B4FC", fontWeight: 800 }}
                          >
                            {months.map(m => {
                              const isCurrent = m.monthKey === thisMonthKey;
                              return (
                                <option
                                  key={m.monthKey}
                                  value={m.monthKey}
                                  style={{ background: "#181824", color: isCurrent ? "#FCD34D" : "#F0F0FF", fontWeight: 600 }}
                                >
                                  {isCurrent ? `🌟 ${m.label} (Bulan Ini)` : m.label} · {m.total} Tap
                                </option>
                              );
                            })}
                          </optgroup>
                        ))}
                      </select>
                      <span
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          fontSize: "0.65rem",
                          color: "#A5B4FC",
                        }}
                      >
                        ▼
                      </span>
                    </div>

                    {/* Tombol Cepat: Kembali ke Bulan Ini (muncul saat sedang memilih bulan arsip masa lalu atau all-time) */}
                    {selectedMonthKey !== thisMonthKey && (
                      <button
                        type="button"
                        onClick={() => setSelectedMonth(thisMonthKey)}
                        className="btn btn-ghost"
                        style={{
                          padding: "5px 12px",
                          fontSize: "0.78rem",
                          borderRadius: 8,
                          border: "1px dashed rgba(245, 158, 11, 0.45)",
                          color: "#FCD34D",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                        title="Kembali ke Bulan Berjalan"
                      >
                        <span>🌟</span>
                        <span>Kembali ke Bulan Ini</span>
                      </button>
                    )}
                  </div>

                  {/* Status / Badge Periode Terpilih */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {selectedMonthKey === "all" ? (
                      <span
                        className="badge"
                        style={{
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#34D399",
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        🌐 Rekap All-Time
                      </span>
                    ) : isCurrentSelected ? (
                      <span
                        className="badge"
                        style={{
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#FCD34D",
                          border: "1px solid rgba(245, 158, 11, 0.35)",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        ⚡ Bulan Berjalan
                      </span>
                    ) : (
                      <span
                        className="badge"
                        style={{
                          background: "rgba(99, 102, 241, 0.15)",
                          color: "#A5B4FC",
                          border: "1px solid rgba(99, 102, 241, 0.35)",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        📁 Arsip Historis
                      </span>
                    )}
                  </div>
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
                            {selectedMonthKey === "all" ? (
                              <span style={{
                                fontSize: "0.65rem", fontWeight: 800,
                                background: "rgba(16,185,129,0.18)", color: "#34D399",
                                border: "1px solid rgba(16,185,129,0.4)",
                                padding: "2px 8px", borderRadius: 999, textTransform: "uppercase",
                              }}>
                                All-Time
                              </span>
                            ) : isThisMonth ? (
                              <span style={{
                                fontSize: "0.65rem", fontWeight: 800,
                                background: "rgba(245,158,11,0.18)", color: "#FCD34D",
                                border: "1px solid rgba(245,158,11,0.4)",
                                padding: "2px 8px", borderRadius: 999, textTransform: "uppercase",
                              }}>
                                Bulan Berjalan
                              </span>
                            ) : (
                              <span style={{
                                fontSize: "0.65rem", fontWeight: 800,
                                background: "rgba(99,102,241,0.18)", color: "#A5B4FC",
                                border: "1px solid rgba(99,102,241,0.4)",
                                padding: "2px 8px", borderRadius: 999, textTransform: "uppercase",
                              }}>
                                Arsip Historis
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

                                    {selectedMonthKey === "all" ? (
                                      <span style={{ fontSize: "0.65rem", color: "#34D399", background: "rgba(16,185,129,0.12)", padding: "2px 6px", borderRadius: 999, fontWeight: 700 }}>
                                        all-time
                                      </span>
                                    ) : isThisMonth ? (
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
                                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#FCD34D", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                    <span>📋 Riwayat {storeTaps.length} Tap — {s.storeName} ({selectedMonthKey === "all" ? "Sepanjang Masa" : mg.label})</span>
                                    {selectedMonthKey !== "all" && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedMonth("all")}
                                        style={{
                                          background: "rgba(255,255,255,0.06)",
                                          border: "1px solid rgba(255,255,255,0.12)",
                                          color: "#CBD5E1",
                                          borderRadius: 6,
                                          padding: "2px 8px",
                                          fontSize: "0.68rem",
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                        }}
                                        title="Buka rekap seluruh riwayat tap toko ini sejak hari pertama"
                                      >
                                        <span>🌐</span> Lihat Histori All-Time
                                      </button>
                                    )}
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
                {/* ── Global Outlet Filter Bar ── */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 18,
                  padding: "10px 14px",
                  background: selectedStoreFilter !== "all" ? "rgba(99, 102, 241, 0.12)" : "rgba(255, 255, 255, 0.03)",
                  border: selectedStoreFilter !== "all" ? "1px solid rgba(99, 102, 241, 0.35)" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 10,
                  flexWrap: "wrap",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1 }}>
                    <label htmlFor="store-global-filter" style={{ fontSize: "0.82rem", fontWeight: 700, color: selectedStoreFilter !== "all" ? "#A5B4FC" : "#E2E8F0", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span>🏪</span> Filter Outlet:
                    </label>
                    <select
                      id="store-global-filter"
                      value={selectedStoreFilter}
                      onChange={(e) => setSelectedStoreFilter(e.target.value)}
                      style={{
                        background: "#161622",
                        color: "#F8FAFC",
                        border: selectedStoreFilter !== "all" ? "1px solid #6366F1" : "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: 8,
                        padding: "6px 12px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        outline: "none",
                        cursor: "pointer",
                        minWidth: 200,
                        maxWidth: "100%",
                      }}
                    >
                      <option value="all">Semua Outlet ({availableStores.length} Cafe)</option>
                      {availableStores.map(store => (
                        <option key={store} value={store}>{store}</option>
                      ))}
                    </select>
                    {selectedStoreFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setSelectedStoreFilter("all")}
                        style={{
                          background: "rgba(239, 68, 68, 0.15)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          color: "#FCA5A5",
                          borderRadius: 6,
                          padding: "5px 10px",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span>✕</span> Reset ke Semua Outlet
                      </button>
                    )}
                  </div>
                  {selectedStoreFilter !== "all" && (
                    <div style={{ fontSize: "0.74rem", color: "#A5B4FC", fontWeight: 600 }}>
                      Menampilkan analitik khusus: <strong style={{ color: "#FFF" }}>{selectedStoreFilter}</strong> ({storeFilteredLogs.length} tap)
                    </div>
                  )}
                </div>

                {/* ── Tampilan 1: Mode Drill-Down Tanggal Spesifik (Level 3) ── */}
                {selectedDrilldownDate ? (
                  <div>
                    {/* 1. Breadcrumb Interaktif Navigasi Mundur-Maju (Level 3) */}
                    <InteractiveBreadcrumb
                      items={selectedWeekObj ? [
                        { label: "Semua Minggu", icon: "🏠", onClick: () => { setSelectedDrilldownDate(null); setSelectedWeekKey(null); } },
                        { label: selectedWeekObj.subLabel, icon: "📅", onClick: () => setSelectedDrilldownDate(null) },
                        { label: formatDateShortIndo(selectedDrilldownDate), icon: "☀️", active: true },
                      ] : [
                        { label: `Tren Harian (${trendRange === "custom" ? "Kustom" : `${trendRange} Hari`})`, icon: "📅", onClick: () => setSelectedDrilldownDate(null) },
                        { label: formatDateShortIndo(selectedDrilldownDate), icon: "☀️", active: true },
                      ]}
                      onBack={() => setSelectedDrilldownDate(null)}
                      backLabel={selectedWeekObj ? `Kembali ke ${selectedWeekObj.subLabel}` : "Kembali ke Tren Harian"}
                    />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F0F0FF" }}>
                          🔍 Distribusi Jam Masuk: {formatDateIndo(selectedDrilldownDate)}
                        </h3>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                          Rincian 24 jam kedatangan pelanggan dan outlet cafe yang ditap pada {formatDateIndo(selectedDrilldownDate)}.
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

                    {/* 2. Breakdown Cafe pada Tanggal Ini dengan Stacked Multi-Color Rainbow Bar */}
                    <CafeBreakdownCard
                      title={`Outlet yang Ditap pada ${formatDateIndo(selectedDrilldownDate)}`}
                      subtitle="Daftar toko/cafe yang menerima tap pelanggan pada tanggal ini."
                      logs={drilldownLogs}
                      cardUrlMap={cardUrlMap}
                    />
                  </div>
                ) : (
                  <div>
                    {/* ── Header Card dengan Mode Switcher Terpadu (Jam, Harian, Mingguan) ── */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F0F0FF" }}>
                          {trenView === "jam"
                            ? `⏱️ Distribusi Jam Masuk ${hourPeriod === "today" ? "(Hari Ini)" : hourPeriod === "last7" ? "(7 Hari Terakhir)" : hourPeriod === "last30" ? "(1 Bulan Terakhir)" : "(Semua Riwayat)"}`
                            : trenView === "harian"
                            ? `📅 Tren Aktivitas Harian (${trendRange} Hari Terakhir)`
                            : selectedWeekObj
                            ? `📅 Rincian 7 Hari: ${selectedWeekObj.subLabel} (${selectedWeekObj.label})`
                            : "📊 Tren Aktivitas Mingguan (8 Minggu Terakhir)"}
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
                            : trenView === "harian"
                            ? "Jumlah tap per hari pada semua kartu aktif. Klik pada salah satu batang tanggal untuk membedah jam sibuk & cafe teraktif."
                            : selectedWeekObj
                            ? `Performa 7 hari (Senin s/d Minggu) pada ${selectedWeekObj.subLabel}. Klik salah satu batang hari untuk melihat sebaran jam & cafe.`
                            : "Akumulasi tap per minggu kalender (Senin - Minggu). Klik salah satu batang minggu untuk membedah 7 hari di dalamnya."}
                        </p>
                      </div>

                      {/* Mode Switcher: 3 Tombol (Jam Masuk vs Tren Harian vs Tren Mingguan) */}
                      <div className="chart-mode-switcher">
                        <button
                          type="button"
                          onClick={() => { setTrenView("jam"); setSelectedDrilldownDate(null); setSelectedWeekKey(null); }}
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            borderRadius: 8,
                            background: trenView === "jam" ? "#6366F1" : "transparent",
                            color: trenView === "jam" ? "#FFF" : "var(--text-muted)",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            transition: "all 0.15s ease",
                            boxShadow: trenView === "jam" ? "0 2px 8px rgba(99,102,241,0.35)" : "none",
                          }}
                        >
                          <span>⏱️</span>
                          <span>Jam Sibuk</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setTrenView("harian"); setSelectedDrilldownDate(null); setSelectedWeekKey(null); }}
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            borderRadius: 8,
                            background: trenView === "harian" ? "#F59E0B" : "transparent",
                            color: trenView === "harian" ? "#000" : "var(--text-muted)",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            transition: "all 0.15s ease",
                            boxShadow: trenView === "harian" ? "0 2px 8px rgba(245,158,11,0.35)" : "none",
                          }}
                        >
                          <span>📅</span>
                          <span>Harian</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setTrenView("mingguan"); setSelectedDrilldownDate(null); }}
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            borderRadius: 8,
                            background: trenView === "mingguan" ? "#8B5CF6" : "transparent",
                            color: trenView === "mingguan" ? "#FFF" : "var(--text-muted)",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            transition: "all 0.15s ease",
                            boxShadow: trenView === "mingguan" ? "0 2px 8px rgba(139,92,246,0.35)" : "none",
                          }}
                        >
                          <span>📊</span>
                          <span>Mingguan</span>
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
                                🏆 Jam Puncak: <strong>{peakHour.label}</strong> ({peakHour.count} tap)
                              </span>
                            ) : (
                              <span className="badge" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                                Belum ada aktivitas
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Filter Periode & Ringkasan Jam Puncak per Periode */}
                        <div className="hour-period-grid">
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
                                <div style={{ fontSize: "0.72rem", marginTop: 5, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                                  <span style={{ color: isAct ? "#CBD5E1" : "var(--text-muted)" }}>🏆 Puncak:</span>
                                  <strong style={{ color: "#34D399" }}>
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

                        {/* Breakdown Cafe Periode Jam Ini */}
                        <CafeBreakdownCard
                          title={`Peringkat Cafe Teraktif (${hourPeriod === "today" ? "Hari Ini" : hourPeriod === "last7" ? "7 Hari Terakhir" : hourPeriod === "last30" ? "1 Bulan Terakhir" : "Semua Riwayat"})`}
                          subtitle="Outlet yang menerima tap pelanggan pada rentang waktu terpilih."
                          logs={hourFilteredLogs}
                          cardUrlMap={cardUrlMap}
                        />
                      </div>
                    )}

                    {/* ── View 2: Tren Harian dengan Fitur Drill-Down & Kustom Rentang Tanggal ── */}
                    {trenView === "harian" && (() => {
                      const activeDailyData = trendRange === 7 ? trendData7 : trendRange === 30 ? trendData30 : customTrendData;
                      const rangeTitle = trendRange === "custom"
                        ? `${formatDateShortIndo(customStartDate)} – ${formatDateShortIndo(customEndDate)}`
                        : `${trendRange} Hari Terakhir`;

                      return (
                        <div>
                          {/* 1. Breadcrumb Interaktif Navigasi */}
                          <InteractiveBreadcrumb
                            items={[
                              { label: `Tren Aktivitas Harian (${rangeTitle})`, icon: "📅", active: true },
                            ]}
                          />

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {/* Range Switcher (7 Hari vs 30 Hari vs Kustom) */}
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
                                <button
                                  type="button"
                                  onClick={() => setTrendRange("custom")}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: "0.74rem",
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    background: trendRange === "custom" ? "#F59E0B" : "transparent",
                                    color: trendRange === "custom" ? "#000" : "#94A3B8",
                                    border: "none",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  🗓️ Kustom
                                </button>
                              </div>

                              {trendRange === "custom" && (
                                <div style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "4px 8px",
                                  background: "rgba(245, 158, 11, 0.08)",
                                  border: "1px solid rgba(245, 158, 11, 0.25)",
                                  borderRadius: 8,
                                  fontSize: "0.75rem",
                                }}>
                                  <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    style={{
                                      background: "#161622",
                                      color: "#F8FAFC",
                                      border: "1px solid rgba(255,255,255,0.15)",
                                      borderRadius: 6,
                                      padding: "3px 7px",
                                      fontSize: "0.74rem",
                                      outline: "none",
                                      cursor: "pointer",
                                    }}
                                  />
                                  <span style={{ color: "var(--text-muted)", fontSize: "0.74rem" }}>s/d</span>
                                  <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    style={{
                                      background: "#161622",
                                      color: "#F8FAFC",
                                      border: "1px solid rgba(255,255,255,0.15)",
                                      borderRadius: 6,
                                      padding: "3px 7px",
                                      fontSize: "0.74rem",
                                      outline: "none",
                                      cursor: "pointer",
                                    }}
                                  />
                                </div>
                              )}

                              <span className="badge badge-orange">
                                Total: {activeDailyData.reduce((s, d) => s + d.value, 0)} tap
                              </span>

                              {(() => {
                                const maxDay = activeDailyData.reduce((prev, cur) => (cur.value > prev.value ? cur : prev), activeDailyData[0]);
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
                              <span><strong>Klik batang tanggal</strong> untuk membedah jam sibuk &amp; cafe</span>
                            </div>
                          </div>

                          <BarChart
                            data={activeDailyData}
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

                          {activeDailyData.length === 0 && (
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
                              ℹ️ Rentang tanggal tidak valid atau belum ada aktivitas tap pada rentang tanggal ini.
                            </div>
                          )}

                          {/* Breakdown Cafe Periode Harian Ini */}
                          <CafeBreakdownCard
                            title={`Peringkat Cafe Teraktif (${rangeTitle})`}
                            subtitle={`Akumulasi kontribusi tap per cafe selama rentang waktu ini.`}
                            logs={trendRangeLogs}
                            cardUrlMap={cardUrlMap}
                          />
                        </div>
                      );
                    })()}

                    {/* ── View 3: Tren Mingguan & Drilldown 7 Hari (Level 1 & Level 2) ── */}
                    {trenView === "mingguan" && (
                      <div>
                        {selectedWeekObj ? (
                          /* Level 2: Detail 7 Hari di Minggu Terpilih */
                          <div>
                            {/* 1. Breadcrumb Interaktif Navigasi (Level 2) */}
                            <InteractiveBreadcrumb
                              items={[
                                { label: "Semua Minggu (8 Minggu)", icon: "🏠", onClick: () => setSelectedWeekKey(null) },
                                { label: `${selectedWeekObj.subLabel} (${selectedWeekObj.label})`, icon: "📅", active: true },
                              ]}
                              onBack={() => setSelectedWeekKey(null)}
                              backLabel="Kembali ke Semua Minggu"
                            />

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span className="badge badge-purple" style={{ background: "rgba(139,92,246,0.15)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.3)" }}>
                                  Total Minggu Ini: {selectedWeekObj.count} tap
                                </span>
                              </div>

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
                                <span><strong>Klik salah satu hari</strong> untuk membedah jam 24-jam</span>
                              </div>
                            </div>

                            <BarChart
                              data={weekDailyData}
                              color="#38BDF8"
                              yAxisUnit="Tap"
                              xAxisTitle="Hari"
                              showValue={true}
                              onBarClick={(_idx, item: any) => {
                                if (item.dateKey) {
                                  setSelectedDrilldownDate(item.dateKey);
                                }
                              }}
                            />

                            {/* Breakdown Cafe Minggu Ini */}
                            <CafeBreakdownCard
                              title={`Cafe Teraktif pada ${selectedWeekObj.subLabel} (${selectedWeekObj.label})`}
                              subtitle="Outlet yang menyumbang tap terbanyak dalam minggu terpilih ini."
                              logs={selectedWeekObj.logs}
                              cardUrlMap={cardUrlMap}
                            />
                          </div>
                        ) : (
                          /* Level 1: Grafik Batang 8 Minggu Kalender */
                          <div>
                            {/* 1. Breadcrumb Interaktif Navigasi (Level 1) */}
                            <InteractiveBreadcrumb
                              items={[
                                { label: "Tren Mingguan (8 Minggu Terakhir)", icon: "🏠", active: true },
                              ]}
                            />

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <span className="badge badge-purple" style={{ background: "rgba(139,92,246,0.15)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.3)" }}>
                                  Total 8 Minggu: {weeklyTrendData.reduce((s, w) => s + w.count, 0)} tap
                                </span>
                                {(() => {
                                  const maxWeek = weeklyTrendData.reduce((prev, cur) => (cur.count > prev.count ? cur : prev), weeklyTrendData[0]);
                                  if (maxWeek && maxWeek.count > 0) {
                                    return (
                                      <span className="badge badge-green" style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)" }}>
                                        🏆 Minggu Teramai: {maxWeek.subLabel} ({maxWeek.count} tap)
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>

                              <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 10px",
                                background: "rgba(139, 92, 246, 0.08)",
                                border: "1px dashed rgba(139, 92, 246, 0.3)",
                                borderRadius: 8,
                                fontSize: "0.72rem",
                                color: "#C4B5FD",
                              }}>
                                <span>👆</span>
                                <span><strong>Klik batang minggu</strong> untuk membedah 7 hari &amp; cafe</span>
                              </div>
                            </div>

                            <BarChart
                              data={weeklyChartData}
                              color="#8B5CF6"
                              yAxisUnit="Tap"
                              xAxisTitle="Minggu"
                              showValue={true}
                              onBarClick={(_idx, item: any) => {
                                if (item.weekKey) {
                                  setSelectedWeekKey(item.weekKey);
                                }
                              }}
                            />

                            {/* Breakdown Cafe 8 Minggu Ini */}
                            <CafeBreakdownCard
                              title="Peringkat Cafe Teraktif (8 Minggu Terakhir)"
                              subtitle="Akumulasi kontribusi tap per cafe selama 8 minggu."
                              logs={eightWeeksLogs}
                              cardUrlMap={cardUrlMap}
                            />
                          </div>
                        )}
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
                          className="card toko-tidur-card"
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
                            className="toko-tidur-actions"
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

      {/* Tombol Melayang: Kembali ke Atas (Floating Circular Scroll-to-Top FAB) */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="scroll-to-top-btn"
          aria-label="Kembali ke atas"
          title="Kembali ke atas"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      )}
    </>
  );
}

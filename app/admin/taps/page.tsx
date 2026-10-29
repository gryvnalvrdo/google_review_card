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
  // Grafik selalu fit 100% lebar layar mobile tanpa perlu digeser (zero horizontal scrolling)
  // Di desktop, W diperluas hingga 1060px dan barW hingga 44px agar proporsional dan elegan
  const W = isMobile ? (isFewBars ? 400 : 480) : 1060;
  const H = isMobile ? 210 : 250;
  const PAD_L = isMobile ? 24 : 46;
  const PAD_R = isMobile ? 12 : 24;
  const PAD_T = isMobile ? 24 : 30;
  const PAD_B = isMobile ? 38 : 38;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const y0 = PAD_T + chartH;

  const slotW = data.length > 0 ? chartW / data.length : chartW;
  const barW = Math.max(Math.min(Math.floor(slotW * 0.65), isMobile ? (isFewBars ? 24 : 13) : (isFewBars ? 46 : 36)), 8);

  const valFontSize = isMobile ? (isFewBars ? 12.5 : 10.5) : (isFewBars ? 13.5 : 11.5);
  const xLabelFontSize = isMobile ? (isFewBars ? 10.5 : 9.5) : 11;
  const xSubLabelFontSize = isMobile ? (isFewBars ? 8.5 : 8) : 9.5;

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: "100%",
          maxWidth: "100%",
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
          <filter id="peakGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.6" />
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
          const isPeak = maxVal > 0 && d.value === maxVal && !isHighlight;
          const isSelected = selectedIndex === i;
          const isClickable = Boolean(onBarClick);
          const barFill = isSelected
            ? "#38BDF8"
            : isHighlight
            ? "#10B981"
            : isPeak
            ? "#8B5CF6"
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
                filter={isSelected ? undefined : isHighlight && d.value > 0 ? "url(#barGlow)" : isPeak && d.value > 0 ? "url(#peakGlow)" : undefined}
                style={{ transition: "all 0.2s ease" }}
              />

              {/* Value on top of bar (Large, Bold & Crisp on Mobile) */}
              {showValue && d.value > 0 && (
                <text
                  x={cx}
                  y={by - 6}
                  fill={isSelected ? "#38BDF8" : isHighlight ? "#34D399" : isPeak ? "#C084FC" : "#FFFFFF"}
                  fontSize={valFontSize}
                  fontWeight={isPeak || isHighlight ? 900 : 800}
                  textAnchor="middle"
                  style={{ textShadow: isPeak ? "0 0 10px rgba(139,92,246,0.8)" : "0 1px 3px rgba(0,0,0,0.8)" }}
                >
                  {isPeak && isFewBars ? `👑 ${d.value}` : d.value}
                </text>
              )}

              {/* Sumbu X: Tick Mark on baseline for labeled slots */}
              {d.label && (
                <line
                  x1={cx}
                  y1={y0}
                  x2={cx}
                  y2={y0 + 4}
                  stroke={isHighlight ? "#10B981" : isPeak ? "#8B5CF6" : "#64748B"}
                  strokeWidth={1.5}
                />
              )}

              {/* Sumbu X: Primary Label & Sub-label */}
              {isMobile && d.label && d.label.startsWith("Minggu ") ? (
                <>
                  <text
                    x={cx}
                    y={y0 + 13}
                    fill={isHighlight ? "#34D399" : "#E2E8F0"}
                    fontSize={10.5}
                    fontWeight={800}
                    textAnchor="middle"
                  >
                    {`M${d.label.replace("Minggu ", "").trim()}`}
                  </text>
                  {d.subLabel && (
                    <text
                      x={cx}
                      y={y0 + 25}
                      fill={isHighlight ? "#6EE7B7" : "#64748B"}
                      fontSize={8}
                      fontWeight={isHighlight || isPeak ? 700 : 500}
                      textAnchor="middle"
                    >
                      {d.mobileSubLabel || d.subLabel.split(" - ")[0] || d.subLabel}
                    </text>
                  )}
                </>
              ) : (
                <>
                  {d.label && (
                    <text
                      x={cx}
                      y={y0 + (d.subLabel ? 14 : 17)}
                      fill={isHighlight ? "#34D399" : isPeak ? "#C084FC" : "#94A3B8"}
                      fontSize={xLabelFontSize}
                      fontWeight={isHighlight || isPeak ? 800 : 600}
                      textAnchor="middle"
                    >
                      {d.label}
                    </text>
                  )}
                  {d.subLabel && (
                    <text
                      x={cx}
                      y={y0 + 26}
                      fill={isHighlight ? "#A7F3D0" : isPeak ? "#DDD6FE" : "#64748B"}
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
          <span>{showAll ? "▴ Tampilkan Lebih Sedikit" : `▾ Tampilkan Semua (${countsByStore.length} Toko)`}</span>
        </button>
      )}
    </div>
  );
}

// ── HourlyCafeBreakdownCard — Rincian kontribusi outlet pada jam tertentu ───
function HourlyCafeBreakdownCard({
  hour,
  peakHour,
  logs,
  allHourCounts,
  onSelectHour,
  cardUrlMap,
  activeCardMap,
  periodName,
}: {
  hour: number | null;
  peakHour: { hour: number; count: number; label: string } | null;
  logs: TapLogEntry[];
  allHourCounts: number[];
  onSelectHour: (h: number) => void;
  cardUrlMap: Map<string, string>;
  activeCardMap?: Map<string, string>;
  periodName: string;
}) {
  const [showAll, setShowAll] = useState(false);

  if (hour === null || hour === undefined) {
    return null;
  }

  const startHourStr = String(hour).padStart(2, "0");
  const nextHourStr = String((hour + 1) % 24).padStart(2, "0");
  const hourLabel = `${startHourStr}.00 – ${nextHourStr}.00`;
  const isPeak = peakHour && peakHour.hour === hour;

  // Breakdown cafe khusus jam ini
  const countsByStore = useMemo(() => {
    const map = new Map<string, { count: number; code: string; storeName: string }>();
    for (const log of logs) {
      const resolvedName = (log.storeName && log.storeName.trim())
        || (activeCardMap && activeCardMap.get(log.code))
        || (log.code ? `Toko (${log.code})` : "Toko Tanpa Nama");

      const key = log.code || resolvedName;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { count: 1, code: log.code, storeName: resolvedName });
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [logs, activeCardMap]);

  const totalHourTaps = logs.length;
  const max = countsByStore.length > 0 ? countsByStore[0].count : 1;
  const visibleStores = showAll ? countsByStore : countsByStore.slice(0, 5);
  const medals = ["🥇", "🥈", "🥉"];

  // Hanya ambil jam-jam yang kartunya memiliki riwayat tap (jam tengah malam/dini hari saat toko tutup yang 0 tap tidak ditampilkan)
  const activeHours = useMemo(() => {
    const list = Array.from({ length: 24 })
      .map((_, h) => h)
      .filter((h) => (allHourCounts[h] || 0) > 0);

    // Jika pengguna memilih jam secara manual (misal klik batang 0 tap di grafik saat ada jam aktif lain), sertakan agar select tidak hilang
    if (list.length > 0 && hour !== null && hour !== undefined && !list.includes(hour)) {
      list.push(hour);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [allHourCounts, hour]);

  return (
    <div className="cafe-breakdown-card" style={{ marginTop: 22 }}>
      {/* Header dengan Dropdown Pilihan Jam */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h4 style={{ fontSize: "0.98rem", fontWeight: 700, color: "#F0F0FF", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
              <span>🏪</span> Kontribusi Outlet pada Jam {hourLabel}
            </h4>
            {isPeak && (
              <span style={{ fontSize: "0.7rem", fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "rgba(16, 185, 129, 0.15)", color: "#34D399", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                🏆 Jam Puncak
              </span>
            )}
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
            Rincian outlet yang menerima tap pelanggan pada pukul {hourLabel} ({periodName}).
          </p>
        </div>

        {/* Dropdown Pilihan Jam */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 320, flex: "1 1 240px" }}>
          <label htmlFor="hourly-breakdown-select" style={{ fontSize: "0.76rem", color: "#94A3B8", fontWeight: 600, whiteSpace: "nowrap" }}>
            Pilih Jam:
          </label>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <select
              id="hourly-breakdown-select"
              value={hour}
              onChange={(e) => onSelectHour(Number(e.target.value))}
              style={{
                width: "100%",
                background: "#181824",
                border: "1px solid rgba(99, 102, 241, 0.35)",
                color: "#EDE9FE",
                padding: "6px 28px 6px 12px",
                borderRadius: 8,
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
                outline: "none",
              }}
            >
              {activeHours.length === 0 ? (
                <option value={hour} style={{ background: "#111118", color: "#94A3B8" }}>
                  Belum ada jam dengan aktivitas tap
                </option>
              ) : (
                activeHours.map((h) => {
                  const sH = String(h).padStart(2, "0");
                  const eH = String((h + 1) % 24).padStart(2, "0");
                  const count = allHourCounts[h] || 0;
                  const isThisPeak = peakHour && peakHour.hour === h;
                  return (
                    <option key={h} value={h} style={{ background: "#111118", color: "#F8FAFC" }}>
                      {sH}.00 – {eH}.00 {isThisPeak ? "🏆 (Puncak) " : ""}— {count} tap
                    </option>
                  );
                })
              )}
            </select>
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.6rem", color: "#A5B4FC", pointerEvents: "none" }}>
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* Konten Rincian Outlet */}
      {countsByStore.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: "1.8rem", marginBottom: 6 }}>☕</div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#CBD5E1", fontWeight: 600 }}>
            Tidak ada aktivitas tap pada pukul {hourLabel}
          </p>
          <p style={{ margin: "4px 0 12px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Belum ada pelanggan yang men-tap kartu toko di jam ini pada {periodName}.
          </p>
          {peakHour && peakHour.hour !== hour && (
            <button
              type="button"
              onClick={() => onSelectHour(peakHour.hour)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#34D399",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Lihat Jam Puncak ({peakHour.label} · {peakHour.count} tap) →
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visibleStores.map((store, i) => {
            const percentOfHour = totalHourTaps > 0 ? Math.round((store.count / totalHourTaps) * 100) : 0;
            const relativePercent = Math.round((store.count / max) * 100);

            return (
              <div
                key={store.code || store.storeName}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.025)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: "1 1 180px" }}>
                    <span style={{ fontSize: "1rem", width: 24, textAlign: "center", flexShrink: 0, lineHeight: 1 }}>
                      {medals[i] || <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#64748B" }}>#{i + 1}</span>}
                    </span>
                    <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span
                        title={store.storeName}
                        style={{
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          color: "#F8FAFC",
                          wordBreak: "break-word",
                          lineHeight: 1.3,
                        }}
                      >
                        {store.storeName}
                      </span>
                      {store.code && (
                        <span style={{
                          fontSize: "0.66rem",
                          fontWeight: 600,
                          color: "#94A3B8",
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.09)",
                          padding: "1px 5px",
                          borderRadius: 4,
                          fontFamily: "monospace",
                          flexShrink: 0,
                        }}>
                          {store.code}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#EDE9FE" }}>
                        {store.count} <span style={{ fontSize: "0.7rem", color: "#94A3B8", fontWeight: 500 }}>tap</span>
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "#818CF8", fontWeight: 600, marginLeft: 4 }}>
                        ({percentOfHour}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar porsi tap di jam ini */}
                <div style={{ background: "rgba(255,255,255,0.06)", height: 4, borderRadius: 999, overflow: "hidden" }}>
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

          {countsByStore.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              style={{
                marginTop: 6,
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
              }}
            >
              <span>{showAll ? "▴ Tampilkan Lebih Sedikit" : `▾ Tampilkan Semua (${countsByStore.length} Toko di Jam Ini)`}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cafe Monogram Initials Helper ────────────────────────────────────
function getStoreInitials(name?: string): string {
  if (!name || !name.trim()) return "☕";
  const cleaned = name.trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "☕";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}






// ── Premium Custom Month Dropdown ─────────────────────────────────────
function CustomMonthDropdown({
  value,
  onChange,
  options,
  placeholder = "Pilih Bulan...",
}: {
  value: string;
  onChange: (val: string) => void;
  options: { key: string; label: string; isCurrent: boolean; total?: number }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selected = options.find((o) => o.key === value);

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 140 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          background: open
            ? "rgba(139, 92, 246, 0.22)"
            : selected
            ? "rgba(139, 92, 246, 0.14)"
            : "#161622",
          border: open
            ? "1.5px solid #A78BFA"
            : selected
            ? "1.5px solid rgba(139, 92, 246, 0.55)"
            : "1px solid rgba(139, 92, 246, 0.35)",
          color: selected ? "#EDE9FE" : "#94A3B8",
          padding: "6px 10px",
          borderRadius: 8,
          fontSize: "0.74rem",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          outline: "none",
          transition: "all 0.18s ease",
          boxShadow: open
            ? "0 0 16px rgba(139, 92, 246, 0.35)"
            : selected
            ? "0 0 10px rgba(139, 92, 246, 0.18)"
            : "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? (
            <>
              <span style={{ fontSize: "0.82rem", flexShrink: 0 }}>{selected.isCurrent ? "🌟" : "📅"}</span>
              <span style={{ fontWeight: 700, color: selected.isCurrent ? "#FDE047" : "#F8FAFC" }}>
                {selected.label}
              </span>
              {selected.isCurrent && (
                <span
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 4,
                    background: "rgba(245, 158, 11, 0.25)",
                    color: "#FDE047",
                    border: "1px solid rgba(245, 158, 11, 0.45)",
                    flexShrink: 0,
                  }}
                >
                  Bulan Ini
                </span>
              )}
            </>
          ) : (
            <>
              <span style={{ fontSize: "0.82rem", opacity: 0.7 }}>📅</span>
              <span style={{ color: "#94A3B8" }}>{placeholder}</span>
            </>
          )}
        </span>
        <span
          style={{
            fontSize: "0.58rem",
            color: "#C4B5FD",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
            marginLeft: 4,
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1000,
            minWidth: "100%",
            width: "max-content",
            maxWidth: "min(320px, 92vw)",
            background: "linear-gradient(180deg, #181826 0%, #12121C 100%)",
            border: "1.5px solid rgba(139, 92, 246, 0.45)",
            borderRadius: 10,
            padding: "6px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.8), 0 0 16px rgba(139, 92, 246, 0.25)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {options.map((opt) => {
              const isSelected = opt.key === value;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onChange(opt.key);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 7,
                    fontSize: "0.75rem",
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? "#FFFFFF" : "#CBD5E1",
                    background: isSelected ? "rgba(139, 92, 246, 0.28)" : "transparent",
                    border: isSelected ? "1px solid rgba(139, 92, 246, 0.5)" : "1px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.12s ease",
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                      e.currentTarget.style.color = "#F8FAFC";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#CBD5E1";
                    }
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
                    <span style={{ fontSize: "0.82rem", flexShrink: 0 }}>{opt.isCurrent ? "🌟" : "📅"}</span>
                    <span style={{ fontWeight: opt.isCurrent || isSelected ? 700 : 500, color: opt.isCurrent ? "#FDE047" : isSelected ? "#FFFFFF" : "#E2E8F0" }}>
                      {opt.label}
                    </span>
                    {opt.isCurrent && (
                      <span
                        style={{
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "rgba(245, 158, 11, 0.22)",
                          color: "#FDE047",
                          border: "1px solid rgba(245, 158, 11, 0.45)",
                          flexShrink: 0,
                        }}
                      >
                        Bulan Ini
                      </span>
                    )}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {opt.total !== undefined && opt.total > 0 && (
                      <span style={{ fontSize: "0.65rem", color: "#94A3B8", fontWeight: 600 }}>
                        {opt.total} tap
                      </span>
                    )}
                    {isSelected && (
                      <span style={{ color: "#C084FC", fontSize: "0.8rem", fontWeight: 900 }}>✓</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab Skeleton Loading Shimmer ──────────────────────────────────────
function TapsTabSkeleton({ text = "Memuat data aktivitas..." }: { text?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px 8px" }}>
        <div className="spinner" style={{ width: 15, height: 15 }} />
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{text}</span>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            height: 60,
            borderRadius: 10,
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            animation: "pulse 1.8s infinite ease-in-out",
          }}
        />
      ))}
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
  const [copySuccessToast, setCopySuccessToast] = useState(false);
  const [activeTab, setActiveTab] = useState<"tren" | "harian" | "bulanan" | "tidur">("harian");

  useEffect(() => {
    const handleViewport = () => {
      if (typeof window !== "undefined") {
        if (window.innerWidth <= 768) {
          // Di mobile, tab tren & jam disembunyikan sepenuhnya
          setActiveTab((prev) => (prev === "tren" ? "harian" : prev));
        } else {
          // Buka default tren di desktop hanya jika pengguna belum memilih tab lain
          try {
            if (!sessionStorage.getItem("user_selected_tab")) {
              setActiveTab("tren");
            }
          } catch {
            setActiveTab("tren");
          }
        }
      }
    };
    handleViewport();
    window.addEventListener("resize", handleViewport);
    return () => window.removeEventListener("resize", handleViewport);
  }, []);

  // Baca parameter query URL (?search=...&period=all) saat dibuka dari tautan kartu
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlSearch = params.get("search") || params.get("store") || params.get("q");
      const urlPeriod = params.get("period");

      if (urlSearch) {
        setSearch(urlSearch);
        setActiveTab("harian");
        setDailyMode("all");
        try {
          sessionStorage.setItem("user_selected_tab", "harian");
        } catch {}
      } else if (urlPeriod === "all" || urlPeriod === "today" || urlPeriod === "last7" || urlPeriod === "last30") {
        setDailyMode(urlPeriod as any);
        setCustomDate("");
      }
    }
  }, []);
  const [dailyMode, setDailyMode] = useState<"today" | "last7" | "last30" | "all" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>("");
  const showReviewBtn = true;
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
  const [trenView, setTrenView] = useState<"jam" | "harian" | "mingguan">("jam");
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [weeklyPeriodType, setWeeklyPeriodType] = useState<"8w" | "12w" | "month" | "year">("8w");
  const [weekPageOffset, setWeekPageOffset] = useState<number>(0);
  const [selectedWeeklyMonth, setSelectedWeeklyMonth] = useState<string>("");
  const [selectedWeeklyYear, setSelectedWeeklyYear] = useState<number>(() => new Date().getFullYear());
  const [hourPeriod, setHourPeriod] = useState<"today" | "last7" | "last30" | "all">("today");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAllSidebarStores, setShowAllSidebarStores] = useState(false);
  const [tapDisplayLimit, setTapDisplayLimit] = useState(10);
  const [mobileSubView, setMobileSubView] = useState<"feed" | "outlets">("feed");
  const lastKnownTapRef = useRef<string | null>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [justRefreshed, setJustRefreshed] = useState(false);

  async function fetchData(isBackground = false) {
    if (!isBackground) setLoading(true);
    else setIsUpdating(true);

    const startTime = Date.now();
    try {
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const [tapRes, cardRes] = await Promise.all([
        fetch(`/api/admin/taps?limit=25000&_t=${ts}&_r=${rand}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        }),
        fetch(`/api/admin/codes?_t=${ts}&_r=${rand}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        }),
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

        // Sinkronisasi status sudah dilihat ke dashboard
        try {
          const nowIso = new Date().toISOString();
          localStorage.setItem("admin_taps_last_seen", nowIso);
          localStorage.setItem("admin_dashboard_last_visited", nowIso);
        } catch {}
      }
      if (cardRes.ok) setCards((await cardRes.json()).cards ?? []);
            setLastRefresh(new Date());

      // Beri animasi feedback minimum 500ms agar di mobile terasa responsif & nyata
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise((r) => setTimeout(r, 500 - elapsed));
      }

      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2200);
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }

  useEffect(() => {
    fetchData(false);
  }, []);

  // ── Auto-refresh setiap 60 detik (background, tidak reset tampilan) ──
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 60_000);
    return () => clearInterval(interval);
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
  function parseDateSafe(input: string | Date): Date {
    if (input instanceof Date) return input;
    if (!input || typeof input !== "string") return new Date(NaN);
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(trimmed);
  }
  function formatDateIndo(dateInput: string | Date) {
    const d = parseDateSafe(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  function formatDateShortIndo(dateInput: string | Date) {
    const d = parseDateSafe(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  function timeAgo(iso: string) {
    const target = new Date(iso);
    if (isNaN(target.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - target.getTime();
    const mins = Math.floor(diffMs / 60000);

    // Untuk tap yang baru saja terjadi dalam 1 jam terakhir
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins}m lalu`;

    // Hitung selisih berdasarkan hari kalender (midnight 00:00:00) agar semua tap pada hari yang sama konsisten
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const diffDays = Math.round((nowDateOnly.getTime() - targetDateOnly.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const hrs = Math.floor(mins / 60);
      return `${hrs}j lalu`;
    }
    if (diffDays === 1) {
      return "Kemarin";
    }
    if (diffDays > 1 && diffDays < 7) {
      return `${diffDays} hari lalu`;
    }

    const isPrevYear = target.getFullYear() !== now.getFullYear();
    return target.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      ...(isPrevYear ? { year: "numeric" } : {}),
    });
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

  // ── Global Outlet Filter & Perhitungan Dinamis ────────────────────────
  const availableStores = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => { if (c.storeName) set.add(c.storeName); });
    validLogs.forEach(l => { if (l.storeName) set.add(l.storeName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cards, validLogs]);

  // Filter log aktivitas: disaring langsung oleh input pencarian (nama cafe/resto atau kode kartu)
  const storeFilteredLogs = useMemo(() => {
    let list = validLogs;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l => l.storeName.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
    }
    return list;
  }, [validLogs, search]);

  const isSingleOutletFilter = false;

  // Stats Hero Metrics (Mengikuti pencarian aktif)
  const todayCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return storeFilteredLogs.filter(l => new Date(l.tappedAt).toDateString() === todayStr).length;
  }, [storeFilteredLogs]);

  const thisWeekCount = useMemo(() => {
    const now = new Date();
    const cutoff7 = new Date(now);
    cutoff7.setDate(now.getDate() - 6);
    cutoff7.setHours(0, 0, 0, 0);
    return storeFilteredLogs.filter(l => new Date(l.tappedAt) >= cutoff7).length;
  }, [storeFilteredLogs]);

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    const cutoff30 = new Date(now);
    cutoff30.setDate(now.getDate() - 29);
    cutoff30.setHours(0, 0, 0, 0);
    return storeFilteredLogs.filter(l => new Date(l.tappedAt) >= cutoff30).length;
  }, [storeFilteredLogs]);

  const totalFilteredCount = storeFilteredLogs.length;

  // ── Harian / Riwayat Tap: split by period ────────────────────────────
  const filtered = storeFilteredLogs;

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
    cutoff7.setDate(now.getDate() - 6);
    cutoff7.setHours(0, 0, 0, 0);

    const cutoff30 = new Date(now);
    cutoff30.setDate(now.getDate() - 29);
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
        title: "Riwayat Tap Spesifik",
        subtitle: formatDateIndo(customDate),
        color: "#6366F1",
        entries: customDateEntries,
        emptyMsg: `Tidak ada aktivitas tap kartu pada tanggal ${formatDateIndo(customDate)}.`,
      };
    }
    if (dailyMode === "today") {
      return {
        title: "Tap Masuk Hari Ini",
        subtitle: formatDateIndo(new Date()),
        color: "#10B981",
        entries: hariianPeriods.today,
        emptyMsg: `Pelanggan belum men-tap kartu toko hari ini (${formatDateIndo(new Date())}). Tap baru akan otomatis terdeteksi via live auto-refresh.`,
      };
    }
    if (dailyMode === "last7") {
      return {
        title: "Riwayat Tap 7 Hari Terakhir",
        subtitle: "Akumulasi aktivitas 7 hari ke belakang",
        color: "#6366F1",
        entries: hariianPeriods.last7,
        emptyMsg: "Belum ada aktivitas tap dalam 7 hari terakhir.",
      };
    }
    if (dailyMode === "last30") {
      return {
        title: "Riwayat Tap 1 Bulan Terakhir",
        subtitle: "Akumulasi aktivitas 30 hari ke belakang",
        color: "#EC4899",
        entries: hariianPeriods.last30,
        emptyMsg: "Belum ada aktivitas tap dalam 30 hari terakhir.",
      };
    }
    return {
      title: "Semua Riwayat Tap",
      subtitle: "Seluruh aktivitas tap sepanjang masa operasional",
      color: "#8B5CF6",
      entries: filtered,
      emptyMsg: "Belum ada aktivitas tap yang tercatat.",
    };
  }, [dailyMode, customDate, customDateEntries, hariianPeriods, filtered]);

  // ── Ringkasan Total Tap per Cafe untuk Periode yang Aktif (Langsung Kelihatan) ──
  type CafeSummary = {
    storeName: string;
    code: string;
    count: number;
    pct: number;
  };

  const cafeBreakdownList = useMemo((): CafeSummary[] => {
    const countsMap = new Map<string, { count: number; code: string }>();

    // Lacak semua cafe yang terdaftar
    const storeListToTrack = availableStores;
    storeListToTrack.forEach(s => {
      const card = cards.find(c => c.storeName === s);
      countsMap.set(s, { count: 0, code: card?.code || "" });
    });

    activePeriodInfo.entries.forEach(l => {
      const resolvedStore = (l.storeName && l.storeName.trim())
        || activeCardMap.get(l.code)
        || (l.code ? `Kartu ${l.code}` : "Toko Tanpa Nama");
      const cur = countsMap.get(resolvedStore) || { count: 0, code: l.code };
      countsMap.set(resolvedStore, { count: cur.count + 1, code: l.code || cur.code });
    });

    const total = activePeriodInfo.entries.length;
    return Array.from(countsMap.entries())
      .filter(([storeName]) => storeName && storeName.trim().length > 0)
      .map(([storeName, info]) => ({
        storeName,
        code: info.code,
        count: info.count,
        pct: total > 0 ? Math.round((info.count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.storeName.localeCompare(b.storeName));
  }, [activePeriodInfo.entries, availableStores, cards, activeCardMap]);

  // ── KALKULASI DATA ANALYST & LAPORAN EKSEKUTIF KLIEN ───────────────────
  // 1. Pertumbuhan DoD (Hari Ini vs Kemarin)
  const yesterdayCount = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = yesterday.toDateString();
    return storeFilteredLogs.filter(l => new Date(l.tappedAt).toDateString() === yestStr).length;
  }, [storeFilteredLogs]);

  const dodGrowth = useMemo(() => {
    if (yesterdayCount === 0) return todayCount > 0 ? 100 : 0;
    return Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
  }, [todayCount, yesterdayCount]);

  // 2. Pertumbuhan WoW (7 Hari Terakhir vs 7 Hari Sebelumnya)
  const prev7DaysCount = useMemo(() => {
    const now = new Date();
    const startPrev = new Date(now);
    startPrev.setDate(now.getDate() - 13);
    startPrev.setHours(0, 0, 0, 0);
    const endPrev = new Date(now);
    endPrev.setDate(now.getDate() - 6);
    endPrev.setHours(0, 0, 0, 0);

    return storeFilteredLogs.filter(l => {
      const d = new Date(l.tappedAt);
      return d >= startPrev && d < endPrev;
    }).length;
  }, [storeFilteredLogs]);

  const wowGrowth = useMemo(() => {
    if (prev7DaysCount === 0) return thisWeekCount > 0 ? 100 : 0;
    return Math.round(((thisWeekCount - prev7DaysCount) / prev7DaysCount) * 100);
  }, [thisWeekCount, prev7DaysCount]);

  // 3. Estimasi Ulasan Baru Terkonversi (35% industri standard conversion)
  const estimatedReviews = useMemo(() => {
    return Math.max(0, Math.round(totalFilteredCount * 0.35));
  }, [totalFilteredCount]);

  // 4. Distribusi Kuadran Waktu Kedatangan Pelanggan (Dayparting)
  const daypartingBreakdown = useMemo(() => {
    let morning = 0;   // 06:00 - 10:59
    let lunch = 0;     // 11:00 - 14:59
    let afternoon = 0; // 15:00 - 17:59
    let evening = 0;   // 18:00 - 23:59 + 00:00 - 05:59

    storeFilteredLogs.forEach(l => {
      const h = new Date(l.tappedAt).getHours();
      if (h >= 6 && h < 11) morning++;
      else if (h >= 11 && h < 15) lunch++;
      else if (h >= 15 && h < 18) afternoon++;
      else evening++;
    });

    const total = storeFilteredLogs.length || 1;
    return [
      { id: "morning", name: "Pagi (Kopi & Sarapan)", time: "06:00 – 11:00", icon: "🌅", count: morning, pct: Math.round((morning / total) * 100), color: "#F59E0B" },
      { id: "lunch", name: "Siang (Lunch Rush)", time: "11:00 – 15:00", icon: "☀️", count: lunch, pct: Math.round((lunch / total) * 100), color: "#38BDF8" },
      { id: "afternoon", name: "Sore (Hangout & Kerja)", time: "15:00 – 18:00", icon: "🌇", count: afternoon, pct: Math.round((afternoon / total) * 100), color: "#8B5CF6" },
      { id: "evening", name: "Malam (Dinner & Santai)", time: "18:00 – 24:00", icon: "🌙", count: evening, pct: Math.round((evening / total) * 100), color: "#10B981" },
    ];
  }, [storeFilteredLogs]);

  const busiestDaypart = useMemo(() => {
    return [...daypartingBreakdown].sort((a, b) => b.count - a.count)[0];
  }, [daypartingBreakdown]);

  // 5. Toko Performa Tertinggi (Champion) & Butuh Perhatian
  const topStore = useMemo(() => {
    return cafeBreakdownList.length > 0 ? cafeBreakdownList[0] : null;
  }, [cafeBreakdownList]);

  const needsAttentionStore = useMemo(() => {
    if (cafeBreakdownList.length <= 1) return null;
    const reversed = [...cafeBreakdownList].reverse();
    return reversed.find(c => c.count === 0) || reversed[0];
  }, [cafeBreakdownList]);

  // 6. Outlet Aktif Ratio
  const activeStoresCount = useMemo(() => {
    return cafeBreakdownList.filter(c => c.count > 0).length;
  }, [cafeBreakdownList]);

  const activeStoreRatio = useMemo(() => {
    if (availableStores.length === 0) return 100;
    return Math.round((activeStoresCount / availableStores.length) * 100);
  }, [activeStoresCount, availableStores.length]);

  // 7. Salin Ringkasan WhatsApp Klien
  function copyClientReport() {
    const periodLabel = dailyMode === "today" ? "Hari Ini" : dailyMode === "last7" ? "7 Hari Terakhir" : dailyMode === "last30" ? "30 Hari Terakhir" : "Sepanjang Waktu";
    const dateFormatted = formatDateIndo(new Date());

    let text = `📊 *LAPORAN ANALITIK KARTU GOOGLE REVIEW*\n`;
    text += `📅 Periode: ${periodLabel} (${dateFormatted})\n`;
    if (search.trim()) {
      text += `🔍 Pencarian: ${search.trim()}\n`;
    }
    text += `──────────────────────────\n`;
    text += `📈 *Total Tap Pelanggan:* ${totalFilteredCount} kali\n`;
    text += `• *Estimasi Ulasan Baru:* ~${estimatedReviews} ulasan\n`;
    if (totalFilteredCount > 0) {
      text += `🔥 *Jam Paling Ramai:* ${busiestDaypart.name} (${busiestDaypart.pct}% volume trafik)\n`;
    } else {
      text += `🔥 *Aktivitas Jam:* Belum ada tap tercatat pada periode ini\n`;
    }
    text += `🏪 *Tingkat Keaktifan Cabang:* ${activeStoresCount} dari ${availableStores.length} cabang aktif (${activeStoreRatio}%)\n\n`;

    if (cafeBreakdownList.length > 0 && totalFilteredCount > 0) {
      text += `🏆 *Kontribusi Outlet:* \n`;
      cafeBreakdownList.slice(0, 5).forEach((c, idx) => {
        text += `${idx + 1}. ${c.storeName}: ${c.count} tap (${c.pct}%)\n`;
      });
      text += `\n`;
    }

    text += `💡 *Rekomendasi Analis Data:*\n`;
    if (totalFilteredCount > 0) {
      text += `• Waktu emas meminta ulasan adalah di jam ${busiestDaypart.time}.\n`;
    } else {
      text += `• Letakkan kartu review di titik strategis seperti kasir atau meja untuk memulai pengumpulan ulasan.\n`;
    }
    if (topStore && topStore.count > 0) {
      text += `• Cabang ${topStore.storeName} memimpin performa ulasan tertinggi.\n`;
    }
    if (needsAttentionStore && needsAttentionStore.count === 0) {
      text += `• Cabang ${needsAttentionStore.storeName} perlu dipastikan fisik kartunya diletakkan strategis di meja kasir.\n`;
    }
    text += `──────────────────────────\n`;
    text += `_Dihasilkan via Hantic Google Review Card Analytics Suite_`;

    navigator.clipboard.writeText(text);
    setCopySuccessToast(true);
    setTimeout(() => setCopySuccessToast(false), 3000);
  }

  function handlePrintReport() {
    window.print();
  }

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
      label: "Sepanjang Masa",
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
    const found =
      filteredMonthly.find(mg => mg.monthKey === selectedMonthKey) ||
      monthlyGroups.find(mg => mg.monthKey === selectedMonthKey);
    if (found) return found;

    if (selectedMonthKey === thisMonthKey) {
      const stores = allTimeGroup.byStore.map(s => ({
        ...s,
        count: 0,
        pct: 0,
        taps: [],
        firstTap: "",
        lastTap: "",
        avgDaily: 0,
        status: "idle" as const,
      }));
      return {
        monthKey: thisMonthKey,
        label: formatMonthLabel(thisMonthKey),
        total: 0,
        byStore: search
          ? stores.filter(
              s =>
                s.storeName.toLowerCase().includes(search.toLowerCase()) ||
                s.code.toLowerCase().includes(search.toLowerCase())
            )
          : stores,
      };
    }
    return null;
  }, [selectedMonthKey, allTimeGroup, filteredMonthly, monthlyGroups, search]);

  const isCurrentSelected = selectedMonthKey === thisMonthKey;

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
    cutoff7.setDate(now.getDate() - 6);
    cutoff7.setHours(0, 0, 0, 0);
    const cutoff30 = new Date(now);
    cutoff30.setDate(now.getDate() - 29);
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

  // Hitung jumlah tap untuk tiap jam (0..23) pada periode yang dipilih
  const allHourCounts = useMemo(() => {
    const counts = Array(24).fill(0);
    hourFilteredLogs.forEach(l => {
      const h = new Date(l.tappedAt).getHours();
      if (h >= 0 && h < 24) counts[h]++;
    });
    return counts;
  }, [hourFilteredLogs]);

  // Jam aktif yang sedang dipilih (otomatis default ke Jam Puncak jika belum ada pilihan manual)
  const activeHour: number | null = selectedHour !== null
    ? selectedHour
    : (peakHour ? peakHour.hour : (allHourCounts.findIndex(c => c > 0) !== -1 ? allHourCounts.findIndex(c => c > 0) : null));

  // Filter logs khusus jam yang dipilih
  const selectedHourLogs = useMemo(() => {
    if (activeHour === null) return [];
    return hourFilteredLogs.filter(l => new Date(l.tappedAt).getHours() === activeHour);
  }, [hourFilteredLogs, activeHour]);

  const hourData = useMemo(() => {
    const maxH = Math.max(...allHourCounts);
    return allHourCounts.map((v, i) => {
      const isLabeled = i % 4 === 0 || i === 23;
      const hourStr = String(i).padStart(2, "0");
      const nextHourStr = String((i + 1) % 24).padStart(2, "0");
      return {
        label: isLabeled ? `${hourStr}.00` : "",
        value: v,
        highlight: i === activeHour || (v === maxH && maxH > 0),
        tooltip: `Pukul ${hourStr}.00 - ${nextHourStr}.00: ${v} tap (Klik untuk rincian cafe)`,
      };
    });
  }, [allHourCounts, activeHour]);

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

  // ── Tab: Kartu Tidur (Belum Pernah Tap / Belum Tap di Periode Tertentu) ──
  // sleepingPeriod mengikuti dailyMode secara otomatis
  const sleepingPeriod = dailyMode === "last30" ? "last30" : dailyMode === "last7" ? "last7" : "today";

  const tappedCodes = useMemo(() => new Set(validLogs.map(l => l.code)), [validLogs]);

  // Set kode kartu yang pernah di-tap dalam periode tertentu
  const tappedCodesInPeriod = useMemo(() => {
    const now = new Date();
    let cutoff: Date;

    if (sleepingPeriod === "today") {
      cutoff = new Date(now);
      cutoff.setHours(0, 0, 0, 0);
    } else if (sleepingPeriod === "last7") {
      cutoff = new Date(now);
      cutoff.setDate(now.getDate() - 6);
      cutoff.setHours(0, 0, 0, 0);
    } else {
      cutoff = new Date(now);
      cutoff.setDate(now.getDate() - 29);
      cutoff.setHours(0, 0, 0, 0);
    }

    return new Set(
      validLogs
        .filter(l => new Date(l.tappedAt) >= cutoff)
        .map(l => l.code)
    );
  }, [validLogs, sleepingPeriod]);

  // ── Tanggal Awal Kartu Ditugaskan (Earliest Card Assignment Date) ──────
  // Membatasi fitur navigasi mundur ("◄ Lalu") agar tidak tembus ke tanggal sebelum kartu didaftarkan/di-assign
  const earliestAssignedDate = useMemo(() => {
    const timestamps: number[] = [];

    cards.forEach(c => {
      if (c.createdAt) {
        const t = new Date(c.createdAt).getTime();
        if (!isNaN(t)) timestamps.push(t);
      }
    });

    storeFilteredLogs.forEach(l => {
      if (l.tappedAt) {
        const t = new Date(l.tappedAt).getTime();
        if (!isNaN(t)) timestamps.push(t);
      }
    });

    if (timestamps.length === 0) return null;
    const minTimestamp = Math.min(...timestamps);
    if (minTimestamp > Date.now()) return new Date();
    return new Date(minTimestamp);
  }, [cards, storeFilteredLogs]);

  const earliestWeekRange = useMemo(() => {
    if (!earliestAssignedDate) return null;
    return getWeekRange(earliestAssignedDate);
  }, [earliestAssignedDate]);

  // Validasi apakah halaman berikutnya di masa lalu masih memiliki data setelah tanggal kartu di-assign
  const canGoPreviousWeeks = useMemo(() => {
    if (!earliestWeekRange) return false;
    const now = new Date();
    const currentWeekInfo = getWeekRange(now);
    const pageSize = weeklyPeriodType === "12w" ? 12 : 8;

    // Halaman berikutnya di masa lalu dimulai dari index (weekPageOffset + 1) * pageSize
    const nextPageEndIdx = (weekPageOffset + 1) * pageSize;
    const refDate = new Date(currentWeekInfo.start);
    refDate.setDate(refDate.getDate() - (nextPageEndIdx * 7));
    const nextPageLatestWeek = getWeekRange(refDate);

    // Jika minggu paling baru pada halaman berikutnya sudah berakhir sebelum kartu pertama kali di-assign,
    // maka halaman tersebut kosong -> tombol "◄ Lalu" dibatasi (disabled)
    return nextPageLatestWeek.end.getTime() >= earliestWeekRange.start.getTime();
  }, [earliestWeekRange, weeklyPeriodType, weekPageOffset]);

  // Otomatis batasi weekPageOffset jika berada di luar batas valid
  useEffect(() => {
    if (earliestWeekRange && !canGoPreviousWeeks && weekPageOffset > 0) {
      const now = new Date();
      const currentWeekInfo = getWeekRange(now);
      const pageSize = weeklyPeriodType === "12w" ? 12 : 8;
      const diffMs = currentWeekInfo.start.getTime() - earliestWeekRange.start.getTime();
      const maxOffset = diffMs > 0 ? Math.floor(Math.floor(diffMs / (7 * 86400000)) / pageSize) : 0;
      if (weekPageOffset > maxOffset) {
        setWeekPageOffset(maxOffset);
      }
    }
  }, [earliestWeekRange, canGoPreviousWeeks, weekPageOffset, weeklyPeriodType]);

  // ── Tren Mingguan (8 Minggu Terakhir) & Drilldown ─────────────────────
    // ── Navigasi Flat Bulan untuk Card 4 Arsip & Geser ─────────────────
  const allFlatMonths = useMemo(() => monthsByYear.flatMap(y => y.months), [monthsByYear]);
  const isWeeklyMonthMode = weeklyPeriodType === "month";
  const activeWeeklyMonthKey = isWeeklyMonthMode ? (selectedWeeklyMonth || thisMonthKey) : null;
  const currentWeeklyMonthIdx = isWeeklyMonthMode ? allFlatMonths.findIndex(m => m.monthKey === activeWeeklyMonthKey) : -1;
  const canGoPrevMonth = isWeeklyMonthMode && currentWeeklyMonthIdx !== -1 && currentWeeklyMonthIdx < allFlatMonths.length - 1;
  const canGoNextMonth = isWeeklyMonthMode && currentWeeklyMonthIdx > 0;
  const isViewingPastWeeklyMonth = isWeeklyMonthMode && activeWeeklyMonthKey !== thisMonthKey;

  // ── Tren Mingguan (Paginasi Fleksibel, Arsip Bulanan & Sepanjang Tahun) ─
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

    if (weeklyPeriodType === "8w" || weeklyPeriodType === "12w") {
      const pageSize = weeklyPeriodType === "12w" ? 12 : 8;
      const startIdx = (pageSize - 1) + (weekPageOffset * pageSize);
      const endIdx = weekPageOffset * pageSize;

      for (let i = startIdx; i >= endIdx; i--) {
        const refDate = new Date(currentWeekInfo.start);
        refDate.setDate(refDate.getDate() - (i * 7));
        const wInfo = getWeekRange(refDate);

        // Batasi dari tanggal paling awal kartu di-assign (jangan tampilkan minggu yang selesai sebelum kartu ada)
        if (earliestWeekRange && wInfo.end.getTime() < earliestWeekRange.start.getTime()) {
          continue;
        }

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
    } else if (weeklyPeriodType === "month") {
      // Minggu-minggu dalam bulan yang dipilih
      const targetMonthKey = selectedWeeklyMonth || thisMonthKey;
      const [yStr, mStr] = targetMonthKey.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      const firstOfMonth = new Date(y, m, 1);
      const lastOfMonth = new Date(y, m + 1, 0);

      const startWeek = getWeekRange(firstOfMonth);
      const endWeek = getWeekRange(lastOfMonth);

      const cur = new Date(startWeek.start);
      while (cur.getTime() <= endWeek.start.getTime()) {
        const wInfo = getWeekRange(cur);
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

        cur.setDate(cur.getDate() + 7);
      }
    } else if (weeklyPeriodType === "year") {
      // Sepanjang tahun yang dipilih (minggu per minggu)
      const targetYear = selectedWeeklyYear || now.getFullYear();
      const isThisYear = targetYear === now.getFullYear();
      const firstDay = new Date(targetYear, 0, 1);
      const startWeek = getWeekRange(firstDay);
      const endLimit = isThisYear ? currentWeekInfo.start : getWeekRange(new Date(targetYear, 11, 31)).start;

      // Batasi tanggal mulai: jika tahun target adalah tahun kartu pertama kali di-assign,
      // jangan mulai dari awal tahun sebelum kartu ada
      let effectiveStart = startWeek.start;
      if (earliestWeekRange && earliestWeekRange.start.getFullYear() === targetYear) {
        if (earliestWeekRange.start.getTime() > effectiveStart.getTime()) {
          effectiveStart = earliestWeekRange.start;
        }
      }

      const cur = new Date(effectiveStart);
      while (cur.getTime() <= endLimit.getTime()) {
        const wInfo = getWeekRange(cur);
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

        cur.setDate(cur.getDate() + 7);
      }
    }

    return weeks;
  }, [storeFilteredLogs, weeklyPeriodType, weekPageOffset, selectedWeeklyMonth, selectedWeeklyYear, thisMonthKey, earliestWeekRange]);

  const weeklyPeriodLabel = useMemo(() => {
    if (weeklyTrendData.length === 0) return "Tren Mingguan";
    const earliest = weeklyTrendData[0].start;
    const latest = weeklyTrendData[weeklyTrendData.length - 1].end;
    if (weeklyPeriodType === "8w") {
      if (weekPageOffset === 0) {
        return weeklyTrendData.length < 8 && weeklyTrendData.length > 0
          ? `${weeklyTrendData.length} Minggu (${formatDateShortIndo(earliest)} – ${formatDateShortIndo(latest)})`
          : "8 Minggu Terakhir";
      }
      return `${formatDateShortIndo(earliest)} – ${formatDateShortIndo(latest)}`;
    }
    if (weeklyPeriodType === "12w") {
      if (weekPageOffset === 0) {
        return weeklyTrendData.length < 12 && weeklyTrendData.length > 0
          ? `${weeklyTrendData.length} Minggu (${formatDateShortIndo(earliest)} – ${formatDateShortIndo(latest)})`
          : "12 Minggu Terakhir";
      }
      return `${formatDateShortIndo(earliest)} – ${formatDateShortIndo(latest)}`;
    }
    if (weeklyPeriodType === "month") {
      return `Bulan ${formatMonthLabel(selectedWeeklyMonth || thisMonthKey)}`;
    }
    if (weeklyPeriodType === "year") {
      return `Tahun ${selectedWeeklyYear || new Date().getFullYear()}`;
    }
    return "Tren Mingguan";
  }, [weeklyTrendData, weeklyPeriodType, weekPageOffset, selectedWeeklyMonth, selectedWeeklyYear, thisMonthKey]);

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

  const eightWeeksCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 56);
    return storeFilteredLogs.filter(l => new Date(l.tappedAt) >= cutoff).length;
  }, [storeFilteredLogs]);

  const twelveWeeksCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 84);
    return storeFilteredLogs.filter(l => new Date(l.tappedAt) >= cutoff).length;
  }, [storeFilteredLogs]);

  const yearWeeksCount = useMemo(() => {
    const y = selectedWeeklyYear || new Date().getFullYear();
    return storeFilteredLogs.filter(l => new Date(l.tappedAt).getFullYear() === y).length;
  }, [storeFilteredLogs, selectedWeeklyYear]);

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
    cutoff.setDate(cutoff.getDate() - (trendRange === 7 ? 6 : trendRange === 30 ? 29 : trendRange));
    cutoff.setHours(0, 0, 0, 0);
    return storeFilteredLogs.filter(l => new Date(l.tappedAt) >= cutoff);
  }, [storeFilteredLogs, trendRange, customStartDate, customEndDate]);
  const sleepingCards = useMemo(() =>
    cards
      .filter(c => !tappedCodesInPeriod.has(c.code) && (
        c.storeName.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      ))
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        const validA = isNaN(timeA) ? 0 : timeA;
        const validB = isNaN(timeB) ? 0 : timeB;
        if (validB !== validA) {
          return validB - validA; // Terbaru ke terlama (descending)
        }
        return a.storeName.localeCompare(b.storeName);
      }),
    [cards, tappedCodesInPeriod, search]
  );


  const activeCards = useMemo(() =>
    cards.filter(c => tappedCodes.has(c.code)),
    [cards, tappedCodes]
  );

  return (
    <>
      <AdminNav active="taps" />

      <div style={{ background: "#0A0A0F", minHeight: "calc(100vh - 65px)", paddingBottom: "calc(110px + env(safe-area-inset-bottom, 24px))" }}>
        <div className="mobile-container-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px" }}>

          {/* ═════════ 1. MODERN DASHBOARD HERO (Command Center) ═════════ */}
          <div className="dashboard-hero">
            <div className="dashboard-hero-top" style={{ marginBottom: 18 }}>
              <div style={{ width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%" }}>
                  <h1 className="dashboard-hero-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📲</span> Riwayat &amp; Analitik Tap
                  </h1>

                  {/* Manual refresh / sync button - placed directly beside title on desktop & mobile */}
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {justRefreshed && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#34D399",
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "rgba(16, 185, 129, 0.15)",
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        ✓ Terkini
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => fetchData(true)}
                      disabled={isUpdating}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 42,
                        minHeight: 42,
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        touchAction: "manipulation",
                        WebkitTapHighlightColor: "transparent",
                        background: justRefreshed
                          ? "rgba(16, 185, 129, 0.2)"
                          : isUpdating
                          ? "rgba(139, 92, 246, 0.25)"
                          : "rgba(255, 255, 255, 0.06)",
                        border: justRefreshed
                          ? "1.5px solid #10B981"
                          : isUpdating
                          ? "1.5px solid #8B5CF6"
                          : "1px solid rgba(255, 255, 255, 0.14)",
                        color: justRefreshed ? "#34D399" : isUpdating ? "#C4B5FD" : "#CBD5E1",
                        cursor: isUpdating ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                        flexShrink: 0,
                        boxShadow: justRefreshed
                          ? "0 0 14px rgba(16, 185, 129, 0.3)"
                          : isUpdating
                          ? "0 0 14px rgba(139, 92, 246, 0.35)"
                          : "none",
                      }}
                      title="Sinkronisasi Data Tap Sekarang"
                      aria-label="Sinkronisasi Data"
                    >
                      {justRefreshed ? (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            animation: isUpdating ? "spin 0.75s linear infinite" : "none",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <p className="dashboard-hero-sub" style={{ marginTop: 6, marginBottom: 0 }}>
                  Pantau performa kartu pelanggan, tren kunjungan, dan leaderboard ulasan langsung.
                </p>
              </div>
            </div>

            {/* Glanceable Hero Metric Chips (Satu Klik Langsung Tampilkan Ringkasan & Riwayat Periode Tersebut) */}
            <div className="hero-metrics-bar">
              <button
                type="button"
                className={`hero-chip ${(activeTab === "harian" || activeTab === "tidur") && dailyMode === "today" && !customDate ? "active" : ""}`}
                onClick={() => { setDailyMode("today"); setCustomDate(""); setSearch(""); setTapDisplayLimit(10); if (activeTab !== "tidur") setActiveTab("harian"); }}
                title="Tampilkan total tap hari ini"
              >
                <div className="hero-chip-icon" style={{ background: "rgba(16,185,129,0.1)", color: "#34D399", border: "1px solid rgba(16,185,129,0.25)" }}>
                  ☀️
                </div>
                <div className="hero-chip-body">
                  <div className="hero-chip-val" style={{ color: "#34D399" }}>{todayCount}</div>
                  <div className="hero-chip-label">Hari Ini</div>
                </div>
              </button>

              <button
                type="button"
                className={`hero-chip ${(activeTab === "harian" || activeTab === "tidur") && dailyMode === "last7" && !customDate ? "active" : ""}`}
                onClick={() => { setDailyMode("last7"); setCustomDate(""); setSearch(""); setTapDisplayLimit(10); if (activeTab !== "tidur") setActiveTab("harian"); }}
                title="Tampilkan total tap 7 hari terakhir (mingguan)"
              >
                <div className="hero-chip-icon" style={{ background: "rgba(99,102,241,0.1)", color: "#A5B4FC", border: "1px solid rgba(99,102,241,0.25)" }}>
                  📅
                </div>
                <div className="hero-chip-body">
                  <div className="hero-chip-val" style={{ color: "#A5B4FC" }}>{thisWeekCount}</div>
                  <div className="hero-chip-label">7 Hari</div>
                </div>
              </button>

              <button
                type="button"
                className={`hero-chip ${(activeTab === "harian" || activeTab === "tidur") && dailyMode === "last30" && !customDate ? "active" : ""}`}
                onClick={() => { setDailyMode("last30"); setCustomDate(""); setSearch(""); setTapDisplayLimit(10); if (activeTab !== "tidur") setActiveTab("harian"); }}
                title="Tampilkan total tap 30 hari terakhir (bulanan)"
              >
                <div className="hero-chip-icon" style={{ background: "rgba(245,158,11,0.1)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.25)" }}>
                  🗓️
                </div>
                <div className="hero-chip-body">
                  <div className="hero-chip-val" style={{ color: "#FCD34D" }}>{thisMonthCount}</div>
                  <div className="hero-chip-label">30 Hari</div>
                </div>
              </button>

              <button
                type="button"
                className={`hero-chip ${activeTab === "harian" && dailyMode === "all" && !customDate ? "active" : ""}`}
                onClick={() => { setActiveTab("harian"); setDailyMode("all"); setCustomDate(""); setSearch(""); setTapDisplayLimit(10); }}
                title="Tampilkan semua riwayat tap sepanjang masa"
              >
                <div className="hero-chip-icon" style={{ background: "rgba(139,92,246,0.1)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.25)" }}>
                  📑
                </div>
                <div className="hero-chip-body">
                  <div className="hero-chip-val" style={{ color: "#C4B5FD" }}>{totalFilteredCount}</div>
                  <div className="hero-chip-label">Semua Tap</div>
                </div>
              </button>
            </div>
          </div>

          {/* ═════════ 2. MAIN VIEW SWITCHER (Segmented Controls) ═════════ */}
          <div className="main-view-switcher">
            {/* Tab Tren & Jam khusus Desktop (Disembunyikan di Mobile) */}
            <button
              id="tab-btn-tren"
              type="button"
              onClick={(e) => {
                setActiveTab("tren");
                try { sessionStorage.setItem("user_selected_tab", "tren"); } catch {}
                try { e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch {}
              }}
              className={`main-view-btn desktop-only ${activeTab === "tren" ? "active" : ""}`}
            >
              <span>📊</span> <span>Tren &amp; Jam</span>
            </button>
            <button
              id="tab-btn-harian"
              type="button"
              onClick={(e) => {
                setActiveTab("harian");
                try { sessionStorage.setItem("user_selected_tab", "harian"); } catch {}
                try { e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch {}
              }}
              className={`main-view-btn ${activeTab === "harian" ? "active" : ""}`}
            >
              <span>📋</span> <span>Riwayat Tap</span>
            </button>
            <button
              id="tab-btn-bulanan"
              type="button"
              onClick={(e) => {
                setActiveTab("bulanan");
                try { sessionStorage.setItem("user_selected_tab", "bulanan"); } catch {}
                try { e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch {}
              }}
              className={`main-view-btn ${activeTab === "bulanan" ? "active" : ""}`}
            >
              <span>🏆</span> <span>Leaderboard<span className="desktop-inline"> Toko</span></span>
            </button>
            <button
              id="tab-btn-tidur"
              type="button"
              onClick={(e) => {
                setActiveTab("tidur");
                try { sessionStorage.setItem("user_selected_tab", "tidur"); } catch {}
                try { e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch {}
              }}
              className={`main-view-btn ${activeTab === "tidur" ? "danger active" : ""}`}
            >
              <span>😴</span> <span>Belum <span className="desktop-inline">Ada </span>Tap</span>
              {sleepingCards.length > 0 && (
                <span className="tab-pill-badge">{sleepingCards.length}</span>
              )}
            </button>
          </div>

          {/* ═════════ 3. UNIFIED COMMAND TOOLBAR (Full Width Balanced Controls) ═════════ */}
          <div className="dashboard-unified-toolbar">
            {/* Top Row / Desktop Left: Search Input & Outlet Dropdown (Di Kanan) */}
            <div className="toolbar-top-row">
              <div className="smart-search-input-wrap">
                <span className="smart-search-icon">🔍</span>
                <input
                  type="text"
                  className="smart-search-input"
                  placeholder="Cari nama cafe, resto, atau kode kartu..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="smart-search-clear"
                    title="Hapus pencarian"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Custom Date Picker Trigger Button (Disisipkan di samping kiri Semua Outlet) */}
              {activeTab === "harian" && (
                <div className="custom-date-trigger-wrap" style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!datePickerRef.current) return;
                      try {
                        if (typeof datePickerRef.current.showPicker === "function") {
                          datePickerRef.current.showPicker();
                          return;
                        }
                      } catch {}
                      try {
                        datePickerRef.current.focus();
                      } catch {}
                    }}
                    className="custom-date-trigger-btn"
                    style={{
                      height: 42,
                      padding: customDate ? "0 34px 0 14px" : "0 14px",
                      borderRadius: 10,
                      background: customDate
                        ? "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)"
                        : "rgba(99, 102, 241, 0.16)",
                      border: customDate ? "1.5px solid #C7D2FE" : "1.5px solid rgba(99, 102, 241, 0.45)",
                      color: customDate ? "#FFFFFF" : "#C7D2FE",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      boxShadow: customDate ? "0 4px 14px rgba(99, 102, 241, 0.45)" : "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap",
                      position: "relative",
                    }}
                    title="Pilih tanggal tertentu untuk melihat riwayat tap"
                  >
                    <span>📅</span>
                    <span>
                      {customDate ? formatDateShortIndo(customDate) : "Pilih Tanggal"}
                    </span>
                    {!customDate && (
                      <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>▼</span>
                    )}
                  </button>

                  {/* Native date input overlay with showPicker click handler */}
                  <input
                    ref={datePickerRef}
                    type="date"
                    value={customDate}
                    min={earliestAssignedDate ? toDateInputValue(earliestAssignedDate) : undefined}
                    max={toDateInputValue(new Date())}
                    onChange={(e) => {
                      setCustomDate(e.target.value);
                      if (e.target.value) { setDailyMode("custom"); setSearch(""); setTapDisplayLimit(10); }
                    }}
                    onClick={(e) => {
                      try {
                        if (typeof e.currentTarget.showPicker === "function") {
                          e.currentTarget.showPicker();
                        }
                      } catch {}
                    }}
                    className="custom-date-native-input"
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      width: "100%",
                      height: "100%",
                      cursor: "pointer",
                      zIndex: 2,
                      colorScheme: "dark",
                    }}
                    title="Klik untuk memilih tanggal"
                  />

                  {/* Clear/Reset button when date is selected */}
                  {customDate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setCustomDate("");
                        setDailyMode("today");
                        setSearch("");
                        setTapDisplayLimit(10);
                      }}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 3,
                        background: "rgba(239, 68, 68, 0.2)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        color: "#FCA5A5",
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      title="Hapus filter tanggal (Kembali ke Hari Ini)"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}


            </div>
          </div>


          {/* ═════════ TAB 1: RIWAYAT TAP (CLEAN NATIVE 2-COLUMN WORKSPACE) ═════════ */}
          {activeTab === "harian" && (
            loading ? (
              <TapsTabSkeleton text="Memuat aktivitas riwayat tap..." />
            ) : filtered.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.5 }}>📲</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Tidak Ada Data</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  {search ? `Tidak ditemukan tap untuk "${search}".` : "Belum ada aktivitas tap yang tercatat."}
                </p>
              </div>
            ) : (
              <div className={`dashboard-grid-2col show-mobile-${mobileSubView} ${search.trim() ? "single-store-view" : ""}`}>
                {/* ── MOBILE SUBVIEW TOGGLE (Hanya Tampil Saat Mode Semua Toko / Bukan Single Cafe) ── */}
                {!search.trim() && (
                  <div className="mobile-harian-subview-toggle mobile-only">
                    <button
                      type="button"
                      onClick={() => setMobileSubView("feed")}
                      className={`mobile-subview-btn ${mobileSubView === "feed" ? "active" : ""}`}
                    >
                      <span>📋</span> Aliran Tap ({activePeriodInfo.entries.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileSubView("outlets")}
                      className={`mobile-subview-btn ${mobileSubView === "outlets" ? "active" : ""}`}
                    >
                      <span>🏪</span> Ringkasan Outlet
                    </button>
                  </div>
                )}

                {/* ── KOLOM UTAMA: FEED RIWAYAT TAP ── */}
                <div className="dashboard-grid-main">
                  {activePeriodInfo.entries.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>
                        {dailyMode === "today" ? "☀️" : dailyMode === "last7" ? "📅" : dailyMode === "last30" ? "🗓️" : "📑"}
                      </div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6, color: "#F0F0FF" }}>
                        Tidak Ada Data Tap
                      </h3>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 440, margin: "0 auto 18px", lineHeight: 1.5 }}>
                        {search.trim()
                          ? `Toko "${search.trim()}" belum memiliki aktivitas tap pada periode ini.`
                          : activePeriodInfo.emptyMsg}
                      </p>
                      {dailyMode !== "all" && filtered.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setDailyMode("all"); setCustomDate(""); setTapDisplayLimit(10); }}
                          className="btn btn-ghost"
                          style={{ padding: "8px 16px", fontSize: "0.8rem", color: "#A5B4FC", borderColor: "rgba(99,102,241,0.3)" }}
                        >
                          📑 Lihat Semua Riwayat ({filtered.length} tap)
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="tap-group-box">
                      <div className="tap-group-header">
                        <div className="tap-group-title-wrap">
                          <div className="tap-group-title-main">
                            <span className="tap-group-title-icon" style={{ fontSize: "1.1rem" }}>
                              {search.trim() ? "🏪" : dailyMode === "today" ? "☀️" : dailyMode === "last7" ? "📅" : dailyMode === "last30" ? "🗓️" : customDate ? "🗓️" : "📑"}
                            </span>
                            <span className="tap-group-title-text">
                              {search.trim() ? `Riwayat Tap — ${search.trim()}` : activePeriodInfo.title}
                            </span>
                          </div>
                          <div className="tap-group-subtitle">
                            {search.trim()
                              ? `Menampilkan seluruh aktivitas tap khusus toko "${search.trim()}" (${
                                  dailyMode === "today" && !customDate ? "Hari Ini" :
                                  dailyMode === "last7" && !customDate ? "7 Hari Terakhir" :
                                  dailyMode === "last30" && !customDate ? "30 Hari Terakhir" :
                                  customDate ? formatDateIndo(customDate) : "Sepanjang Masa"
                                })`
                              : activePeriodInfo.subtitle}
                          </div>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {search.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearch("");
                                setTapDisplayLimit(10);
                              }}
                              className="btn btn-ghost"
                              style={{
                                padding: "5px 12px",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                color: "#A5B4FC",
                                borderColor: "rgba(99,102,241,0.35)",
                                background: "rgba(99,102,241,0.1)",
                                borderRadius: 8,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                cursor: "pointer",
                              }}
                              title="Kembali ke semua riwayat toko"
                            >
                              <span>✕</span>
                              <span>Semua Toko</span>
                            </button>
                          )}
                          <span className="tap-group-badge">
                            {activePeriodInfo.entries.length} TAP
                          </span>
                        </div>
                      </div>

                      <div className="tap-group-scroll-area">
                        {activePeriodInfo.entries.slice(0, tapDisplayLimit).map((log, i) => {
                          const resolvedStoreName = (log.storeName && log.storeName.trim())
                            || activeCardMap.get(log.code)
                            || (log.code ? `Kartu ${log.code}` : "Toko Tanpa Nama");
                          const reviewUrl = cardUrlMap.get(log.code) || (resolvedStoreName ? getPublicGoogleReviewUrl("", resolvedStoreName) : "");
                          const d = new Date(log.tappedAt);
                          const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                          const isPrevYear = d.getFullYear() !== new Date().getFullYear();
                          const dateStr = d.toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            ...(isPrevYear ? { year: "numeric" } : {}),
                          });
                          const initials = getStoreInitials(resolvedStoreName);

                          return (
                            <div key={`${log.code}-${log.tappedAt}-${i}`} className="tap-row-native">
                              {/* Kolom Kiri / Utama: Avatar Toko Minimalis + Info Toko */}
                              <div className="tap-row-main">
                                <div className="tap-store-avatar" title={resolvedStoreName}>
                                  <span>{initials}</span>
                                </div>
                                <div className="tap-store-info">
                                  <div className="tap-store-name" title={resolvedStoreName}>{resolvedStoreName}</div>
                                  <div className="tap-store-sub">
                                    <span className="tap-code-tag">{log.code}</span>
                                    <span className="tap-meta-dot">·</span>
                                    <span className="tap-date-text">{dateStr}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Kolom Kanan / Samping: Timestamp & Review Link */}
                              <div className="tap-row-side">
                                <div className="tap-time-stack" title={formatFull(log.tappedAt)}>
                                  <span className="tap-time-ago">{timeAgo(log.tappedAt)}</span>
                                  <span className="tap-time-exact">{timeStr}</span>
                                </div>

                                {showReviewBtn && reviewUrl && (
                                  <a
                                    href={reviewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="tap-review-btn"
                                    title={`Buka menu ulasan Google publik ${resolvedStoreName}`}
                                  >
                                    <span className="tap-review-text">Ulasan ↗</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Tombol Tampilkan Semua Tap Sekaligus (Satu Opsi Bersih & Simetris) */}
                        {(() => {
                          if (activePeriodInfo.entries.length > tapDisplayLimit) {
                            return (
                              <div className="tap-pagination-bar">
                                <button
                                  type="button"
                                  className="tap-show-all-btn"
                                  onClick={() => setTapDisplayLimit(activePeriodInfo.entries.length)}
                                  style={{
                                    width: "100%",
                                    padding: "11px 20px",
                                    borderRadius: 10,
                                    background: "rgba(139, 92, 246, 0.14)",
                                    border: "1px solid rgba(139, 92, 246, 0.35)",
                                    color: "#EDE9FE",
                                    fontSize: "0.84rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 7,
                                    transition: "all 0.15s ease",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={`Tampilkan semua ${activePeriodInfo.entries.length} riwayat tap sekaligus`}
                                >
                                  <span>✨</span>
                                  <span>Tampilkan Semua ({activePeriodInfo.entries.length} Tap)</span>
                                </button>
                              </div>
                            );
                          }

                          if (activePeriodInfo.entries.length > 10) {
                            return (
                              <div
                                className="tap-all-shown-bar"
                                style={{
                                  textAlign: "center",
                                  padding: "12px 18px",
                                  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                                  display: "flex",
                                  justifyContent: "center",
                                  alignItems: "center",
                                  gap: 12,
                                  color: "var(--text-muted)",
                                  fontSize: "0.8rem",
                                  background: "rgba(255, 255, 255, 0.015)",
                                }}
                              >
                                <span>Semua <strong>{activePeriodInfo.entries.length}</strong> tap telah ditampilkan</span>
                                <span style={{ opacity: 0.3 }}>•</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTapDisplayLimit(10);
                                    if (typeof window !== "undefined") {
                                      window.scrollTo({ top: 300, behavior: "smooth" });
                                    }
                                  }}
                                  style={{
                                    background: "rgba(99, 102, 241, 0.12)",
                                    border: "1px solid rgba(99, 102, 241, 0.3)",
                                    color: "#C7D2FE",
                                    padding: "4px 12px",
                                    borderRadius: 8,
                                    fontSize: "0.76rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  ▲ Tampilkan Lebih Sedikit
                                </button>
                              </div>
                            );
                          }

                          return null;
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── KOLOM SAMPING: SCORECARD CAFE & INSIGHT WIDGETS (Hanya Tampil Pada Tampilan Global Semua Toko) ── */}
                {!search.trim() && (
                  <div className="dashboard-grid-sidebar">
                    {/* 1. Jam Kunjungan Tersibuk Widget (Desktop Only - Disembunyikan di Mobile) */}
                    <div className="peak-insight-box desktop-only">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#F8FAFC", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>⏱️</span> Jam Kunjungan Tersibuk
                        </span>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(99,102,241,0.15)", color: "#A5B4FC", border: "1px solid rgba(99,102,241,0.3)" }}>
                          {dailyMode === "today" ? "Hari Ini" : dailyMode === "last7" ? "7 Hari" : dailyMode === "last30" ? "30 Hari" : "Periode Aktif"}
                        </span>
                      </div>

                      {(() => {
                        const counts = Array(24).fill(0);
                        activePeriodInfo.entries.forEach(l => {
                          const h = new Date(l.tappedAt).getHours();
                          if (h >= 0 && h < 24) counts[h]++;
                        });
                        const max = Math.max(...counts);
                        if (max === 0) {
                          return (
                            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                              Belum ada riwayat tap yang tercatat pada rentang waktu ini.
                            </p>
                          );
                        }
                        const h = counts.indexOf(max);
                        const label = `${String(h).padStart(2, "0")}.00 – ${String((h + 1) % 24).padStart(2, "0")}.00 WIB`;

                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: 10 }}>
                            <div style={{ fontSize: "1.3rem" }}>🔥</div>
                            <div>
                              <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#34D399" }}>{label}</div>
                              <div style={{ fontSize: "0.72rem", color: "#A7F3D0" }}>{max} tap pelanggan tercatat</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 2. Ringkasan Status Outlet & Kartu */}
                    <div className="peak-insight-box">
                      <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#F8FAFC", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>📊</span> Status Operasional Kartu
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>Toko Aktif</div>
                          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#F8FAFC", marginTop: 2 }}>{availableStores.length}</div>
                        </div>
                        <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>Kartu Aktif</div>
                          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#34D399", marginTop: 2 }}>{cards.length - sleepingCards.length}</div>
                        </div>
                      </div>
                      {sleepingCards.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("tidur")}
                          style={{
                            width: "100%",
                            marginTop: 10,
                            padding: "7px 10px",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.25)",
                            borderRadius: 8,
                            color: "#FCA5A5",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <span>😴</span> {sleepingCards.length} Kartu Belum Ada Tap ↗
                        </button>
                      )}
                    </div>

                    {/* 3. Scorecard Total Tap per Cafe (Top 5 & Tampilkan Semua) */}
                    {cafeBreakdownList.length > 0 && (
                      <div className="cafe-scorecard-box">
                        <div className="cafe-scorecard-header">
                          <div className="cafe-scorecard-title">
                            <span>🏪</span>
                            <span>
                              Total Tap per Cafe — {
                                dailyMode === "today" && !customDate ? "Hari Ini" :
                                dailyMode === "last7" && !customDate ? "7 Hari Terakhir" :
                                dailyMode === "last30" && !customDate ? "30 Hari Terakhir" :
                                customDate ? formatDateShortIndo(customDate) : "Sepanjang Masa"
                              }
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {search && (
                              <button
                                type="button"
                                onClick={() => setSearch("")}
                                style={{
                                  background: "rgba(239, 68, 68, 0.15)",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  color: "#FCA5A5",
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                title="Hapus filter pencarian cafe"
                              >
                                ✕ Reset
                              </button>
                            )}
                            <span className="cafe-scorecard-meta">
                              {activePeriodInfo.entries.length} TAP
                            </span>
                          </div>
                        </div>

                        {(() => {
                          const storesWithTaps = cafeBreakdownList.filter(c => c.count > 0);
                          const allRegisteredStores = cafeBreakdownList;

                          // Target list: jika ada pencarian, ikuti pencarian.
                          // Jika tanpa pencarian: tampilkan hanya toko yang punya tap di periode ini.
                          // Kalau kurang dari 5, tampilkan semuanya yang ada tap saja (jangan isi dengan toko tanpa tap).
                          // Kalau lebih dari 5, tampilkan Top 5 dulu + tombol Tampilkan Semua.
                          const targetList = search.trim()
                            ? allRegisteredStores.filter(c =>
                                c.storeName.toLowerCase().includes(search.toLowerCase()) ||
                                c.code.toLowerCase().includes(search.toLowerCase())
                              )
                            : storesWithTaps;

                          if (targetList.length === 0) {
                            return (
                              <div style={{
                                padding: "36px 16px",
                                textAlign: "center",
                                color: "var(--text-muted)",
                              }}>
                                <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>☕</div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#CBD5E1", marginBottom: 4 }}>
                                  Belum Ada Aktivitas Tap
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                                  {search.trim()
                                    ? `Tidak ditemukan toko yang cocok dengan "${search}".`
                                    : `Belum ada cafe yang menerima tap pelanggan ${
                                        dailyMode === "today" && !customDate ? "hari ini" :
                                        dailyMode === "last7" && !customDate ? "dalam 7 hari terakhir" :
                                        dailyMode === "last30" && !customDate ? "dalam 30 hari terakhir" :
                                        customDate ? `pada ${formatDateShortIndo(customDate)}` : "pada periode ini"
                                      }.`}
                                </div>
                              </div>
                            );
                          }

                          const visibleStores = showAllSidebarStores ? targetList : targetList.slice(0, 5);

                          return (
                            <>
                              <div className="cafe-scorecard-grid">
                                {visibleStores.map((c, idx) => {
                                  const isSelected = search.toLowerCase() === c.storeName.toLowerCase();
                                  const rankBadge = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

                                  return (
                                    <div
                                      key={c.storeName}
                                      onClick={() => setSearch(search.toLowerCase() === c.storeName.toLowerCase() ? "" : c.storeName)}
                                      className={`cafe-scorecard-item ${isSelected ? "selected" : ""}`}
                                      title={`Klik untuk filter aktivitas ${c.storeName}`}
                                    >
                                      <div className="cafe-scorecard-left">
                                        <span className="cafe-rank-badge">{rankBadge}</span>
                                        <div className="cafe-name-wrap">
                                          <div className="cafe-name-text">
                                            <span>{c.storeName}</span>
                                            {isSelected && <span className="cafe-filtered-pill">Terpilih</span>}
                                          </div>
                                          <div className="cafe-sub-text">
                                            <span className="cafe-code-pill">{c.code}</span>
                                            {c.count > 0 && <span>· {c.pct}%</span>}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="cafe-scorecard-right">
                                        <div className="cafe-count-wrap">
                                          <span className={`cafe-count-num ${c.count > 0 ? "has-taps" : "zero-taps"}`}>
                                            {c.count}
                                          </span>
                                          <span className="cafe-count-unit">tap</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Tombol Toggle: Tampilkan 5 Toko Secara Default, Sembunyikan Sisanya dengan Tombol */}
                              {targetList.length > 5 && (
                                <div style={{ padding: "0 14px 12px" }}>
                                  <button
                                    type="button"
                                    onClick={() => setShowAllSidebarStores(prev => !prev)}
                                    style={{
                                      width: "100%",
                                      padding: "9px 14px",
                                      background: "rgba(99, 102, 241, 0.1)",
                                      border: "1px dashed rgba(99, 102, 241, 0.35)",
                                      borderRadius: 8,
                                      color: "#C7D2FE",
                                      fontSize: "0.78rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 6,
                                      transition: "all 0.15s ease",
                                    }}
                                  >
                                    <span>{showAllSidebarStores ? "▲" : "▼"}</span>
                                    <span>
                                      {showAllSidebarStores
                                        ? "Tampilkan Lebih Sedikit"
                                        : `Tampilkan Semua (${targetList.length} Toko)`}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {/* ═════════ TAB 2: REKAP BULANAN & PERINGKAT TOKO ═════════ */}
          {activeTab === "bulanan" && (
            loading ? (
              <TapsTabSkeleton text="Memuat data ranking bulanan..." />
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
                {/* Selector Pemilih Bulan Terpadu (Dropdown Rapi Dikelompokkan per Tahun + Quick Toggle) */}
                <div className="month-selector-bar">
                  <div className="month-selector-main">
                    <div className="month-selector-label-group">
                      <label
                        htmlFor="unified-month-select"
                        className="month-selector-label"
                      >
                        <span>📅</span>
                        <span>Pilih Periode:</span>
                      </label>

                      {/* Tombol Cepat: Bulan Ini & All-Time Langsung di Toolbar Atas */}
                      <div className="month-selector-quick-actions">
                        <button
                          type="button"
                          onClick={() => setSelectedMonth(thisMonthKey)}
                          className={`month-quick-pill ${selectedMonthKey === thisMonthKey ? "active" : ""}`}
                          title="Tampilkan leaderboard bulan berjalan saat ini"
                        >
                          <span>Bulan Ini</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedMonth("all")}
                          className={`month-quick-pill ${selectedMonthKey === "all" ? "active" : ""}`}
                          title="Tampilkan akumulasi total tap sepanjang masa (All-Time)"
                        >
                          <span>🌐</span>
                          <span>Histori All-Time</span>
                        </button>
                      </div>
                    </div>

                    {/* Dropdown Arsip Bulan Terpadu (Khusus Per Bulan) */}
                    <div className="month-select-wrapper">
                      <select
                        id="unified-month-select"
                        value={selectedMonthKey === "all" ? "" : selectedMonthKey}
                        onChange={(e) => {
                          if (e.target.value) setSelectedMonth(e.target.value);
                        }}
                        className="month-unified-select"
                      >
                        {selectedMonthKey === "all" && (
                          <option value="" disabled hidden>
                            📅 Pilih Bulan...
                          </option>
                        )}

                        {monthsByYear.map(({ year, months }) => (
                          <optgroup
                            key={year}
                            label={`── Arsip Tahun ${year} ──`}
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
                                  {isCurrent ? `${m.label} (Bulan Ini)` : m.label} · {m.total} Tap
                                </option>
                              );
                            })}
                          </optgroup>
                        ))}
                      </select>
                      <span className="month-select-arrow">▼</span>
                    </div>
                  </div>

                  {/* Status / Badge Periode Terpilih */}
                  <div className="month-selector-badge-wrap">
                    {selectedMonthKey === "all" ? (
                      <span
                        className="badge"
                        style={{
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#34D399",
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
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
                          whiteSpace: "nowrap",
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
                          whiteSpace: "nowrap",
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
                        borderColor: "rgba(255,255,255,0.08)",
                        background: "#111118",
                      }}
                    >
                      {/* Month Header Banner */}
                      <div className="leaderboard-card-header">
                        <div className="leaderboard-header-info">
                          <div className="leaderboard-title-row">
                            <span className="leaderboard-title-text">
                              🏆 Rekap {mg.label}
                            </span>
                          </div>
                          <div className="leaderboard-subtitle-text">
                            {mg.byStore.length} Toko Terdaftar Aktif · Total {mg.total} Tap Pelanggan
                          </div>
                        </div>

                        <div className="leaderboard-header-stat">
                          <span className="leaderboard-stat-count">
                            {mg.total}×
                          </span>
                          <span className="leaderboard-stat-label">
                            Total Tap
                          </span>
                        </div>
                      </div>

                      {/* Store Rankings List */}
                      <div style={{ padding: "8px 14px 16px" }}>
                        {mg.total === 0 ? (
                          <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                            <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>☕</div>
                            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#CBD5E1", marginBottom: 4 }}>
                              Belum Ada Aktivitas Tap
                            </div>
                            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                              Belum ada aktivitas tap kartu untuk bulan {mg.label}.
                            </div>
                          </div>
                        ) : (
                          mg.byStore.filter(s => s.count > 0).map((s, idx) => {
                          const delta = s.lastMonthCount > 0 ? s.count - s.lastMonthCount : null;
                          const storeKey = `${mg.monthKey}::${s.storeName}`;
                          const isStoreOpen = expandedStore === storeKey;
                          const storeTaps = tapsByStoreMonth.get(storeKey) ?? [];
                          const percent = Math.round((s.count / maxCount) * 100);

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

                                {/* Bottom row: Actions (Detail tap) */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: "0.72rem" }}>
                                  {s.count > 0 ? (
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
                                  ) : (
                                    <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontStyle: "italic" }}>
                                      Belum ada tap di bulan ini
                                    </span>
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
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 260, overflowY: "auto", overscrollBehavior: "auto", WebkitOverflowScrolling: "touch" }}>
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
                        }))}


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

          {/* ═════════ TAB 3: TREN & JAM RAMAI (DESKTOP ONLY) ═════════ */}
          {activeTab === "tren" && (
            <div className="desktop-only" style={{ width: "100%" }}>
              {loading ? (
              <TapsTabSkeleton text="Menghitung analitik tren..." />
            ) : validLogs.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.5 }}>📈</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Belum Ada Data Tap</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Grafik tren harian dan distribusi jam akan otomatis digambar setelah ada tap.
                </p>
              </div>
            ) : (
              <div className="analytics-canvas-card">
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

                    {/* 2. Breakdown Cafe pada Tanggal Ini — sembunyikan jika hanya 1 outlet difilter */}
                    {!isSingleOutletFilter && drilldownLogs.length > 0 && (
                      <CafeBreakdownCard
                        title={`Outlet yang Ditap pada ${formatDateIndo(selectedDrilldownDate)}`}
                        subtitle="Daftar toko/cafe yang menerima tap pelanggan pada tanggal ini."
                        logs={drilldownLogs}
                        cardUrlMap={cardUrlMap}
                      />
                    )}
                  </div>
                ) : (
                  <div>
                    {/* ── Header Card dengan Mode Switcher Terpadu (Jam, Harian, Mingguan) ── */}
                    <div className="trend-header-row">
                      <div className="trend-header-text">
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F0F0FF" }}>
                          {trenView === "jam"
                            ? `⏱️ Distribusi Jam Masuk ${hourPeriod === "today" ? "(Hari Ini)" : hourPeriod === "last7" ? "(7 Hari Terakhir)" : hourPeriod === "last30" ? "(1 Bulan Terakhir)" : "(Semua Riwayat)"}`
                            : trenView === "harian"
                            ? (trendRange === "custom"
                                ? (customStartDate && customEndDate
                                    ? `📅 Tren Aktivitas Harian (${formatDateShortIndo(customStartDate)} – ${formatDateShortIndo(customEndDate)})`
                                    : "📅 Tren Aktivitas Harian (Rentang Kustom)")
                                : `📅 Tren Aktivitas Harian (${trendRange} Hari Terakhir)`)
                            : selectedWeekObj
                            ? `📅 Rincian 7 Hari: ${selectedWeekObj.subLabel} (${selectedWeekObj.label})`
                            : `📊 Tren Aktivitas Mingguan (${weeklyPeriodLabel})`}
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
                            : `Akumulasi tap per minggu kalender (${weeklyPeriodLabel}). Klik salah satu batang minggu untuk membedah 7 hari di dalamnya.`}
                        </p>
                      </div>

                      {/* Mode Switcher: 3 Tombol (Jam Masuk vs Tren Harian vs Tren Mingguan) */}
                      <div className="chart-mode-switcher" style={{ flexShrink: 0 }}>
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
                                onClick={() => { setHourPeriod(p.id); setSelectedHour(null); }}
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
                                <div style={{ fontSize: "0.72rem", marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, lineHeight: 1.3 }}>
                                  <span style={{ color: isAct ? "#CBD5E1" : "var(--text-muted)", fontSize: "0.68rem" }}>🏆 Puncak:</span>
                                  <strong style={{ color: "#34D399", fontSize: "0.72rem" }}>
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
                          selectedIndex={activeHour}
                          onBarClick={(i) => {
                            if (hourFilteredLogs.length > 0) setSelectedHour(i);
                          }}
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

                        {/* Rincian Cafe Khusus Jam Terpilih — Terhubung langsung dengan grafik jam & dropdown */}
                        {!isSingleOutletFilter && hourFilteredLogs.length > 0 && activeHour !== null && (
                          <HourlyCafeBreakdownCard
                            hour={activeHour}
                            peakHour={peakHour}
                            logs={selectedHourLogs}
                            allHourCounts={allHourCounts}
                            onSelectHour={(h) => setSelectedHour(h)}
                            cardUrlMap={cardUrlMap}
                            activeCardMap={activeCardMap}
                            periodName={hourPeriod === "today" ? "Hari Ini" : hourPeriod === "last7" ? "7 Hari Terakhir" : hourPeriod === "last30" ? "1 Bulan Terakhir" : "Semua Riwayat"}
                          />
                        )}
                      </div>
                    )}

                    {/* ── View 2: Tren Harian dengan Fitur Drill-Down & Kustom Rentang Tanggal ── */}
                    {trenView === "harian" && (() => {
                      const activeDailyData = trendRange === 7 ? trendData7 : trendRange === 30 ? trendData30 : customTrendData;
                      const rangeTitle = trendRange === "custom"
                        ? (customStartDate && customEndDate
                            ? `${formatDateShortIndo(customStartDate)} – ${formatDateShortIndo(customEndDate)}`
                            : "Rentang Kustom")
                        : `${trendRange} Hari Terakhir`;

                      return (
                        <div>
                          {/* Badges Info (Sesuai Foto 1) */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span className="badge badge-orange" style={{ background: "rgba(245,158,11,0.15)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.3)" }}>
                                Total: {activeDailyData.reduce((s, d) => s + d.value, 0)} tap
                              </span>

                              {(() => {
                                const maxDay = activeDailyData.reduce((prev, cur) => (cur.value > prev.value ? cur : prev), activeDailyData[0]);
                                if (maxDay && maxDay.value > 0) {
                                  return (
                                    <span className="badge badge-green" style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      🏆 Hari Teramai: <strong>{maxDay.label || maxDay.subLabel}</strong> ({maxDay.value} tap)
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "#7DD3FC" }}>
                              <span>👆</span>
                              <span>Klik batang untuk bedah jam &amp; cafe</span>
                            </div>
                          </div>

                          {/* Filter Periode & Ringkasan Hari Puncak per Periode (Sesuai Foto 1) */}
                          <div className="hour-period-grid">
                            {/* Card 1: 7 Hari Terakhir */}
                            <button
                              type="button"
                              onClick={() => setTrendRange(7)}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                padding: "10px 14px",
                                borderRadius: 10,
                                background: trendRange === 7 ? "rgba(245, 158, 11, 0.14)" : "rgba(255, 255, 255, 0.03)",
                                border: trendRange === 7 ? "1px solid rgba(245, 158, 11, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.15s ease",
                                boxShadow: "none",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
                                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: trendRange === 7 ? "#FCD34D" : "#E2E8F0" }}>
                                  📅 7 Hari Terakhir
                                </span>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: trendRange === 7 ? "#F59E0B" : "rgba(255,255,255,0.08)", color: trendRange === 7 ? "#000" : "#FFF" }}>
                                  {trendData7.reduce((s, d) => s + d.value, 0)} tap
                                </span>
                              </div>
                              <div style={{ fontSize: "0.72rem", marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, lineHeight: 1.3 }}>
                                <span style={{ color: trendRange === 7 ? "#CBD5E1" : "var(--text-muted)", fontSize: "0.68rem" }}>🏆 Puncak:</span>
                                <strong style={{ color: "#34D399", fontSize: "0.72rem" }}>
                                  {(() => {
                                    const m = trendData7.reduce((prev, cur) => cur.value > prev.value ? cur : prev, trendData7[0]);
                                    return m && m.value > 0 ? `${m.label || m.subLabel} (${m.value} tap)` : "Belum ada";
                                  })()}
                                </strong>
                              </div>
                            </button>

                            {/* Card 2: 30 Hari Terakhir */}
                            <button
                              type="button"
                              onClick={() => setTrendRange(30)}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                padding: "10px 14px",
                                borderRadius: 10,
                                background: trendRange === 30 ? "rgba(245, 158, 11, 0.14)" : "rgba(255, 255, 255, 0.03)",
                                border: trendRange === 30 ? "1px solid rgba(245, 158, 11, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.15s ease",
                                boxShadow: "none",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
                                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: trendRange === 30 ? "#FCD34D" : "#E2E8F0" }}>
                                  🗓️ 30 Hari Terakhir
                                </span>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: trendRange === 30 ? "#F59E0B" : "rgba(255,255,255,0.08)", color: trendRange === 30 ? "#000" : "#FFF" }}>
                                  {trendData30.reduce((s, d) => s + d.value, 0)} tap
                                </span>
                              </div>
                              <div style={{ fontSize: "0.72rem", marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, lineHeight: 1.3 }}>
                                <span style={{ color: trendRange === 30 ? "#CBD5E1" : "var(--text-muted)", fontSize: "0.68rem" }}>🏆 Puncak:</span>
                                <strong style={{ color: "#34D399", fontSize: "0.72rem" }}>
                                  {(() => {
                                    const m = trendData30.reduce((prev, cur) => cur.value > prev.value ? cur : prev, trendData30[0]);
                                    return m && m.value > 0 ? `${m.label || m.subLabel} (${m.value} tap)` : "Belum ada";
                                  })()}
                                </strong>
                              </div>
                            </button>

                            {/* Card 3: Rentang Kustom */}
                            <button
                              type="button"
                              onClick={() => setTrendRange("custom")}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                padding: "10px 14px",
                                borderRadius: 10,
                                background: trendRange === "custom" ? "rgba(245, 158, 11, 0.14)" : "rgba(255, 255, 255, 0.03)",
                                border: trendRange === "custom" ? "1px solid rgba(245, 158, 11, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.15s ease",
                                boxShadow: "none",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
                                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: trendRange === "custom" ? "#FCD34D" : "#E2E8F0" }}>
                                  🗓️ Rentang Kustom
                                </span>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: trendRange === "custom" ? "#F59E0B" : "rgba(255,255,255,0.08)", color: trendRange === "custom" ? "#000" : "#FFF" }}>
                                  {customTrendData.reduce((s, d) => s + d.value, 0)} tap
                                </span>
                              </div>
                              <div style={{ fontSize: "0.72rem", marginTop: 5, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                                <span style={{ color: trendRange === "custom" ? "#CBD5E1" : "var(--text-muted)" }}>Pilih:</span>
                                <strong style={{ color: "#34D399" }}>
                                  {customStartDate && customEndDate ? `${formatDateShortIndo(customStartDate)} – ${formatDateShortIndo(customEndDate)}` : "Tentukan tanggal"}
                                </strong>
                              </div>
                            </button>
                          </div>

                          {trendRange === "custom" && (
                            <div className="custom-date-range-bar">
                              <span className="custom-date-range-label">
                                <span>📅</span>
                                <span>Pilih Tanggal:</span>
                              </span>

                              <div className="custom-date-range-inputs">
                                {/* Tombol Tanggal Mulai */}
                                <div className="custom-date-input-wrap">
                                  <button
                                    type="button"
                                    className="date-range-pill-btn"
                                    title="Klik untuk memilih tanggal mulai"
                                  >
                                    <span style={{ fontSize: "0.82rem" }}>📅</span>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {customStartDate ? formatDateShortIndo(customStartDate) : "Pilih Mulai"}
                                    </span>
                                    <span style={{ fontSize: "0.55rem", opacity: 0.6 }}>▼</span>
                                  </button>
                                  <input
                                    type="date"
                                    value={customStartDate}
                                    min={earliestAssignedDate ? toDateInputValue(earliestAssignedDate) : undefined}
                                    max={customEndDate || toDateInputValue(new Date())}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    onClick={(e) => {
                                      try {
                                        if (typeof e.currentTarget.showPicker === "function") {
                                          e.currentTarget.showPicker();
                                        }
                                      } catch {}
                                    }}
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      opacity: 0,
                                      width: "100%",
                                      height: "100%",
                                      cursor: "pointer",
                                      zIndex: 2,
                                      colorScheme: "dark",
                                    }}
                                    title="Klik untuk memilih tanggal awal"
                                  />
                                </div>

                                <span className="date-range-separator">s/d</span>

                                {/* Tombol Tanggal Akhir */}
                                <div className="custom-date-input-wrap">
                                  <button
                                    type="button"
                                    className="date-range-pill-btn"
                                    title="Klik untuk memilih tanggal akhir"
                                  >
                                    <span style={{ fontSize: "0.82rem" }}>📅</span>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {customEndDate ? formatDateShortIndo(customEndDate) : "Pilih Akhir"}
                                    </span>
                                    <span style={{ fontSize: "0.55rem", opacity: 0.6 }}>▼</span>
                                  </button>
                                  <input
                                    type="date"
                                    value={customEndDate}
                                    min={customStartDate || (earliestAssignedDate ? toDateInputValue(earliestAssignedDate) : undefined)}
                                    max={toDateInputValue(new Date())}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    onClick={(e) => {
                                      try {
                                        if (typeof e.currentTarget.showPicker === "function") {
                                          e.currentTarget.showPicker();
                                        }
                                      } catch {}
                                    }}
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      opacity: 0,
                                      width: "100%",
                                      height: "100%",
                                      cursor: "pointer",
                                      zIndex: 2,
                                      colorScheme: "dark",
                                    }}
                                    title="Klik untuk memilih tanggal akhir"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

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

                          {/* Breakdown Cafe Periode Harian — sembunyikan jika hanya 1 outlet difilter */}
                          {!isSingleOutletFilter && (
                            <CafeBreakdownCard
                              title={`Peringkat Cafe Teraktif (${rangeTitle})`}
                              subtitle={`Akumulasi kontribusi tap per cafe selama rentang waktu ini.`}
                              logs={trendRangeLogs}
                              cardUrlMap={cardUrlMap}
                            />
                          )}
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
                                { label: `Semua Minggu (${weeklyPeriodLabel})`, icon: "🏠", onClick: () => setSelectedWeekKey(null) },
                                { label: `${selectedWeekObj.subLabel} (${selectedWeekObj.label})`, icon: "📅", active: true },
                              ]}
                              onBack={() => setSelectedWeekKey(null)}
                              backLabel={`Kembali ke ${weeklyPeriodLabel}`}
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

                            {/* Breakdown Cafe Minggu Ini — sembunyikan jika hanya 1 outlet difilter */}
                            {!isSingleOutletFilter && (
                              <CafeBreakdownCard
                                title={`Cafe Teraktif pada ${selectedWeekObj.subLabel} (${selectedWeekObj.label})`}
                                subtitle="Outlet yang menyumbang tap terbanyak dalam minggu terpilih ini."
                                logs={selectedWeekObj.logs}
                                cardUrlMap={cardUrlMap}
                              />
                            )}
                          </div>
                        ) : (
                          /* Level 1: Grafik Batang Mingguan dengan Navigasi Periode & Arsip */
                          <div>
                            {/* Badges Info (Sesuai Foto 1) */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <span className="badge badge-purple" style={{ background: "rgba(139,92,246,0.15)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.3)" }}>
                                  Total: {weeklyTrendData.reduce((s, w) => s + w.count, 0)} tap
                                </span>
                                {(() => {
                                  const maxWeek = weeklyTrendData.reduce((prev, cur) => (cur.count > prev.count ? cur : prev), weeklyTrendData[0]);
                                  if (maxWeek && maxWeek.count > 0) {
                                    return (
                                      <span className="badge badge-green" style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                        🏆 Minggu Teramai: <strong>{maxWeek.subLabel}</strong> ({maxWeek.count} tap)
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>

                              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "#C4B5FD" }}>
                                <span>👆</span>
                                <span>Klik batang minggu untuk bedah 7 hari &amp; cafe</span>
                              </div>
                            </div>

                            {/* Filter Periode & Ringkasan Minggu Puncak per Periode (Sesuai Foto 1) */}
                            <div className="hour-period-grid">
                              {/* Card 1: 8 Minggu Terakhir */}
                              <button
                                type="button"
                                onClick={() => { setWeeklyPeriodType("8w"); setWeekPageOffset(0); setSelectedWeekKey(null); }}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                  padding: "10px 14px",
                                  borderRadius: 10,
                                  background: (weeklyPeriodType === "8w" && weekPageOffset === 0) ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                  border: (weeklyPeriodType === "8w" && weekPageOffset === 0) ? "1.5px solid #8B5CF6" : "1px solid rgba(255, 255, 255, 0.08)",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "all 0.15s ease",
                                  boxShadow: (weeklyPeriodType === "8w" && weekPageOffset === 0) ? "0 0 14px rgba(139,92,246,0.25)" : "none",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
                                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: (weeklyPeriodType === "8w" && weekPageOffset === 0) ? "#C4B5FD" : "#E2E8F0" }}>
                                    🌟 8 Minggu Terakhir
                                  </span>
                                  <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: (weeklyPeriodType === "8w" && weekPageOffset === 0) ? "#8B5CF6" : "rgba(255,255,255,0.08)", color: "#FFF" }}>
                                    {eightWeeksCount} tap
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.72rem", marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, lineHeight: 1.3 }}>
                                  <span style={{ color: (weeklyPeriodType === "8w" && weekPageOffset === 0) ? "#CBD5E1" : "var(--text-muted)", fontSize: "0.68rem" }}>Rentang:</span>
                                  <strong style={{ color: "#34D399", fontSize: "0.72rem" }}>8 pekan berjalan</strong>
                                </div>
                              </button>

                              {/* Card 2: 12 Minggu Terakhir */}
                              <button
                                type="button"
                                onClick={() => { setWeeklyPeriodType("12w"); setWeekPageOffset(0); setSelectedWeekKey(null); }}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                  padding: "10px 14px",
                                  borderRadius: 10,
                                  background: (weeklyPeriodType === "12w" && weekPageOffset === 0) ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                  border: (weeklyPeriodType === "12w" && weekPageOffset === 0) ? "1.5px solid #8B5CF6" : "1px solid rgba(255, 255, 255, 0.08)",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "all 0.15s ease",
                                  boxShadow: (weeklyPeriodType === "12w" && weekPageOffset === 0) ? "0 0 14px rgba(139,92,246,0.25)" : "none",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
                                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: (weeklyPeriodType === "12w" && weekPageOffset === 0) ? "#C4B5FD" : "#E2E8F0" }}>
                                    📊 12 Minggu (3 Bulan)
                                  </span>
                                  <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: (weeklyPeriodType === "12w" && weekPageOffset === 0) ? "#8B5CF6" : "rgba(255,255,255,0.08)", color: "#FFF" }}>
                                    {twelveWeeksCount} tap
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.72rem", marginTop: 5, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, lineHeight: 1.3 }}>
                                  <span style={{ color: (weeklyPeriodType === "12w" && weekPageOffset === 0) ? "#CBD5E1" : "var(--text-muted)", fontSize: "0.68rem" }}>Rentang:</span>
                                  <strong style={{ color: "#34D399", fontSize: "0.72rem" }}>Kuartal 3 bulan terakhir</strong>
                                </div>
                              </button>

                              {/* Card 3: Sepanjang Tahun */}
                              <button
                                type="button"
                                onClick={() => { setWeeklyPeriodType("year"); setSelectedWeeklyYear(new Date().getFullYear()); setSelectedWeekKey(null); }}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                  padding: "10px 14px",
                                  borderRadius: 10,
                                  background: weeklyPeriodType === "year" ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                  border: weeklyPeriodType === "year" ? "1.5px solid #8B5CF6" : "1px solid rgba(255, 255, 255, 0.08)",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "all 0.15s ease",
                                  boxShadow: weeklyPeriodType === "year" ? "0 0 14px rgba(139,92,246,0.25)" : "none",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
                                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: weeklyPeriodType === "year" ? "#C4B5FD" : "#E2E8F0" }}>
                                    🗓️ Tahun {selectedWeeklyYear}
                                  </span>
                                  <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: weeklyPeriodType === "year" ? "#8B5CF6" : "rgba(255,255,255,0.08)", color: "#FFF" }}>
                                    {yearWeeksCount} tap
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.72rem", marginTop: 5, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                                  <span style={{ color: weeklyPeriodType === "year" ? "#CBD5E1" : "var(--text-muted)" }}>Arsip:</span>
                                  <strong style={{ color: "#34D399" }}>Semua minggu {selectedWeeklyYear}</strong>
                                </div>
                              </button>

                              {/* Card 4: Arsip Bulan & Navigasi */}
                              <div
                                className="archive-month-card"
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                  justifyContent: "space-between",
                                  padding: "10px 14px",
                                  borderRadius: 10,
                                  background: isWeeklyMonthMode || weekPageOffset > 0 ? "rgba(139, 92, 246, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                  border: isWeeklyMonthMode || weekPageOffset > 0 ? "1.5px solid #8B5CF6" : "1px solid rgba(255, 255, 255, 0.08)",
                                  gap: 8,
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
                                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#C4B5FD", display: "flex", alignItems: "center", gap: 5 }}>
                                    <span>🗂️</span>
                                    <span>Arsip Bulan &amp; Geser</span>
                                  </span>
                                  {isWeeklyMonthMode ? (
                                    currentWeeklyMonthIdx === 0 ? (
                                      <span style={{ fontSize: "0.66rem", fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(245, 158, 11, 0.2)", color: "#FDE047", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
                                        Bulan Berjalan
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: "0.66rem", fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(139, 92, 246, 0.3)", color: "#EDE9FE", border: "1px solid rgba(139, 92, 246, 0.5)" }}>
                                        Arsip Historis
                                      </span>
                                    )
                                  ) : weekPageOffset > 0 ? (
                                    <span style={{ fontSize: "0.66rem", fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#F59E0B", color: "#000" }}>
                                      Halaman -{weekPageOffset}
                                    </span>
                                  ) : null}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", flexWrap: "wrap" }}>
                                  <CustomMonthDropdown
                                    value={isWeeklyMonthMode ? (selectedWeeklyMonth || thisMonthKey) : ""}
                                    onChange={(val) => {
                                      setSelectedWeekKey(null);
                                      setWeekPageOffset(0);
                                      setWeeklyPeriodType("month");
                                      setSelectedWeeklyMonth(val);
                                    }}
                                    options={allFlatMonths.map((m) => ({
                                      key: m.monthKey,
                                      label: m.label,
                                      isCurrent: m.monthKey === thisMonthKey,
                                      total: m.total,
                                    }))}
                                    placeholder="Pilih Bulan..."
                                  />

                                  <div style={{ display: "inline-flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                                    {isWeeklyMonthMode ? (
                                      <>
                                        {/* Tombol Geser Bulan Sebelumnya (Ke Masa Lalu) */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (canGoPrevMonth) {
                                              const prevM = allFlatMonths[currentWeeklyMonthIdx + 1];
                                              if (prevM) {
                                                setSelectedWeeklyMonth(prevM.monthKey);
                                                setSelectedWeekKey(null);
                                              }
                                            }
                                          }}
                                          disabled={!canGoPrevMonth}
                                          style={{
                                            background: !canGoPrevMonth ? "rgba(255,255,255,0.03)" : "rgba(139,92,246,0.18)",
                                            border: !canGoPrevMonth ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(139,92,246,0.45)",
                                            color: !canGoPrevMonth ? "var(--text-muted)" : "#EDE9FE",
                                            padding: "5px 8px",
                                            borderRadius: 7,
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            cursor: !canGoPrevMonth ? "not-allowed" : "pointer",
                                            opacity: !canGoPrevMonth ? 0.35 : 1,
                                            whiteSpace: "nowrap",
                                            transition: "all 0.15s ease",
                                          }}
                                          title={
                                            canGoPrevMonth
                                              ? `Geser ke bulan sebelumnya (${allFlatMonths[currentWeeklyMonthIdx + 1]?.label})`
                                              : "Sudah di arsip bulan paling awal"
                                          }
                                        >
                                          ◄ Lalu
                                        </button>

                                        {/* Tombol Geser Bulan Berikutnya (Ke Masa Depan) */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (canGoNextMonth) {
                                              const nextM = allFlatMonths[currentWeeklyMonthIdx - 1];
                                              if (nextM) {
                                                setSelectedWeeklyMonth(nextM.monthKey);
                                                setSelectedWeekKey(null);
                                              }
                                            }
                                          }}
                                          disabled={!canGoNextMonth}
                                          style={{
                                            background: !canGoNextMonth ? "rgba(255,255,255,0.03)" : "rgba(139,92,246,0.18)",
                                            border: !canGoNextMonth ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(139,92,246,0.45)",
                                            color: !canGoNextMonth ? "var(--text-muted)" : "#EDE9FE",
                                            padding: "5px 8px",
                                            borderRadius: 7,
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            cursor: !canGoNextMonth ? "not-allowed" : "pointer",
                                            opacity: !canGoNextMonth ? 0.35 : 1,
                                            whiteSpace: "nowrap",
                                            transition: "all 0.15s ease",
                                          }}
                                          title={
                                            canGoNextMonth
                                              ? `Geser ke bulan berikutnya (${allFlatMonths[currentWeeklyMonthIdx - 1]?.label})`
                                              : `Sudah di bulan terbaru (${allFlatMonths[0]?.label})`
                                          }
                                        >
                                          Maju ►
                                        </button>

                                        {/* Tombol Cepat Kembali ke Bulan Ini (jika sedang melihat bulan arsip masa lalu) */}
                                        {isViewingPastWeeklyMonth && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedWeeklyMonth(thisMonthKey);
                                              setSelectedWeekKey(null);
                                            }}
                                            style={{
                                              background: "rgba(245, 158, 11, 0.18)",
                                              border: "1px solid rgba(245, 158, 11, 0.45)",
                                              color: "#FDE047",
                                              padding: "5px 8px",
                                              borderRadius: 7,
                                              fontSize: "0.7rem",
                                              fontWeight: 700,
                                              cursor: "pointer",
                                              whiteSpace: "nowrap",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4,
                                              boxShadow: "0 0 10px rgba(245, 158, 11, 0.25)",
                                              transition: "all 0.15s ease",
                                            }}
                                            title={`Kembali langsung ke bulan berjalan (${formatMonthLabel(thisMonthKey)})`}
                                          >
                                            <span>🌟</span>
                                            <span>Bulan Ini</span>
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        {/* Mode Preset Mingguan: Paginasi Offset Minggu */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (canGoPreviousWeeks) {
                                              setWeekPageOffset(o => o + 1);
                                            }
                                          }}
                                          disabled={!canGoPreviousWeeks}
                                          style={{
                                            background: !canGoPreviousWeeks ? "rgba(255,255,255,0.03)" : "rgba(139,92,246,0.18)",
                                            border: !canGoPreviousWeeks ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(139,92,246,0.45)",
                                            color: !canGoPreviousWeeks ? "var(--text-muted)" : "#EDE9FE",
                                            padding: "5px 8px",
                                            borderRadius: 7,
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            cursor: !canGoPreviousWeeks ? "not-allowed" : "pointer",
                                            opacity: !canGoPreviousWeeks ? 0.35 : 1,
                                            whiteSpace: "nowrap",
                                            transition: "all 0.15s ease",
                                          }}
                                          title={
                                            !canGoPreviousWeeks
                                              ? earliestAssignedDate
                                                ? `Batas awal penugasan kartu tercapai (${formatDateShortIndo(earliestAssignedDate)})`
                                                : "Tidak ada riwayat sebelum ini"
                                              : "Lihat minggu-minggu sebelumnya di masa lalu"
                                          }
                                        >
                                          ◄ Lalu
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setWeekPageOffset(o => Math.max(0, o - 1))}
                                          disabled={weekPageOffset === 0}
                                          style={{
                                            background: weekPageOffset === 0 ? "rgba(255,255,255,0.03)" : "rgba(139,92,246,0.18)",
                                            border: weekPageOffset === 0 ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(139,92,246,0.45)",
                                            color: weekPageOffset === 0 ? "var(--text-muted)" : "#EDE9FE",
                                            padding: "5px 8px",
                                            borderRadius: 7,
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            cursor: weekPageOffset === 0 ? "not-allowed" : "pointer",
                                            opacity: weekPageOffset === 0 ? 0.35 : 1,
                                            whiteSpace: "nowrap",
                                            transition: "all 0.15s ease",
                                          }}
                                          title={weekPageOffset === 0 ? "Sudah berada di minggu terbaru" : "Lihat minggu-minggu berikutnya"}
                                        >
                                          Maju ►
                                        </button>

                                        {weekPageOffset > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => setWeekPageOffset(0)}
                                            style={{
                                              background: "rgba(245, 158, 11, 0.18)",
                                              border: "1px solid rgba(245, 158, 11, 0.45)",
                                              color: "#FDE047",
                                              padding: "5px 8px",
                                              borderRadius: 7,
                                              fontSize: "0.7rem",
                                              fontWeight: 700,
                                              cursor: "pointer",
                                              whiteSpace: "nowrap",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4,
                                            }}
                                            title="Kembali ke minggu berjalan"
                                          >
                                            <span>🌟</span>
                                            <span>Terkini</span>
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
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

                            {/* Breakdown Cafe Periode Mingguan — sembunyikan jika hanya 1 outlet difilter */}
                            {!isSingleOutletFilter && (
                              <CafeBreakdownCard
                                title={`Peringkat Cafe Teraktif (${weeklyPeriodLabel})`}
                                subtitle={`Akumulasi kontribusi tap per cafe selama ${weeklyPeriodLabel}.`}
                                logs={eightWeeksLogs}
                                cardUrlMap={cardUrlMap}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

          {/* ═════════ TAB 4: KARTU TIDUR ═════════ */}
          {activeTab === "tidur" && (
            loading ? (
              <TapsTabSkeleton text="Memeriksa kartu tidur..." />
            ) : (
              <div>
                {sleepingCards.length === 0 ? (
                  <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎉</div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#34D399", marginBottom: 6 }}>
                      {sleepingPeriod === "today"
                        ? "Semua Kartu Sudah Tap Hari Ini!"
                        : sleepingPeriod === "last7"
                        ? "Semua Kartu Aktif dalam 7 Hari Terakhir!"
                        : "Semua Kartu Aktif dalam 1 Bulan Terakhir!"}
                    </h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      {sleepingPeriod === "today"
                        ? "Semua kartu sudah mendapatkan tap hari ini. Performa luar biasa! 🚀"
                        : sleepingPeriod === "last7"
                        ? "Semua kartu aktif dalam 7 hari terakhir. Terus pertahankan! 🔥"
                        : "Tidak ada kartu yang diam selama sebulan penuh. Semua toko binaan aktif menggunakan kartu review!"}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {sleepingCards.map((card) => {
                      // Cari tap terakhir kartu ini (all-time)
                      const lastTapEntry = validLogs.find(l => l.code === card.code);
                      return (
                        <div
                          key={card.code}
                          className="card toko-tidur-card"
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "14px 16px",
                            borderLeft: "4px solid #EF4444",
                            gap: 12,
                            background: "rgba(239,68,68,0.03)",
                          }}
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
                                {card.createdAt && (
                                  <>
                                    <span>·</span>
                                    <span style={{ color: "#94A3B8" }}>
                                      Dibuat: {timeAgo(card.createdAt)}
                                    </span>
                                  </>
                                )}
                                {lastTapEntry ? (
                                  <>
                                    <span>·</span>
                                    <span style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                      background: "rgba(245, 158, 11, 0.14)",
                                      border: "1px solid rgba(245, 158, 11, 0.35)",
                                      color: "#FDE047",
                                      fontWeight: 700,
                                      fontSize: "0.76rem",
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                    }}>
                                      <span>🕒</span>
                                      <span>Last tap: {timeAgo(lastTapEntry.tappedAt)}</span>
                                    </span>
                                    <span style={{ color: "#CBD5E1", fontSize: "0.74rem", fontWeight: 500 }}>
                                      ({formatTapDateTime(lastTapEntry.tappedAt)})
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span>·</span>
                                    <span style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      background: "rgba(239, 68, 68, 0.12)",
                                      border: "1px solid rgba(239, 68, 68, 0.3)",
                                      color: "#FCA5A5",
                                      fontWeight: 700,
                                      fontSize: "0.75rem",
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                    }}>
                                      <span>⚠️</span> Belum pernah di-tap
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
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

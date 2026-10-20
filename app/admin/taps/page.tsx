"use client";

import { useEffect, useState, useMemo } from "react";

type TapLogEntry = {
  code: string;
  storeName: string;
  tappedAt: string;
};

type MonthGroup = {
  monthKey: string; // "2026-10"
  label: string;    // "Oktober 2026"
  total: number;
  byStore: { storeName: string; count: number }[];
};

export default function TapsPage() {
  const [logs, setLogs] = useState<TapLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"harian" | "bulanan">("harian");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/taps?limit=200");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLogs(); }, []);

  // Auto-expand bulan ini saat tab bulanan aktif
  useEffect(() => {
    if (activeTab === "bulanan" && logs.length > 0) {
      const thisMonth = getMonthKey(new Date().toISOString());
      setExpandedMonth(thisMonth);
    }
  }, [activeTab, logs]);

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
    if (days < 7) return `${days} hari lalu`;
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  function formatFull(iso: string) {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "long", day: "numeric", month: "long",
      year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  function formatDayHeader(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Hari Ini";
    if (d.toDateString() === yesterday.toDateString()) return "Kemarin";
    return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  // ── Filter (harian) ─────────────────────────────────────────────────
  const filtered = useMemo(() =>
    logs.filter(l => l.storeName.toLowerCase().includes(search.toLowerCase())),
    [logs, search]
  );

  // ── Group by day (harian) ──────────────────────────────────────────
  type DayGroup = { dayKey: string; label: string; entries: TapLogEntry[] };
  const grouped = useMemo(() => {
    const groups: DayGroup[] = [];
    for (const entry of filtered) {
      const dayKey = new Date(entry.tappedAt).toDateString();
      const last = groups[groups.length - 1];
      if (!last || last.dayKey !== dayKey) {
        groups.push({ dayKey, label: formatDayHeader(entry.tappedAt), entries: [entry] });
      } else {
        last.entries.push(entry);
      }
    }
    return groups;
  }, [filtered]);

  // ── Group by month (bulanan) ────────────────────────────────────────
  const monthlyGroups = useMemo((): MonthGroup[] => {
    const map = new Map<string, Map<string, number>>();
    for (const entry of logs) {
      const mk = getMonthKey(entry.tappedAt);
      if (!map.has(mk)) map.set(mk, new Map());
      const storeMap = map.get(mk)!;
      storeMap.set(entry.storeName, (storeMap.get(entry.storeName) ?? 0) + 1);
    }
    // Sort months descending
    const sorted = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    return sorted.map(([monthKey, storeMap]) => {
      const byStore = Array.from(storeMap.entries())
        .map(([storeName, count]) => ({ storeName, count }))
        .sort((a, b) => b.count - a.count);
      const total = byStore.reduce((s, x) => s + x.count, 0);
      return { monthKey, label: formatMonthLabel(monthKey), total, byStore };
    });
  }, [logs]);

  // Filtered per-bulan (search)
  const filteredMonthly = useMemo(() =>
    monthlyGroups.map(mg => ({
      ...mg,
      byStore: mg.byStore.filter(s => s.storeName.toLowerCase().includes(search.toLowerCase())),
      total: mg.byStore
        .filter(s => s.storeName.toLowerCase().includes(search.toLowerCase()))
        .reduce((s, x) => s + x.count, 0),
    })).filter(mg => mg.byStore.length > 0),
    [monthlyGroups, search]
  );

  // Stats
  const uniqueStores = new Set(logs.map(l => l.storeName)).size;
  const todayCount = logs.filter(l => new Date(l.tappedAt).toDateString() === new Date().toDateString()).length;
  const thisMonthCount = logs.filter(l => getMonthKey(l.tappedAt) === getMonthKey(new Date().toISOString())).length;

  // Max tap per store for bar chart width
  const maxBarCount = (mg: MonthGroup) => Math.max(...mg.byStore.map(s => s.count), 1);

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0A0A0F; color: #F0F0FF; font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    .pw { max-width: 860px; margin: 0 auto; padding: 24px 16px 80px; }
    .topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
    .topbar h1 { font-size: 1.4rem; font-weight: 800; }
    .topbar p { color: #9A9AB0; font-size: 0.82rem; margin-top: 4px; }
    .back { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); border-radius: 8px; color: #C0C0D8; text-decoration: none; font-size: 0.82rem; font-weight: 500; transition: all 0.2s; white-space: nowrap; }
    .back:hover { background: rgba(255,255,255,0.09); color: #F0F0FF; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
    .sc { background: #111118; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 16px; }
    .sv { font-size: 1.4rem; font-weight: 800; margin-bottom: 2px; }
    .sl { font-size: 0.68rem; color: #5A5A72; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 12px; }
    .tab { padding: 8px 18px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; background: transparent; color: #9A9AB0; border: 1px solid transparent; transition: all 0.2s; font-family: inherit; }
    .tab.act { background: rgba(245,158,11,0.12); color: #FCD34D; border-color: rgba(245,158,11,0.3); }
    .tab:hover:not(.act) { color: #F0F0FF; background: rgba(255,255,255,0.05); }
    .toolbar { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; align-items: center; }
    .sbx { flex: 1; min-width: 200px; padding: 10px 13px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #F0F0FF; font-size: .875rem; outline: none; font-family: inherit; transition: border-color .2s; }
    .sbx:focus { border-color: rgba(245,158,11,.5); }
    .refresh-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px; color: #FCD34D; font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
    .refresh-btn:hover { background: rgba(245,158,11,0.18); }
    .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .last-refresh { font-size: 0.72rem; color: #5A5A72; white-space: nowrap; }
    .day-header { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #5A5A72; padding: 16px 0 8px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; }
    .day-group { margin-bottom: 8px; }
    .tap-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #111118; border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid #F59E0B; border-radius: 0 10px 10px 0; margin-bottom: 6px; transition: border-color 0.2s; }
    .tap-item:hover { border-color: rgba(245,158,11,0.4); }
    .tap-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
    .tap-info { flex: 1; min-width: 0; }
    .tap-store { font-size: 0.95rem; font-weight: 700; color: #F0F0FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tap-time { font-size: 0.75rem; color: #6A6A82; margin-top: 3px; }
    .tap-badge { font-size: 0.72rem; color: #FCD34D; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); padding: 4px 10px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
    /* Monthly */
    .month-card { background: #111118; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; margin-bottom: 12px; overflow: hidden; transition: border-color 0.2s; }
    .month-card:hover { border-color: rgba(245,158,11,0.2); }
    .month-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; cursor: pointer; gap: 12px; }
    .month-title { font-size: 1rem; font-weight: 700; color: #F0F0FF; }
    .month-meta { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .month-total { font-size: 1.1rem; font-weight: 800; color: #FCD34D; }
    .month-sub { font-size: 0.72rem; color: #5A5A72; }
    .chevron { font-size: 0.8rem; color: #5A5A72; transition: transform 0.2s; }
    .chevron.open { transform: rotate(180deg); }
    .month-body { padding: 0 20px 16px; border-top: 1px solid rgba(255,255,255,0.05); }
    .store-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .store-row:last-child { border-bottom: none; }
    .store-rank { font-size: 0.72rem; font-weight: 700; color: #5A5A72; width: 20px; text-align: center; flex-shrink: 0; }
    .store-name { flex: 1; font-size: 0.9rem; font-weight: 600; color: #E0E0F0; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .store-bar-wrap { width: 120px; flex-shrink: 0; }
    .store-bar-bg { background: rgba(255,255,255,0.05); border-radius: 999px; height: 6px; overflow: hidden; }
    .store-bar-fill { background: linear-gradient(90deg, #F59E0B, #FCD34D); border-radius: 999px; height: 6px; transition: width 0.4s ease; }
    .store-count { font-size: 0.82rem; font-weight: 700; color: #FCD34D; width: 36px; text-align: right; flex-shrink: 0; }
    .empty { text-align: center; padding: 60px 20px; color: #5A5A72; }
    .empty-icon { font-size: 3rem; margin-bottom: 16px; }
    @media (max-width: 600px) { .stats { grid-template-columns: repeat(3, 1fr); } .sv { font-size: 1.1rem; } .store-bar-wrap { width: 70px; } }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ background: "#0A0A0F", minHeight: "100vh" }}>
        <div className="pw">

          {/* Header */}
          <div className="topbar">
            <div>
              <h1>📲 Riwayat Tap</h1>
              <p>Pantau aktivitas tap kartu NFC/QR — harian maupun bulanan.</p>
            </div>
            <a href="/admin" className="back">← Dashboard</a>
          </div>

          {/* Stats */}
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
              <div className="sv" style={{ color: "#A5B4FC" }}>{uniqueStores}</div>
              <div className="sl">🏪 Cafe Aktif</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${activeTab === "harian" ? "act" : ""}`} onClick={() => setActiveTab("harian")}>
              📋 Riwayat Harian
            </button>
            <button className={`tab ${activeTab === "bulanan" ? "act" : ""}`} onClick={() => setActiveTab("bulanan")}>
              📊 Per Bulan
            </button>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <input
              type="text"
              className="sbx"
              placeholder="🔍 Cari nama cafe..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="last-refresh">
              Diperbarui {lastRefresh.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button className="refresh-btn" onClick={fetchLogs} disabled={loading}>
              {loading ? "⏳ Memuat..." : "🔄 Refresh"}
            </button>
          </div>

          {/* ── TAB: HARIAN ── */}
          {activeTab === "harian" && (
            <>
              {loading ? (
                <div className="empty"><div className="empty-icon">⏳</div><p>Memuat riwayat tap...</p></div>
              ) : filtered.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">{search ? "🔍" : "📲"}</div>
                  <p style={{ fontWeight: 600, color: "#9A9AB0", marginBottom: 8 }}>
                    {search ? "Tidak ada hasil." : "Belum ada tap tercatat."}
                  </p>
                  <p style={{ fontSize: "0.82rem" }}>
                    {search ? "Coba kata kunci lain." : "Tap pada kartu NFC/QR akan muncul di sini."}
                  </p>
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
                  <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#5A5A72", marginTop: 24 }}>
                    Menampilkan {filtered.length} dari {logs.length} tap tersimpan (maks 200)
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── TAB: BULANAN ── */}
          {activeTab === "bulanan" && (
            <>
              {loading ? (
                <div className="empty"><div className="empty-icon">⏳</div><p>Memuat data bulanan...</p></div>
              ) : filteredMonthly.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">{search ? "🔍" : "📊"}</div>
                  <p style={{ fontWeight: 600, color: "#9A9AB0", marginBottom: 8 }}>
                    {search ? "Tidak ada hasil." : "Belum ada data tap."}
                  </p>
                </div>
              ) : (
                <div>
                  {filteredMonthly.map((mg) => {
                    const isOpen = expandedMonth === mg.monthKey;
                    const max = maxBarCount(mg);
                    const isThisMonth = mg.monthKey === getMonthKey(new Date().toISOString());
                    return (
                      <div key={mg.monthKey} className="month-card" style={isThisMonth ? { borderColor: "rgba(245,158,11,0.35)" } : {}}>
                        <div
                          className="month-header"
                          onClick={() => setExpandedMonth(isOpen ? null : mg.monthKey)}
                        >
                          <div>
                            <div className="month-title">
                              {isThisMonth && <span style={{ fontSize: "0.7rem", background: "rgba(245,158,11,0.15)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 999, padding: "2px 8px", marginRight: 8, fontWeight: 600 }}>Bulan Ini</span>}
                              {mg.label}
                            </div>
                            <div className="month-sub">{mg.byStore.length} cafe · {mg.total} tap total</div>
                          </div>
                          <div className="month-meta">
                            <div className="month-total">{mg.total}×</div>
                            <div className={`chevron ${isOpen ? "open" : ""}`}>▼</div>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="month-body">
                            <div style={{ paddingTop: 12 }}>
                              {mg.byStore.map((s, idx) => (
                                <div key={s.storeName} className="store-row">
                                  <div className="store-rank">#{idx + 1}</div>
                                  <div className="store-name">{s.storeName}</div>
                                  <div className="store-bar-wrap">
                                    <div className="store-bar-bg">
                                      <div
                                        className="store-bar-fill"
                                        style={{ width: `${(s.count / max) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className="store-count">{s.count}×</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#5A5A72", marginTop: 24 }}>
                    Data dari {logs.length} tap tersimpan · {filteredMonthly.length} bulan
                  </p>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}

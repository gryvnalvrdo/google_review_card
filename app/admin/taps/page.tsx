"use client";

import { useEffect, useState, useMemo } from "react";

type TapLogEntry = {
  code: string;
  storeName: string;
  tappedAt: string;
};

export default function TapsPage() {
  const [logs, setLogs] = useState<TapLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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

  const filtered = useMemo(() =>
    logs.filter(l => l.storeName.toLowerCase().includes(search.toLowerCase())),
    [logs, search]
  );

  // Group by day
  type Group = { dayKey: string; label: string; entries: TapLogEntry[] };
  const grouped = useMemo(() => {
    const groups: Group[] = [];
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

  // Stats
  const uniqueStores = new Set(logs.map(l => l.storeName)).size;
  const todayCount = logs.filter(l => new Date(l.tappedAt).toDateString() === new Date().toDateString()).length;

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
    .toolbar { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; align-items: center; }
    .sbx { flex: 1; min-width: 200px; padding: 10px 13px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #F0F0FF; font-size: .875rem; outline: none; font-family: inherit; transition: border-color .2s; }
    .sbx:focus { border-color: rgba(245,158,11,.5); }
    .refresh-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); border-radius: 8px; color: #FCD34D; font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
    .refresh-btn:hover { background: rgba(245,158,11,0.18); }
    .day-header { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #5A5A72; padding: 16px 0 8px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; }
    .day-group { margin-bottom: 8px; }
    .tap-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #111118; border: 1px solid rgba(255,255,255,0.06); border-left: 3px solid #F59E0B; border-radius: 0 10px 10px 0; margin-bottom: 6px; transition: border-color 0.2s; }
    .tap-item:hover { border-color: rgba(245,158,11,0.4); border-left-color: #F59E0B; }
    .tap-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
    .tap-info { flex: 1; min-width: 0; }
    .tap-store { font-size: 0.95rem; font-weight: 700; color: #F0F0FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tap-time { font-size: 0.75rem; color: #6A6A82; margin-top: 3px; }
    .tap-badge { font-size: 0.72rem; color: #FCD34D; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); padding: 4px 10px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
    .empty { text-align: center; padding: 60px 20px; color: #5A5A72; }
    .empty-icon { font-size: 3rem; margin-bottom: 16px; }
    .last-refresh { font-size: 0.72rem; color: #5A5A72; white-space: nowrap; }
    @media (max-width: 600px) { .stats { grid-template-columns: repeat(3, 1fr); } .sv { font-size: 1.1rem; } }
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
              <p>Semua aktivitas tap kartu NFC/QR oleh pelanggan, terbaru di atas.</p>
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
              <div className="sv" style={{ color: "#34D399" }}>{todayCount}</div>
              <div className="sl">☀️ Tap Hari Ini</div>
            </div>
            <div className="sc">
              <div className="sv" style={{ color: "#A5B4FC" }}>{uniqueStores}</div>
              <div className="sl">🏪 Cafe Aktif</div>
            </div>
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

          {/* Log List */}
          {loading ? (
            <div className="empty">
              <div className="empty-icon">⏳</div>
              <p>Memuat riwayat tap...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">{search ? "🔍" : "📲"}</div>
              <p style={{ fontWeight: 600, color: "#9A9AB0", marginBottom: 8 }}>
                {search ? "Tidak ada hasil untuk pencarian ini." : "Belum ada tap tercatat."}
              </p>
              <p style={{ fontSize: "0.82rem" }}>
                {search ? "Coba kata kunci lain." : "Tap pada kartu NFC/QR akan muncul di sini secara otomatis."}
              </p>
            </div>
          ) : (
            <div>
              {grouped.map((group) => (
                <div key={group.dayKey} className="day-group">
                  <div className="day-header">
                    {group.label} · {group.entries.length} tap
                  </div>
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

              {filtered.length > 0 && (
                <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#5A5A72", marginTop: 24 }}>
                  Menampilkan {filtered.length} dari {logs.length} tap tersimpan (maks 200)
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

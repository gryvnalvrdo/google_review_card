"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import AdminNav from "./components/AdminNav";
import QRScanner from "./components/QRScanner";
import { PriceStepperInput } from "./components/PriceStepperInput";
import { getPublicGoogleReviewUrl } from "../../lib/redirect";

type CardRecord = {
  code: string;
  storeName: string;
  googleReviewUrl: string;
  createdAt: string;
  updatedAt?: string;
  tapCount?: number;
  price?: number;
};

type TapLogEntry = {
  code: string;
  storeName: string;
  tappedAt: string;
};

function TrashIcon({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export default function AdminDashboard() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [code, setCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [price, setPrice] = useState<number>(50000);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [savedCardUrl, setSavedCardUrl] = useState<string | null>(null);
  const [copiedNfc, setCopiedNfc] = useState(false);
  const [tapLogs, setTapLogs] = useState<TapLogEntry[]>([]);
  const [lastVisitedAt, setLastVisitedAt] = useState<string | null>(null);
  const [newTapCount, setNewTapCount] = useState(0);
  const [showScanner, setShowScanner] = useState(false);

  const activeCardMap = useMemo(() => new Map(cards.map(c => [c.code, c.storeName])), [cards]);
  const activeCodesSet = useMemo(() => new Set(cards.map(c => c.code)), [cards]);
  const cardUrlMap = useMemo(() => new Map(cards.map(c => [c.code, getPublicGoogleReviewUrl(c.googleReviewUrl || "", c.storeName)])), [cards]);

  const validTapLogs = useMemo(() => {
    if (cards.length === 0) return tapLogs;
    return tapLogs
      .filter(l => activeCodesSet.has(l.code))
      .map(l => ({
        ...l,
        storeName: activeCardMap.get(l.code) || l.storeName,
      }));
  }, [tapLogs, cards, activeCodesSet, activeCardMap]);

  const unseenTapCount = useMemo(() => {
    if (!lastVisitedAt) return 0;
    const prevDate = new Date(lastVisitedAt);
    if (isNaN(prevDate.getTime())) return 0;
    return validTapLogs.filter(l => new Date(l.tappedAt).getTime() > prevDate.getTime()).length;
  }, [validTapLogs, lastVisitedAt]);

  const LS_KEY = "admin_dashboard_last_visited";

  async function loadCards() {
    try {
      const resCodes = await fetch(`/api/admin/codes?_t=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } });
      if (resCodes.ok) {
        const data = await resCodes.json();
        setCards(data.cards ?? []);
      }
    } catch (e) {
      console.error("Gagal load cards:", e);
    }
  }

  const loadTapLogs = useCallback(async () => {
    // Sinkronisasi dengan halaman Riwayat Tap (/admin/taps)
    const prevVisit = localStorage.getItem("admin_taps_last_seen") || localStorage.getItem(LS_KEY);
    setLastVisitedAt(prevVisit);

    try {
      const res = await fetch(`/api/admin/taps?limit=50&_t=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } });
      if (res.ok) {
        const data = await res.json();
        const all: TapLogEntry[] = data.logs ?? [];

        // Selalu simpan riwayat tap riil terbaru (sama persis dengan di Riwayat Tap)
        setTapLogs(all);

        // Hitung notifikasi tap baru yang belum pernah dilihat di riwayat
        const prevDate = prevVisit ? new Date(prevVisit) : null;
        const isValidPrevDate = prevDate && !isNaN(prevDate.getTime());
        const unseen = isValidPrevDate
          ? all.filter(l => new Date(l.tappedAt).getTime() > prevDate.getTime())
          : [];

        setNewTapCount(unseen.length);
      }
    } catch (e) {
      console.error("Gagal load tap logs:", e);
    }
  }, []);

  useEffect(() => {
    loadCards();
    loadTapLogs();

    // Auto-refresh otomatis saat admin kembali ke tab dashboard dari riwayat tap
    function handleSync() {
      loadCards();
      loadTapLogs();
    }

    window.addEventListener("focus", handleSync);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleSync();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "admin_taps_last_seen" || e.key === LS_KEY) {
        loadTapLogs();
      }
    };
    window.addEventListener("storage", handleStorage);

    // Auto-refresh background tiap 20 detik
    const interval = setInterval(() => {
      loadCards();
      loadTapLogs();
    }, 20000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadTapLogs]);

  // Handle URL query ?code=... to immediately prefill form and open sheet/modal!
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryCode = params.get("code");
      if (queryCode) {
        openNewForm(queryCode.trim());
      }
    }
  }, []);

  // Lock body scroll when sheet open
  useEffect(() => {
    document.body.style.overflow = showSheet ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showSheet]);

  function resetForm() {
    setCode(""); setStoreName(""); setGoogleReviewUrl(""); setPlaceId(""); setPrice(50000);
    setMessage(null); setError(null); setIsEditing(false);
    setSavedCardUrl(null); setCopiedNfc(false);
  }

  function openNewForm(initialCode = "") {
    resetForm();
    if (initialCode) setCode(initialCode);
    setShowSheet(true);
  }

  function openEditForm(card: CardRecord) {
    setCode(card.code);
    setStoreName(card.storeName);
    setGoogleReviewUrl(card.googleReviewUrl || "");
    const match = (card.googleReviewUrl || "").match(/placeid=([^&]+)/);
    setPlaceId(match ? match[1] : "");
    setPrice(card.price ?? 50000);
    setMessage(null); setError(null);
    setIsEditing(true);
    setShowSheet(true);
  }

  function closeSheet() {
    setShowSheet(false);
    setTimeout(resetForm, 350);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null); setError(null); setLoading(true);
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        storeName: storeName.trim(),
        googleReviewUrl: googleReviewUrl.trim(),
        price: price,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      const cardUrl = `${window.location.origin}/c/${code.trim()}`;
      setSavedCardUrl(cardUrl);
      setMessage(`✅ "${storeName.trim()}" berhasil ${isEditing ? "diupdate" : "disimpan"}!`);
      await loadCards();
    } else {
      setError(data?.error ?? "Gagal menyimpan. Cek kembali datanya.");
    }
  }

  async function handleDelete(cardCode: string) {
    const res = await fetch(`/api/admin/codes/${cardCode}`, { method: "DELETE" });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.code !== cardCode));
      // Refresh tap logs to ensure deleted card is instantly removed
      loadTapLogs();
    }
    setDeleteConfirm(null);
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
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
    const d = new Date(iso);
    const isPrevYear = d.getFullYear() !== new Date().getFullYear();
    return days < 7
      ? `${days} hari lalu`
      : d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          ...(isPrevYear ? { year: "numeric" } : {}),
        });
  }

  // Active cards and calculations
  const totalTaps = useMemo(() => cards.reduce((sum, c) => sum + (c.tapCount ?? 0), 0), [cards]);
  const totalRevenue = useMemo(() => cards.reduce((sum, c) => sum + (c.price ?? 50000), 0), [cards]);


  // ── Form content (shared between desktop sidebar & mobile sheet) ──
  const formContent = (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label className="label" htmlFor="card-code">Kode Kartu (NFC/QR)</label>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#A5B4FC",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: "0.72rem",
                cursor: "pointer",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              📷 Scan Kamera
            </button>
          )}
        </div>
        <input
          id="card-code"
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="cth: a8f3k2"
          maxLength={20}
          required
          autoCapitalize="none"
          autoCorrect="off"
          readOnly={isEditing}
          style={isEditing ? { opacity: 0.6, cursor: "not-allowed" } : {}}
        />
        {isEditing && (
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Kode kartu unik tidak dapat diubah saat mengedit.
          </p>
        )}
      </div>

      <div className="form-group">
        <label className="label" htmlFor="store-name">Nama Toko / Resto</label>
        <input
          id="store-name"
          className="input"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="cth: Cafe Kopi Senja"
          maxLength={100}
          required
        />
      </div>

      <div className="form-group">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label className="label" htmlFor="place-id">Google Place ID</label>
          <a
            href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "0.68rem", color: "#A5B4FC", textDecoration: "none", fontWeight: 600 }}
          >
            🔍 Cari Place ID ↗
          </a>
        </div>

        <input
          id="place-id"
          className="input"
          value={placeId}
          onChange={(e) => {
            let pid = e.target.value.trim();
            const match = pid.match(/placeid=([a-zA-Z0-9_\-]+)/i);
            if (match) pid = match[1];
            setPlaceId(pid);
            if (pid) {
              setGoogleReviewUrl(`https://search.google.com/local/writereview?placeid=${pid}`);
            } else {
              setGoogleReviewUrl("");
            }
          }}
          placeholder="cth: ChIJxxxxxxxxxxxxxxxxx"
          maxLength={120}
          required
          autoCapitalize="none"
          autoCorrect="off"
        />
        {googleReviewUrl && (
          <div style={{ fontSize: "0.72rem", color: "#34D399", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <span>✅</span> URL Review Google siap digunakan
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="label" htmlFor="price">Harga Jual (Rp)</label>
        <PriceStepperInput
          id="price"
          value={price}
          onChange={setPrice}
          placeholder="50000"
          step={5000}
          min={0}
        />
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
          Default: Rp 50.000 (step per klik: Rp 5.000). Dihitung ke Total Pendapatan.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {/* NFC URL Box upon save */}
      {savedCardUrl && (
        <div style={{
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.3)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#34D399", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span>📱 URL untuk Chip NFC (NFC Tools)</span>
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: "0.82rem",
            color: "#F0F0FF",
            wordBreak: "break-all",
            background: "rgba(0,0,0,0.4)",
            padding: "8px 10px",
            borderRadius: 6,
            marginBottom: 10,
            lineHeight: 1.5,
            userSelect: "all",
          }}>
            {savedCardUrl}
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(savedCardUrl).then(() => {
                setCopiedNfc(true);
                setTimeout(() => setCopiedNfc(false), 3000);
              });
            }}
            className="btn btn-primary"
            style={{
              width: "100%",
              justifyContent: "center",
              background: copiedNfc ? "#059669" : "#10B981",
              fontSize: "0.85rem",
              padding: "10px",
            }}
          >
            {copiedNfc ? "✅ URL Tersalin! Paste di NFC Tools" : "📋 Salin URL NFC"}
          </button>
          <button
            type="button"
            onClick={closeSheet}
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: "0.78rem" }}
          >
            Selesai, Tutup Form
          </button>
        </div>
      )}

      {!savedCardUrl && (
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "0.92rem", marginTop: 6 }}
        >
          {loading ? (
            <><div className="spinner" /> Menyimpan...</>
          ) : (
            isEditing ? "Update Perubahan →" : "Simpan & Hubungkan Kartu →"
          )}
        </button>
      )}
    </form>
  );

  return (
    <>
      <AdminNav active="dashboard" />

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={(scannedCode) => {
            openNewForm(scannedCode);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Mobile bottom sheet backdrop */}
      <div
        className={`sheet-backdrop ${showSheet ? "open" : ""}`}
        onClick={closeSheet}
      />

      {/* Mobile bottom sheet */}
      <div className={`sheet ${showSheet ? "open" : ""}`}>
        <div className="sheet-handle" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {isEditing ? "✏️ Edit Kartu Toko" : "➕ Hubungkan Kartu ke Toko"}
          </h2>
          <button onClick={closeSheet} className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: "0.78rem" }}>
            ✕ Tutup
          </button>
        </div>
        {formContent}
      </div>

      {/* Delete Card Confirmation Modal */}
      {deleteConfirm && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, backdropFilter: "blur(6px)" }}
            onClick={() => setDeleteConfirm(null)}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)", zIndex: 301,
            background: "#14141E", border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 18, padding: "28px 24px",
            width: "min(92vw, 380px)", textAlign: "center",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: 16,
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", color: "#F87171",
            }}>
              <TrashIcon size={26} color="#F87171" />
            </div>
            <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: 8, color: "#F0F0FF" }}>Hapus Kartu Ini?</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 22, lineHeight: 1.5 }}>
              Kode <strong style={{ fontFamily: "monospace", color: "#A5B4FC" }}>{deleteConfirm}</strong> akan dihapus permanen.
              Link redirect ulasan tidak akan aktif lagi, dan riwayat tap kartu ini akan dibersihkan dari leaderboard.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setDeleteConfirm(null)}
              >
                Batal
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Page Layout */}
      <div style={{ background: "#0A0A0F", minHeight: "calc(100vh - 65px)", paddingBottom: "calc(110px + env(safe-area-inset-bottom, 24px))" }}>
        <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px" }}>

          {/* Quick Stats Grid (Hero Revenue Card on mobile, 3-col on desktop) */}
          <div className="stats-grid-3" style={{ marginBottom: 22 }}>
            {[
              { id: "cards", label: "Kartu Toko Aktif", value: cards.length, icon: "💳", color: "#6366F1", sub: "Terhubung Google Review" },
              { id: "revenue", label: "Total Pendapatan", value: `Rp ${totalRevenue.toLocaleString("id-ID")}`, icon: "💰", color: "#10B981", sub: "Penjualan fisik kartu" },
              { id: "taps", label: "Total Tap Pelanggan", value: totalTaps, icon: "👆", color: "#F59E0B", sub: "Scan QR & tap NFC aktif" },
            ].map((s) => (
              <div
                key={s.id}
                className={`card stat-card-compact stat-card-${s.id}`}
                style={{
                  background: s.id === "revenue"
                    ? "linear-gradient(135deg, rgba(16, 185, 129, 0.09), #111118)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.03), #111118)",
                  borderColor: s.id === "revenue" ? "rgba(16, 185, 129, 0.25)" : "rgba(255,255,255,0.08)",
                  position: "relative",
                  borderRadius: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span className="stat-card-title" style={{ color: s.id === "revenue" ? "#6EE7B7" : "var(--text-muted)", fontWeight: 700 }}>
                    {s.label}
                  </span>
                  <span className="stat-card-icon" style={{ fontSize: "1.2rem" }}>{s.icon}</span>
                </div>
                <div className="stat-card-value" style={{ fontWeight: 800, color: s.id === "revenue" ? "#34D399" : "var(--text-primary)" }}>
                  {s.value}
                </div>
                <div className="mobile-hide-sm" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 5 }}>
                  {s.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Grid Layout: Desktop Form (Left) & Widgets (Right) */}
          <div className="admin-grid">

            {/* Desktop Left Form */}
            <div className="card desktop-form" style={{ position: "sticky", top: 80 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {isEditing ? "✏️ Edit Kartu Toko" : "➕ Hubungkan Kartu ke Toko"}
                </h2>
                {isEditing && (
                  <span className="badge badge-purple" style={{ fontSize: "0.65rem" }}>Edit Mode</span>
                )}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.5 }}>
                {isEditing
                  ? "Perbarui nama toko atau Google Place ID."
                  : "Tautkan kode fisik kartu NFC/QR ke profil Google Review toko."}
              </p>

              {formContent}

              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-ghost"
                  style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: "0.8rem" }}
                >
                  ✕ Batal Edit
                </button>
              )}
            </div>

            {/* Right Column Widgets */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* RECENT TAPS WIDGET */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                    📲 Aktivitas Tap Terbaru
                    {unseenTapCount > 0 ? (
                      <span className="badge badge-green" style={{ fontSize: "0.65rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                        {unseenTapCount} Baru
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.68rem", color: "#94A3B8", fontWeight: 500 }}>
                        ✓ Terupdate
                      </span>
                    )}
                  </h2>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={loadTapLogs} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: "0.72rem" }} title="Refresh log tap terbaru">
                      🔄 Refresh
                    </button>
                    <Link
                      href="/admin/taps"
                      onClick={() => {
                        const now = new Date().toISOString();
                        try {
                          localStorage.setItem("admin_taps_last_seen", now);
                          localStorage.setItem("admin_dashboard_last_visited", now);
                        } catch {}
                      }}
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: "0.72rem", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.25)" }}
                    >
                      Buka Riwayat Lengkap →
                    </Link>
                  </div>
                </div>

                {validTapLogs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "28px 12px" }}>
                    <div style={{ fontSize: "1.8rem", marginBottom: 6, opacity: 0.4 }}>✨</div>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: 600 }}>
                      Belum ada aktivitas tap yang tercatat.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {validTapLogs.slice(0, 6).map((log, i) => {
                      const isNew = lastVisitedAt && new Date(log.tappedAt).getTime() > new Date(lastVisitedAt).getTime();
                      const resolvedStoreName = (log.storeName && log.storeName.trim())
                        || activeCardMap.get(log.code)
                        || (log.code ? `Kartu ${log.code}` : "Toko Tanpa Nama");
                      const reviewUrl = cardUrlMap.get(log.code) || (resolvedStoreName ? getPublicGoogleReviewUrl("", resolvedStoreName) : "");

                      return (
                        <div
                          key={`${log.code}-${log.tappedAt}-${i}`}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 14px",
                            background: isNew ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.02)",
                            borderLeft: isNew ? "3px solid #10B981" : "3px solid rgba(255,255,255,0.12)",
                            borderRadius: "0 8px 8px 0",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontWeight: 700, color: "#F0F0FF", fontSize: "0.88rem", wordBreak: "break-word", lineHeight: 1.3 }}>
                                {resolvedStoreName}
                              </span>
                              {isNew && (
                                <span style={{ fontSize: "0.6rem", padding: "1px 5px", background: "rgba(16,185,129,0.2)", color: "#6EE7B7", borderRadius: 4, fontWeight: 700 }}>
                                  BARU
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                              <span style={{ fontFamily: "monospace", color: "#818CF8", background: "rgba(99,102,241,0.1)", padding: "1px 5px", borderRadius: 4, fontSize: "0.68rem" }}>
                                {log.code}
                              </span>
                              <span>·</span>
                              {(() => {
                                const ld = new Date(log.tappedAt);
                                const isPrev = ld.getFullYear() !== new Date().getFullYear();
                                return (
                                  <span>{ld.toLocaleString("id-ID", { day: "numeric", month: "short", ...(isPrev ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit" })}</span>
                                );
                              })()}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
                            <span style={{
                              fontSize: "0.7rem", fontWeight: 700, color: "#34D399",
                              background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)",
                              padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0,
                            }}>
                              {timeAgo(log.tappedAt)}
                            </span>
                            {reviewUrl && (
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
                  </div>
                )}
              </div>

            </div>

          </div>

        </main>
      </div>

      {/* Mobile Floating Action Button (FAB) */}
      <button
        type="button"
        className="fab"
        onClick={() => openNewForm()}
        title="Assign Kartu Baru"
        aria-label="Assign Kartu Baru"
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
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </>
  );
}

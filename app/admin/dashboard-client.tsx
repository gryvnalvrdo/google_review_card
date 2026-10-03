"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const QRScanner = dynamic(() => import("./components/QRScanner"), { ssr: false });

type CardRecord = {
  code: string;
  storeName: string;
  googleReviewUrl: string;
  createdAt: string;
  updatedAt?: string;
  tapCount?: number;
  price?: number;
};

function generateRandomCode(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

export default function AdminDashboard() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [stockCodes, setStockCodes] = useState<string[]>([]);
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
  const [stockPage, setStockPage] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [savedCardUrl, setSavedCardUrl] = useState<string | null>(null);
  const [copiedNfc, setCopiedNfc] = useState(false);

  async function loadCards() {
    const res = await fetch("/api/admin/codes");
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards ?? []);
    }
    const stockRes = await fetch("/api/admin/stock");
    if (stockRes.ok) {
      const stockData = await stockRes.json();
      setStockCodes(stockData.codes ?? []);
    }
  }

  useEffect(() => { loadCards(); }, []);

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
    setGoogleReviewUrl(card.googleReviewUrl);
    // Coba ekstrak Place ID dari URL yang ada
    const match = card.googleReviewUrl.match(/placeid=([^&]+)/);
    setPlaceId(match ? match[1] : "");
    setPrice(card.price ?? 50000);
    setMessage(null); setError(null);
    setIsEditing(true);
    setShowSheet(true);
  }

  function closeSheet() {
    setShowSheet(false);
    setTimeout(resetForm, 350); // after animation
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
      // Jangan auto-close — biarkan user copy URL dulu
    } else {
      setError(data?.error ?? "Gagal menyimpan. Cek kembali datanya.");
    }
  }

  async function handleDelete(cardCode: string) {
    const res = await fetch(`/api/admin/codes/${cardCode}`, { method: "DELETE" });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.code !== cardCode));
    }
    setDeleteConfirm(null);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  function formatDate(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  const filtered = cards.filter(
    (c) =>
      c.storeName.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  const totalTaps = cards.reduce((sum, c) => sum + (c.tapCount ?? 0), 0);

  const monthlyRevenueObj = cards.reduce((acc, card) => {
    const d = new Date(card.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + (card.price ?? 50000);
    return acc;
  }, {} as Record<string, number>);
  
  const allMonthKeys = Object.keys(monthlyRevenueObj).sort((a, b) => b.localeCompare(a));
  const sortedMonthKeys = selectedMonth ? allMonthKeys.filter(k => k === selectedMonth) : allMonthKeys;

  const formatMonthKey = (key: string) => {
    const [y, m] = key.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // ---- Form content (shared between desktop sidebar & mobile sheet) ----
  const formContent = (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="label" htmlFor="card-code">Kode Kartu (NFC/QR)</label>
        <div style={{ display: "flex", gap: 8 }}>
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
            style={isEditing ? { opacity: 0.55, cursor: "not-allowed", flex: 1 } : { flex: 1 }}
          />
          {!isEditing && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "0 12px", fontSize: "0.8rem", whiteSpace: "nowrap", flexShrink: 0 }}
                onClick={() => setShowScanner(true)}
                title="Scan QR kartu via kamera"
              >
                📷 Scan
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "0 12px", fontSize: "0.8rem", whiteSpace: "nowrap", flexShrink: 0 }}
                onClick={() => setCode(generateRandomCode())}
                title="Generate kode acak"
              >
                🎲
              </button>
            </>
          )}
        </div>
        {isEditing && (
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Kode tidak bisa diubah saat edit.
          </p>
        )}
      </div>

      <div className="form-group">
        <label className="label" htmlFor="store-name">Nama Toko</label>
        <input
          id="store-name"
          className="input"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="cth: Kedai Kopi Sudirman"
          maxLength={100}
          required
        />
      </div>

      <div className="form-group">
        <label className="label" htmlFor="place-id">
          Google Place ID
          <a
            href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 8, fontSize: "0.65rem", color: "#A5B4FC", fontWeight: 400 }}
          >
            🔍 Cari Place ID ↗
          </a>
        </label>
        <div style={{
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 8,
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}>
          <strong style={{ color: "#A5B4FC" }}>💡 Cara cepat:</strong> Buka Place ID Finder (link biru di atas) → Cari toko → Copy ID yang berawalan <strong>ChIJ...</strong> lalu paste di bawah.
        </div>
        <input
          id="place-id"
          className="input"
          value={placeId}
          onChange={(e) => {
            const pid = e.target.value.trim();
            setPlaceId(pid);
            if (pid.startsWith("ChIJ") || pid.startsWith("Eh")) {
              setGoogleReviewUrl(`https://search.google.com/local/writereview?placeid=${pid}`);
            } else {
              setGoogleReviewUrl(""); // Reset if invalid
            }
          }}
          placeholder="cth: ChIJxxxxxxxxxxxxxxxxx"
          maxLength={100}
          required
          autoCapitalize="none"
          autoCorrect="off"
        />
        {googleReviewUrl && (
          <p style={{ fontSize: "0.7rem", color: "#6EE7B7", marginTop: 4 }}>
            ✅ URL Review otomatis terbuat!
          </p>
        )}
      </div>

      <div className="form-group">
        <label className="label" htmlFor="price">Harga Jual (Rp)</label>
        <input
          id="price"
          type="number"
          className="input"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          placeholder="50000"
          required
        />
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
          Default: Rp 50.000 (Akan dihitung ke Total Pendapatan).
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {/* NFC URL box — muncul setelah berhasil simpan */}
      {savedCardUrl && (
        <div style={{
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.3)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 14,
        }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#34D399", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            📱 URL untuk NFC Tools
          </div>
          <div style={{
            fontFamily: "monospace",
            fontSize: "0.82rem",
            color: "#F0F0FF",
            wordBreak: "break-all",
            background: "rgba(0,0,0,0.3)",
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
            style={{
              width: "100%",
              padding: "11px",
              background: copiedNfc ? "rgba(16,185,129,0.25)" : "rgba(16,185,129,0.15)",
              border: "1px solid rgba(16,185,129,0.4)",
              borderRadius: 8,
              color: "#34D399",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {copiedNfc ? "✅ Disalin! Buka NFC Tools → paste" : "📋 Salin URL untuk NFC Tools"}
          </button>
          <button
            type="button"
            onClick={closeSheet}
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: "0.8rem" }}
          >
            Selesai, tutup
          </button>
        </div>
      )}

      {!savedCardUrl && (
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: "0.95rem" }}
        >
          {loading ? (
            <><div className="spinner" /> Menyimpan...</>
          ) : (
            isEditing ? "Update Kartu →" : "Simpan Kartu →"
          )}
        </button>
      )}
    </form>
  );

  return (
    <>
      {/* QR Scanner overlay */}
      {showScanner && (
        <QRScanner
          onScan={(scannedCode) => {
            setCode(scannedCode);
            setShowScanner(false);
            setShowSheet(true);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="gradient-bg">
        <div className="gradient-blob blob-1" />
        <div className="gradient-blob blob-2" />
      </div>

      {/* Mobile bottom sheet backdrop */}
      <div
        className={`sheet-backdrop ${showSheet ? "open" : ""}`}
        onClick={closeSheet}
      />

      {/* Mobile bottom sheet */}
      <div className={`sheet ${showSheet ? "open" : ""}`}>
        <div className="sheet-handle" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {isEditing ? "✏️ Edit Kartu" : "➕ Assign Kartu ke Toko"}
          </h2>
          <button onClick={closeSheet} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
            ✕ Tutup
          </button>
        </div>
        {formContent}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, backdropFilter: "blur(4px)" }}
            onClick={() => setDeleteConfirm(null)}
          />
          <div style={{
            position: "fixed",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 301,
            background: "#16161F",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 16,
            padding: "28px 24px",
            width: "min(90vw, 360px)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Hapus Kartu?</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 20 }}>
              Kode <span style={{ fontFamily: "monospace", color: "#A5B4FC" }}>{deleteConfirm}</span> akan
              dihapus permanen. Link kartu ini tidak akan aktif lagi.
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
                Hapus
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
        {/* ---- Header ---- */}
        <header style={{
          borderBottom: "1px solid var(--border)",
          background: "rgba(10,10,15,0.85)",
          backdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34,
                background: "linear-gradient(135deg, #4F46E5, #8B5CF6)",
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.9rem", flexShrink: 0,
              }}>⭐</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.2 }}>
                  Review Card
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Admin Panel</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="badge badge-green" style={{ fontSize: "0.65rem" }}>● Online</span>
              <button
                onClick={handleLogout}
                className="btn btn-ghost"
                style={{ padding: "7px 14px", fontSize: "0.8rem" }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* ---- Main ---- */}
        <main style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 100px" }}>

          {/* Stats */}
          <div className="stats-grid">
            {[
              { label: "Kartu Aktif", value: cards.length, icon: "💳", color: "#4F46E5" },
              { label: "Stok Tersedia", value: stockCodes.length, icon: "📦", color: "#06B6D4" },
              { label: "Pendapatan", value: "Rp " + cards.reduce((sum, c) => sum + (c.price ?? 50000), 0).toLocaleString("id-ID"), icon: "💰", color: "#10B981" },
              { label: "Total Tap", value: totalTaps, icon: "👆", color: "#F59E0B" },
            ].map((s) => (
              <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 3, lineHeight: 1.3 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <a 
              href="/admin/print" 
              className="btn" 
              style={{ 
                background: "linear-gradient(135deg, #4F46E5, #8B5CF6)", 
                color: "white", 
                textDecoration: "none", 
                padding: "10px 16px", 
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                boxShadow: "0 4px 14px rgba(79,70,229,0.3)"
              }}
            >
              🖨️ Buka Mesin Cetak QR Code
            </a>
          </div>

          <div className="admin-grid">
            {/* ---- FORM: desktop only ---- */}
            <div className="card desktop-form" style={{ position: "sticky", top: 72 }}>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
                {isEditing ? "✏️ Edit Kartu" : "Assign Kartu ke Toko"}
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.5 }}>
                {isEditing
                  ? "Ubah nama toko atau link Google Review."
                  : "Tautkan kode kartu NFC/QR ke toko client."}
              </p>
              {formContent}
              {isEditing && (
                <button
                  onClick={resetForm}
                  className="btn btn-ghost"
                  style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: "0.8rem" }}
                >
                  ✕ Batal Edit
                </button>
              )}
            </div>

            {/* ---- UX DASHBOARD REPLACEMENT ---- */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* QUICK ACTIONS */}
              <div className="card" style={{ padding: "20px" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>⚡ Quick Actions</h2>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <a href="/admin/cards" className="btn" style={{ background: "#374151", color: "white", flex: 1, minWidth: 140, textDecoration: "none", textAlign: "center" }}>
                    🗂️ Manajemen Kartu
                  </a>
                  <a href="/admin/print" className="btn" style={{ background: "#374151", color: "white", flex: 1, minWidth: 140, textDecoration: "none", textAlign: "center" }}>
                    🖨️ Cetak QR
                  </a>
                </div>
              </div>

              {/* INVENTORY STOK KARTU */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                    📦 Inventori Stok Kartu ({stockCodes.length})
                  </h2>
                </div>
                
                {stockCodes.length === 0 ? (
                   <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Belum ada stok. Buka menu Cetak QR untuk generate kartu baru.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {stockCodes.slice(stockPage * 5, (stockPage + 1) * 5).map((sc) => (
                      <div key={sc} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontFamily: "monospace", color: "#A5B4FC", fontSize: "0.95rem", letterSpacing: "0.05em" }}>
                          {sc}
                        </div>
                        <button
                          onClick={() => openNewForm(sc)}
                          className="btn btn-emerald"
                          style={{ padding: "4px 12px", fontSize: "0.75rem", borderRadius: 6 }}
                        >
                          Assign →
                        </button>
                      </div>
                    ))}
                    
                    {/* Pagination Controls */}
                    {stockCodes.length > 5 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, padding: "0 4px" }}>
                        <button
                          onClick={() => setStockPage(p => Math.max(0, p - 1))}
                          disabled={stockPage === 0}
                          className="btn btn-ghost"
                          style={{ padding: "4px 12px", fontSize: "0.8rem", opacity: stockPage === 0 ? 0.3 : 1 }}
                        >
                          ← Prev
                        </button>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Hal {stockPage + 1} dari {Math.ceil(stockCodes.length / 5)}
                        </div>
                        <button
                          onClick={() => setStockPage(p => Math.min(Math.ceil(stockCodes.length / 5) - 1, p + 1))}
                          disabled={stockPage >= Math.ceil(stockCodes.length / 5) - 1}
                          className="btn btn-ghost"
                          style={{ padding: "4px 12px", fontSize: "0.8rem", opacity: stockPage >= Math.ceil(stockCodes.length / 5) - 1 ? 0.3 : 1 }}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>


              {/* MONTHLY REVENUE */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    📊 Pendapatan Bulanan
                  </h2>
                  {allMonthKeys.length > 1 && (
                    <select
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.8rem", fontFamily: "inherit", outline: "none", cursor: "pointer" }}
                    >
                      <option value="">Semua Bulan</option>
                      {allMonthKeys.map(k => (
                        <option key={k} value={k}>{formatMonthKey(k)}</option>
                      ))}
                    </select>
                  )}
                </div>
                {sortedMonthKeys.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Belum ada data penjualan.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sortedMonthKeys.map((key) => (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                        <div style={{ fontWeight: 600, color: "white", fontSize: "0.9rem" }}>
                          {formatMonthKey(key)}
                        </div>
                        <div style={{ color: "#10B981", fontWeight: 700, fontSize: "0.95rem" }}>
                          Rp {monthlyRevenueObj[key].toLocaleString("id-ID")}
                        </div>
                      </div>
                    ))}
                    {selectedMonth && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 4 }}>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total bulan ini</div>
                        <div style={{ color: "#34D399", fontWeight: 800 }}>Rp {(monthlyRevenueObj[selectedMonth] ?? 0).toLocaleString("id-ID")}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RECENTLY ADDED */}
              <div className="card" style={{ padding: "20px" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
                  🕒 Baru Ditambahkan
                </h2>
                {cards.length === 0 ? (
                   <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Belum ada kartu aktif.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[...cards].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3).map((c) => (
                      <div key={c.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderLeft: "3px solid #4F46E5", background: "rgba(255,255,255,0.03)", borderRadius: "0 8px 8px 0" }}>
                        <div>
                          <div style={{ fontWeight: 600, color: "white", fontSize: "0.9rem" }}>{c.storeName}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatDate(c.createdAt)}</div>
                        </div>
                        <a href="/admin/cards" style={{ fontSize: "0.8rem", color: "#A5B4FC", textDecoration: "none" }}>Lihat ↗</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile FAB */}
      <button className="fab" onClick={() => openNewForm()} title="Assign kartu baru">
        +
      </button>
    </>
  );
}

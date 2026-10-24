"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";
import AdminNav from "../components/AdminNav";
import QRScanner from "../components/QRScanner";

const QR_EXPORT_SIZE = 1000; // ukuran QR PNG yang di-download (px)

const CARD_W  = 638;
const CARD_H  = 1004;
const QR_SIZE = 280;
const QR_PAD  = 22;
const BOX_SIZE = QR_SIZE + QR_PAD * 2;
const BOX_X   = Math.round((CARD_W - BOX_SIZE) / 2);
const BOX_Y   = 438;
const RADIUS  = 18;

interface CardData {
  code: string;
  storeName: string;
  googleReviewUrl: string;
  tapCount: number;
  createdAt: string;
  price?: number;
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [stockCodes, setStockCodes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"aktif" | "stok">("aktif");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "tap" | "name" | "price">("date");
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState<string | null>(null);
  const [deleteStockConfirm, setDeleteStockConfirm] = useState<string | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [downloadingQrCode, setDownloadingQrCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const qrRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const qrOnlyRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/Beri Kami Ulasan.png";
    img.onload = () => setBgImg(img);
  }, []);

  async function fetchCards() {
    try {
      const [resCodes, resStock] = await Promise.all([
        fetch("/api/admin/codes"),
        fetch("/api/admin/stock"),
      ]);
      if (resCodes.ok) {
        const data = await resCodes.json();
        setCards(data.cards ?? []);
      }
      if (resStock.ok) {
        const stockData = await resStock.json();
        setStockCodes(stockData.codes ?? []);
      }
    } catch (e) {
      console.error("Gagal load cards / stock:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCards(); }, []);

  async function handleDelete(code: string) {
    const res = await fetch(`/api/admin/codes/${code}`, { method: "DELETE" });
    if (res.ok) {
      setCards(prev => prev.filter(c => c.code !== code));
    } else {
      alert("Gagal menghapus kartu.");
    }
    setDeleteConfirmCode(null);
  }

  async function handleDeleteStock(code: string) {
    const res = await fetch(`/api/admin/stock/${code}`, { method: "DELETE" });
    if (res.ok) {
      setStockCodes(prev => prev.filter(c => c !== code));
    } else {
      alert("Gagal menghapus kode stok.");
    }
    setDeleteStockConfirm(null);
  }

  async function handleClearStock() {
    if (!confirm("⚠️ YAKIN HAPUS SEMUA STOK?\n\nSemua kode stok yang belum di-assign akan dihapus permanen.")) return;
    const res = await fetch("/api/admin/stock/clear", { method: "DELETE" });
    if (res.ok) {
      setStockCodes([]);
    } else {
      alert("Gagal menghapus semua stok.");
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCard) return;
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: editingCard.code,
        storeName: editingCard.storeName,
        googleReviewUrl: editingCard.googleReviewUrl,
        price: editingCard.price ?? 50000,
      }),
    });
    if (res.ok) {
      setEditingCard(null);
      fetchCards();
    } else {
      alert("Gagal menyimpan perubahan.");
    }
  }

  async function downloadCard(card: CardData) {
    setDownloadingCode(card.code);
    await new Promise(r => setTimeout(r, 400));
    const qrCanvas = qrRefs.current[card.code];
    if (!qrCanvas || !bgImg) {
      alert("Template sedang disiapkan, silakan klik lagi.");
      setDownloadingCode(null);
      return;
    }
    const out = document.createElement("canvas");
    out.width = CARD_W; out.height = CARD_H;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(bgImg, 0, 0, CARD_W, CARD_H);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(BOX_X + RADIUS, BOX_Y);
    ctx.lineTo(BOX_X + BOX_SIZE - RADIUS, BOX_Y);
    ctx.arcTo(BOX_X + BOX_SIZE, BOX_Y, BOX_X + BOX_SIZE, BOX_Y + RADIUS, RADIUS);
    ctx.lineTo(BOX_X + BOX_SIZE, BOX_Y + BOX_SIZE - RADIUS);
    ctx.arcTo(BOX_X + BOX_SIZE, BOX_Y + BOX_SIZE, BOX_X + BOX_SIZE - RADIUS, BOX_Y + BOX_SIZE, RADIUS);
    ctx.lineTo(BOX_X + RADIUS, BOX_Y + BOX_SIZE);
    ctx.arcTo(BOX_X, BOX_Y + BOX_SIZE, BOX_X, BOX_Y + BOX_SIZE - RADIUS, RADIUS);
    ctx.lineTo(BOX_X, BOX_Y + RADIUS);
    ctx.arcTo(BOX_X, BOX_Y, BOX_X + RADIUS, BOX_Y, RADIUS);
    ctx.closePath();
    ctx.fill();
    ctx.drawImage(qrCanvas, BOX_X + QR_PAD, BOX_Y + QR_PAD, QR_SIZE, QR_SIZE);
    out.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kartu-${card.code}-${card.storeName.replace(/\s+/g, "_")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
    setDownloadingCode(null);
  }

  async function downloadQrOnly(card: CardData) {
    setDownloadingQrCode(card.code);
    await new Promise(r => setTimeout(r, 300));
    const qrCanvas = qrOnlyRefs.current[card.code];
    if (!qrCanvas) {
      alert("QR sedang disiapkan, silakan coba lagi.");
      setDownloadingQrCode(null);
      return;
    }
    const PAD = 40;
    const out = document.createElement("canvas");
    out.width = QR_EXPORT_SIZE + PAD * 2;
    out.height = QR_EXPORT_SIZE + PAD * 2;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(qrCanvas, PAD, PAD, QR_EXPORT_SIZE, QR_EXPORT_SIZE);
    out.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QR_${card.storeName.replace(/\s+/g, "_")}_${card.code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
    setDownloadingQrCode(null);
  }

  function copyCodeText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  const filtered = useMemo(() => {
    return cards
      .filter(c =>
        c.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === "tap") return (b.tapCount || 0) - (a.tapCount || 0);
        if (sortBy === "name") return a.storeName.localeCompare(b.storeName);
        if (sortBy === "price") return (b.price ?? 50000) - (a.price ?? 50000);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [cards, searchTerm, sortBy]);

  const totalRevenue = useMemo(() => cards.reduce((s, c) => s + (c.price ?? 50000), 0), [cards]);
  const totalTaps = useMemo(() => cards.reduce((s, c) => s + (c.tapCount ?? 0), 0), [cards]);

  return (
    <>
      <AdminNav active="cards" />

      {/* Hidden QR canvases for PNG export */}
      <div style={{ position: "fixed", left: -9999, top: -9999, pointerEvents: "none" }} aria-hidden="true">
        {cards.map(card => (
          <QRCodeCanvas
            key={`full-${card.code}`}
            value={card.googleReviewUrl}
            size={QR_SIZE}
            ref={(el: HTMLCanvasElement | null) => { qrRefs.current[card.code] = el; }}
            level="H"
            includeMargin={false}
          />
        ))}
        {baseUrl && cards.map(card => (
          <QRCodeCanvas
            key={`only-${card.code}`}
            value={`${baseUrl}/c/${card.code}`}
            size={QR_EXPORT_SIZE}
            ref={(el: HTMLCanvasElement | null) => { qrOnlyRefs.current[card.code] = el; }}
            level="H"
            includeMargin={false}
          />
        ))}
      </div>

      {/* Delete Card Confirmation Modal */}
      {deleteConfirmCode && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, backdropFilter: "blur(6px)" }}
            onClick={() => setDeleteConfirmCode(null)}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)", zIndex: 301,
            background: "#14141E", border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 18, padding: "28px 24px",
            width: "min(92vw, 380px)", textAlign: "center",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontWeight: 800, fontSize: "1.15rem", marginBottom: 8, color: "#F0F0FF" }}>Hapus Kartu Ini?</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 22, lineHeight: 1.5 }}>
              Kode <strong style={{ fontFamily: "monospace", color: "#A5B4FC" }}>{deleteConfirmCode}</strong> akan dihapus permanen.
              Kartu fisik ini tidak dapat diakses lagi oleh pelanggan, dan datanya tidak akan muncul lagi di leaderboard.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setDeleteConfirmCode(null)}
              >
                Batal
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => handleDelete(deleteConfirmCode)}
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Stock Confirmation Modal */}
      {deleteStockConfirm && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, backdropFilter: "blur(6px)" }}
            onClick={() => setDeleteStockConfirm(null)}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)", zIndex: 301,
            background: "#14141E", border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 18, padding: "28px 24px",
            width: "min(92vw, 360px)", textAlign: "center",
          }}>
            <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>📦</div>
            <h3 style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 6, color: "#F0F0FF" }}>Hapus Kode Stok?</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 20 }}>
              Kode stok <strong style={{ fontFamily: "monospace", color: "#A5B4FC" }}>{deleteStockConfirm}</strong> akan dihapus dari daftar stok.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setDeleteStockConfirm(null)}>
                Batal
              </button>
              <button className="btn btn-danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => handleDeleteStock(deleteStockConfirm)}>
                Hapus
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Container */}
      <div style={{ background: "#0A0A0F", minHeight: "calc(100vh - 65px)", paddingBottom: "100px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px" }}>

          {/* Header Title */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                🗂️ Manajemen Kartu &amp; Stok
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 4 }}>
                Kelola kartu aktif, cetak ulang QR resolusi tinggi, atau assign stok kartu baru ke toko.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="btn btn-ghost"
                style={{ fontSize: "0.85rem", padding: "8px 14px", color: "#34D399", borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.06)" }}
              >
                📷 Scan QR Kartu
              </button>
              <a
                href="/admin"
                className="btn btn-primary"
                style={{ fontSize: "0.85rem", padding: "8px 16px" }}
              >
                ➕ Hubungkan Kartu Baru
              </a>
            </div>
          </div>

          {/* Main Tab Switcher */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 10 }}>
            <button
              onClick={() => setActiveTab("aktif")}
              className={`btn ${activeTab === "aktif" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: 10, padding: "8px 18px", fontSize: "0.88rem" }}
            >
              💳 Kartu Toko Aktif ({cards.length})
            </button>
            <button
              onClick={() => setActiveTab("stok")}
              className={`btn ${activeTab === "stok" ? "btn-primary" : "btn-ghost"}`}
              style={{ borderRadius: 10, padding: "8px 18px", fontSize: "0.88rem" }}
            >
              📦 Stok Belum Di-Assign ({stockCodes.length})
            </button>
          </div>

          {/* ══════════ TAB 1: KARTU AKTIF ══════════ */}
          {activeTab === "aktif" ? (
            <>
              {/* KPI Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 22 }}>
                <div className="card" style={{ padding: "16px", background: "linear-gradient(180deg, rgba(99,102,241,0.06), #111118)" }}>
                  <div style={{ fontSize: "0.72rem", color: "#A5B4FC", fontWeight: 700, textTransform: "uppercase" }}>💳 Total Kartu Aktif</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#F0F0FF", marginTop: 4 }}>{cards.length}</div>
                </div>
                <div className="card" style={{ padding: "16px", background: "linear-gradient(180deg, rgba(16,185,129,0.06), #111118)" }}>
                  <div style={{ fontSize: "0.72rem", color: "#34D399", fontWeight: 700, textTransform: "uppercase" }}>💰 Total Omzet</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#34D399", marginTop: 4 }}>Rp {totalRevenue.toLocaleString("id-ID")}</div>
                </div>
                <div className="card" style={{ padding: "16px", background: "linear-gradient(180deg, rgba(245,158,11,0.06), #111118)" }}>
                  <div style={{ fontSize: "0.72rem", color: "#FCD34D", fontWeight: 700, textTransform: "uppercase" }}>👆 Total Tap</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#FCD34D", marginTop: 4 }}>{totalTaps}×</div>
                </div>
              </div>

              {/* Toolbar */}
              <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="🔍 Cari nama toko atau kode kartu..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as "date" | "tap" | "name" | "price")}
                  style={{
                    padding: "10px 14px", background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                    color: "#F0F0FF", fontSize: "0.85rem", outline: "none", cursor: "pointer",
                  }}
                >
                  <option value="date" style={{ background: "#111118" }}>Terbaru Ditambahkan</option>
                  <option value="tap" style={{ background: "#111118" }}>Tap Terbanyak</option>
                  <option value="name" style={{ background: "#111118" }}>Nama Toko (A–Z)</option>
                  <option value="price" style={{ background: "#111118" }}>Harga Jual Tertinggi</option>
                </select>
              </div>

              {/* Cards List */}
              {loading ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <div className="spinner" style={{ margin: "0 auto 12px", width: 24, height: 24 }} />
                  <p style={{ color: "var(--text-muted)" }}>Memuat daftar kartu...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 10, opacity: 0.5 }}>💳</div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Tidak Ada Kartu</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    {searchTerm ? `Tidak ditemukan kartu dengan kata kunci "${searchTerm}".` : "Belum ada kartu toko yang terhubung."}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filtered.map(card => {
                    const fullCardUrl = `${baseUrl}/c/${card.code}`;
                    return (
                      <div
                        key={card.code}
                        className="card"
                        style={{
                          padding: "18px 20px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                          background: "#111118",
                          border: "1px solid rgba(255,255,255,0.07)",
                          transition: "border-color 0.2s",
                        }}
                      >
                        {/* Row 1: Header + Badges + Actions */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#F0F0FF" }}>
                                {card.storeName}
                              </h3>
                              <button
                                onClick={() => copyCodeText(card.code)}
                                title="Klik untuk salin kode"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                                  color: "#A5B4FC", fontFamily: "monospace", fontSize: "0.75rem",
                                  fontWeight: 700, padding: "2px 8px", borderRadius: 6, cursor: "pointer",
                                }}
                              >
                                {card.code}
                                <span style={{ fontSize: "0.65rem" }}>{copiedCode === card.code ? "✅" : "📋"}</span>
                              </button>
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                              <span className="badge badge-green">● Aktif</span>
                              <span className="badge badge-orange">👆 {card.tapCount ?? 0} Tap</span>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                Ditambahkan: {formatDate(card.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Quick Actions Buttons */}
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <button
                              onClick={() => downloadQrOnly(card)}
                              disabled={downloadingQrCode === card.code || !baseUrl}
                              className="btn btn-ghost"
                              style={{
                                padding: "6px 12px", fontSize: "0.78rem",
                                color: "#34D399", borderColor: "rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.06)",
                              }}
                              title="Download QR Code resolusi tinggi untuk cetak besar"
                            >
                              {downloadingQrCode === card.code ? "⏳ Mengunduh..." : "📷 QR High-Res"}
                            </button>

                            <button
                              onClick={() => downloadCard(card)}
                              disabled={downloadingCode === card.code || !bgImg}
                              className="btn btn-ghost"
                              style={{
                                padding: "6px 12px", fontSize: "0.78rem",
                                color: "#A5B4FC", borderColor: "rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.06)",
                              }}
                              title="Download kartu PNG utuh dengan desain template"
                            >
                              {downloadingCode === card.code ? "⏳ Menyiapkan..." : "🖼️ Kartu PNG"}
                            </button>

                            <button
                              onClick={() => setEditingCard(card)}
                              className="btn btn-ghost"
                              style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                              title="Edit Toko"
                            >
                              ✏️
                            </button>

                            <button
                              onClick={() => setDeleteConfirmCode(card.code)}
                              className="btn btn-danger"
                              style={{ padding: "6px 10px", fontSize: "0.85rem" }}
                              title="Hapus Kartu"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Details */}
                        <div style={{
                          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: 12, padding: "10px 14px", background: "rgba(0,0,0,0.3)", borderRadius: 10,
                          fontSize: "0.78rem", border: "1px solid rgba(255,255,255,0.04)",
                        }}>
                          <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.68rem", textTransform: "uppercase" }}>Harga Jual</span>
                            <strong style={{ color: "#34D399", fontSize: "0.88rem" }}>
                              Rp {(card.price ?? 50000).toLocaleString("id-ID")}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.68rem", textTransform: "uppercase" }}>Link Kartu / NFC</span>
                            <a href={fullCardUrl} target="_blank" rel="noreferrer" style={{ color: "#A5B4FC", textDecoration: "none", wordBreak: "break-all" }}>
                              {fullCardUrl} ↗
                            </a>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.68rem", textTransform: "uppercase" }}>Target Google Review</span>
                            <a href={card.googleReviewUrl} target="_blank" rel="noreferrer" style={{ color: "#FCD34D", textDecoration: "none", wordBreak: "break-all" }}>
                              Buka Halaman Ulasan ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ══════════ TAB 2: STOK BELUM ASSIGN ══════════ */
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="🔍 Cari kode stok..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href="/admin/print" className="btn btn-primary" style={{ fontSize: "0.82rem" }}>
                    + Cetak Stok Baru
                  </a>
                  {stockCodes.length > 0 && (
                    <button onClick={handleClearStock} className="btn btn-danger" style={{ fontSize: "0.82rem" }}>
                      🗑️ Hapus Semua
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <div className="spinner" style={{ margin: "0 auto 12px", width: 24, height: 24 }} />
                  <p style={{ color: "var(--text-muted)" }}>Memuat stok kartu...</p>
                </div>
              ) : stockCodes.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 10, opacity: 0.5 }}>📦</div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Belum Ada Stok Tersedia</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 16 }}>
                    Generate kode kartu baru di menu Mesin Cetak QR untuk menambah stok kartu fisik.
                  </p>
                  <a href="/admin/print" className="btn btn-primary" style={{ display: "inline-flex" }}>
                    Buka Mesin Cetak QR →
                  </a>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {stockCodes
                    .filter(sc => sc.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(sc => (
                      <div
                        key={sc}
                        className="card"
                        style={{
                          padding: "16px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 14,
                          background: "#111118",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{
                            fontFamily: "monospace", fontSize: "1.1rem", fontWeight: 800,
                            color: "#A5B4FC", letterSpacing: "0.05em",
                            background: "rgba(99,102,241,0.12)", padding: "4px 10px", borderRadius: 8,
                          }}>
                            {sc}
                          </span>
                          <span className="badge badge-purple" style={{ fontSize: "0.62rem" }}>Siap Pakai</span>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => setDeleteStockConfirm(sc)}
                            className="btn btn-danger"
                            style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                            title="Hapus Stok"
                          >
                            🗑️
                          </button>
                          <a
                            href={`/admin?code=${sc}`}
                            className="btn btn-primary"
                            style={{ flex: 1, justifyContent: "center", textDecoration: "none", fontSize: "0.8rem", padding: "6px 12px" }}
                          >
                            Assign ke Toko →
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* Edit Card Modal */}
      {editingCard && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
            zIndex: 400, backdropFilter: "blur(6px)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={() => setEditingCard(null)}
        >
          <div
            className="card"
            style={{ width: "min(100%, 460px)", background: "#13131C", padding: "26px 24px" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F0F0FF" }}>✏️ Edit Kartu Toko</h2>
              <button onClick={() => setEditingCard(null)} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="label">Kode Kartu</label>
                <input className="input" value={editingCard.code} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
              </div>

              <div className="form-group">
                <label className="label">Nama Toko / Resto</label>
                <input
                  className="input"
                  value={editingCard.storeName}
                  onChange={e => setEditingCard({ ...editingCard, storeName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Google Review URL</label>
                <input
                  className="input"
                  value={editingCard.googleReviewUrl}
                  onChange={e => setEditingCard({ ...editingCard, googleReviewUrl: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Harga Jual (Rp)</label>
                <input
                  className="input"
                  type="number"
                  value={editingCard.price ?? 50000}
                  onChange={e => setEditingCard({ ...editingCard, price: Number(e.target.value) })}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setEditingCard(null)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={(code) => {
            setShowScanner(false);
            window.location.href = `/admin?code=${code}`;
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}

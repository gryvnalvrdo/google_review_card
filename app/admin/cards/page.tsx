"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import AdminNav from "../components/AdminNav";
import QRScanner from "../components/QRScanner";
import { PriceStepperInput } from "../components/PriceStepperInput";
import { getPublicGoogleReviewUrl } from "../../../lib/redirect";

const QR_EXPORT_SIZE = 1000; // ukuran QR PNG yang di-download (px)

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

function EditIcon({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "tap" | "name" | "price">("date");
  const [deleteConfirmCode, setDeleteConfirmCode] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [originalCard, setOriginalCard] = useState<CardData | null>(null);
  const [resetTapsCheckbox, setResetTapsCheckbox] = useState(false);
  const [resettingCode, setResettingCode] = useState<string | null>(null);
  const [editPlaceId, setEditPlaceId] = useState("");

  function startEdit(card: CardData) {
    setEditingCard({ ...card });
    setOriginalCard(card);
    const match = card.googleReviewUrl?.match(/placeid=([a-zA-Z0-9_\-]+)/i);
    setEditPlaceId(match ? match[1] : "");
    setResetTapsCheckbox(false);
  }

  function handlePlaceIdChange(rawVal: string) {
    let pid = rawVal.trim();
    // Auto-extract place ID if user pastes full URL
    const match = pid.match(/placeid=([a-zA-Z0-9_\-]+)/i);
    if (match) pid = match[1];
    setEditPlaceId(pid);
    if (pid) {
      setEditingCard(prev => prev ? {
        ...prev,
        googleReviewUrl: `https://search.google.com/local/writereview?placeid=${pid}`,
      } : null);
    }
  }
  const [downloadingQrCode, setDownloadingQrCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const qrOnlyRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  async function fetchCards() {
    try {
      const resCodes = await fetch("/api/admin/codes");
      if (resCodes.ok) {
        const data = await resCodes.json();
        setCards(data.cards ?? []);
      }
    } catch (e) {
      console.error("Gagal load cards:", e);
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

  async function handleResetTaps(card: CardData) {
    const confirmed = window.confirm(
      `Reset riwayat tap untuk "${card.storeName}" (${card.code})?\n\nHitungan ${card.tapCount ?? 0} tap dan seluruh entri log kartu ini akan dihapus dan kembali ke 0.`
    );
    if (!confirmed) return;
    setResettingCode(card.code);
    try {
      const res = await fetch(`/api/admin/codes/${card.code}`, { method: "POST" });
      if (res.ok) {
        await fetchCards();
      } else {
        alert("Gagal mereset tap kartu.");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan saat mereset tap.");
    } finally {
      setResettingCode(null);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCard) return;

    const isLocationOrStoreChanged = Boolean(
      originalCard && (
        originalCard.storeName.trim().toLowerCase() !== editingCard.storeName.trim().toLowerCase() ||
        originalCard.googleReviewUrl.trim() !== editingCard.googleReviewUrl.trim()
      )
    );

    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: editingCard.code,
        storeName: editingCard.storeName,
        googleReviewUrl: editingCard.googleReviewUrl,
        price: editingCard.price ?? 50000,
        resetTaps: isLocationOrStoreChanged || resetTapsCheckbox,
      }),
    });
    if (res.ok) {
      setEditingCard(null);
      setOriginalCard(null);
      fetchCards();
    } else {
      alert("Gagal menyimpan perubahan.");
    }
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
      a.download = `QR_${card.storeName.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_")}_${card.code}.png`;
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

  const formatDate = (d: string) => {
    if (!d) return "-";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

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
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
      });
  }, [cards, searchTerm, sortBy]);

  const totalRevenue = useMemo(() => cards.reduce((s, c) => s + (c.price ?? 50000), 0), [cards]);
  const totalTaps = useMemo(() => cards.reduce((s, c) => s + (c.tapCount ?? 0), 0), [cards]);

  return (
    <>
      <AdminNav active="cards" />

      {/* Hidden QR canvases for PNG export */}
      <div style={{ position: "fixed", left: -9999, top: -9999, pointerEvents: "none" }} aria-hidden="true">
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


      {/* Main Container */}
      <div style={{ background: "#0A0A0F", minHeight: "calc(100vh - 65px)", paddingBottom: "calc(110px + env(safe-area-inset-bottom, 24px))" }}>
        <div className="mobile-container-pad" style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px" }}>

          {/* Header Title & Active Cards Pill */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                💳 Daftar Kartu Toko
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "4px 0 0" }}>
                Kelola kartu toko aktif, cetak ulang QR resolusi tinggi, atau edit data toko.
              </p>
            </div>

            {/* Single Metric: Kartu Aktif Saja */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              background: "linear-gradient(180deg, rgba(99,102,241,0.12), rgba(99,102,241,0.04))",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 12,
            }}>
              <span style={{ fontSize: "1.2rem" }}>💳</span>
              <div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Kartu Toko Aktif
                </div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#FFFFFF", lineHeight: 1.1 }}>
                  {cards.length} <span style={{ fontSize: "0.78rem", color: "#94A3B8", fontWeight: 600 }}>kartu</span>
                </div>
              </div>
            </div>
          </div>

              {/* Toolbar: Tetap sejajar (side-by-side) baik di mobile maupun desktop */}
              <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center", width: "100%", flexWrap: "nowrap" }}>
                <div style={{ flex: "1 1 auto", minWidth: 0, position: "relative" }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="🔍 Cari nama atau kode..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      paddingRight: searchTerm ? 32 : 12,
                      fontSize: "0.82rem",
                      textOverflow: "ellipsis",
                    }}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem" }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as "date" | "tap" | "name" | "price")}
                  style={{
                    flex: "0 0 auto",
                    maxWidth: "46%",
                    padding: "9px 10px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "#F0F0FF",
                    fontSize: "0.8rem",
                    outline: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
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
                          padding: "16px 18px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          background: "#111118",
                          border: "1px solid rgba(255,255,255,0.07)",
                          transition: "border-color 0.2s",
                        }}
                      >
                        {/* Row 1: Header (Store Name & Code) + Edit/Delete Buttons (Anchored) */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#F0F0FF", wordBreak: "break-word" }}>
                                {card.storeName}
                              </h3>
                              <button
                                type="button"
                                onClick={() => copyCodeText(card.code)}
                                title="Klik untuk salin kode"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                                  color: "#A5B4FC", fontFamily: "monospace", fontSize: "0.75rem",
                                  fontWeight: 700, padding: "2px 8px", borderRadius: 6, cursor: "pointer",
                                  flexShrink: 0,
                                }}
                              >
                                {card.code}
                                <span style={{ fontSize: "0.65rem" }}>{copiedCode === card.code ? "✅" : "📋"}</span>
                              </button>
                            </div>

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                              <span className="badge badge-green">● Aktif</span>
                              <Link
                                href={`/admin/taps?search=${encodeURIComponent(card.storeName)}&period=all`}
                                className="badge badge-orange"
                                style={{
                                  textDecoration: "none",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                title={`Klik untuk buka seluruh riwayat tap ${card.storeName}`}
                              >
                                👆 {card.tapCount ?? 0} Tap ↗
                              </Link>
                              {(card.tapCount ?? 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleResetTaps(card)}
                                  disabled={resettingCode === card.code}
                                  style={{
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    color: "#FCA5A5",
                                    background: "rgba(239, 68, 68, 0.12)",
                                    border: "1px solid rgba(239, 68, 68, 0.25)",
                                    borderRadius: 6,
                                    padding: "2px 7px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    transition: "all 0.15s ease",
                                  }}
                                  title={`Reset ${card.tapCount} tap kartu ini kembali ke 0`}
                                >
                                  {resettingCode === card.code ? "⏳ Mereset..." : "🔄 Reset Tap ke 0"}
                                </button>
                              )}
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                Ditambahkan: {formatDate(card.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons: Anchored top-right with clean standard app icons */}
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => startEdit(card)}
                              className="btn btn-ghost"
                              style={{ padding: "7px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}
                              title="Edit Toko"
                            >
                              <EditIcon size={14} color="#A5B4FC" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteConfirmCode(card.code)}
                              className="btn btn-danger"
                              style={{ padding: "7px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}
                              title="Hapus Kartu"
                            >
                              <TrashIcon size={14} color="#F87171" />
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Details Grid */}
                        <div style={{
                          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                          gap: 10, padding: "10px 14px", background: "rgba(0,0,0,0.3)", borderRadius: 10,
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
                            <a
                              href={getPublicGoogleReviewUrl(card.googleReviewUrl, card.storeName)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#FCD34D", textDecoration: "none", wordBreak: "break-all" }}
                              title="Buka ulasan toko di Google Search"
                            >
                              Buka Menu Ulasan ↗
                            </a>
                          </div>
                        </div>

                        {/* Row 3: Action Buttons (Riwayat Tap & High-Res QR Download) */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, alignItems: "stretch" }}>
                          <Link
                            href={`/admin/taps?search=${encodeURIComponent(card.storeName)}&period=all`}
                            className="btn btn-ghost"
                            style={{
                              justifyContent: "center",
                              padding: "9px 14px",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              color: "#C7D2FE",
                              borderColor: "rgba(99,102,241,0.35)",
                              background: "rgba(99,102,241,0.08)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              textDecoration: "none",
                              transition: "all 0.15s ease",
                            }}
                            title={`Lihat seluruh riwayat aktivitas tap pelanggan untuk ${card.storeName}`}
                          >
                            <span>📊</span>
                            <span>Lihat Riwayat Tap ({card.tapCount ?? 0}) ↗</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => downloadQrOnly(card)}
                            disabled={downloadingQrCode === card.code || !baseUrl}
                            className="btn btn-ghost"
                            style={{
                              justifyContent: "center",
                              padding: "9px 14px",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              color: "#34D399",
                              borderColor: "rgba(16,185,129,0.3)",
                              background: "rgba(16,185,129,0.06)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                            title="Download QR Code resolusi tinggi (1000px PNG) untuk cetak fisik"
                          >
                            {downloadingQrCode === card.code ? "⏳ Mengunduh QR..." : "📷 Unduh QR Code High-Res (PNG)"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                <input className="input" value={editingCard.code || ""} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
              </div>

              <div className="form-group">
                <label className="label">Nama Toko / Resto</label>
                <input
                  className="input"
                  value={editingCard.storeName || ""}
                  onChange={e => setEditingCard({ ...editingCard, storeName: e.target.value })}
                  placeholder="Nama toko binaan"
                  required
                />
              </div>

              {/* Google Place ID: Cukup edit ini jika toko pindah lokasi */}
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label className="label" style={{ marginBottom: 0 }}>
                    Google Place ID (Lokasi Toko)
                  </label>
                  <a
                    href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.7rem", color: "#A5B4FC", textDecoration: "none", fontWeight: 600 }}
                  >
                    🔍 Cari Place ID Baru ↗
                  </a>
                </div>
                <input
                  className="input"
                  value={editPlaceId}
                  onChange={e => handlePlaceIdChange(e.target.value)}
                  placeholder="cth: ChIJxxxxxxxxxxxxxxxxx"
                  maxLength={120}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                  💡 <strong>Pindah Lokasi?</strong> Cukup ganti <strong>Place ID</strong> baru di sini. URL Review Google akan otomatis diperbarui dan langsung aktif saat kartu di-tap / di-scan pelanggan.
                </p>
                {editingCard.googleReviewUrl && (
                  <div style={{ fontSize: "0.72rem", color: "#34D399", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <span>✅</span> URL Review Google aktif
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="label" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Google Review URL (Otomatis dari Place ID)
                </label>
                <input
                  className="input"
                  value={editingCard.googleReviewUrl || ""}
                  onChange={e => {
                    const url = e.target.value;
                    setEditingCard({ ...editingCard, googleReviewUrl: url });
                    const match = url.match(/placeid=([a-zA-Z0-9_\-]+)/i);
                    if (match) setEditPlaceId(match[1]);
                  }}
                  required
                  style={{ fontSize: "0.8rem", color: "#CBD5E1" }}
                />
              </div>

              <div className="form-group">
                <label className="label">Harga Jual (Rp)</label>
                <PriceStepperInput
                  value={editingCard.price ?? 50000}
                  onChange={p => setEditingCard({ ...editingCard, price: p })}
                  placeholder="50000"
                  step={5000}
                  min={0}
                />
              </div>

              {/* Deteksi jika nama toko atau URL Google Review berubah */}
              {(() => {
                const isLocationOrStoreChanged = Boolean(
                  originalCard && (
                    originalCard.storeName.trim().toLowerCase() !== editingCard.storeName.trim().toLowerCase() ||
                    originalCard.googleReviewUrl.trim() !== editingCard.googleReviewUrl.trim()
                  )
                );
                const currentTaps = originalCard?.tapCount ?? 0;

                return (
                  <>
                    {isLocationOrStoreChanged && (
                      <div style={{
                        padding: "10px 12px",
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        borderRadius: 8,
                        color: "#FDE68A",
                        fontSize: "0.76rem",
                        lineHeight: 1.5,
                        marginBottom: 12,
                      }}>
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span>⚡</span> Toko atau Lokasi Diganti
                        </div>
                        Nama toko atau Google Review telah diganti. Riwayat tap sebelumnya ({currentTaps} tap) akan otomatis di-reset ke 0 untuk toko baru.
                      </div>
                    )}

                    {currentTaps > 0 && (
                      <label style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: "0.78rem",
                        color: isLocationOrStoreChanged ? "#FCD34D" : "#CBD5E1",
                        cursor: isLocationOrStoreChanged ? "default" : "pointer",
                        marginBottom: 14,
                        padding: "8px 10px",
                        background: "rgba(255, 255, 255, 0.03)",
                        borderRadius: 8,
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}>
                        <input
                          type="checkbox"
                          checked={isLocationOrStoreChanged || resetTapsCheckbox}
                          onChange={e => setResetTapsCheckbox(e.target.checked)}
                          disabled={isLocationOrStoreChanged}
                        />
                        <span>
                          Reset hitungan tap ke 0 ({currentTaps} tap saat ini)
                          {isLocationOrStoreChanged ? " (Otomatis aktif)" : ""}
                        </span>
                      </label>
                    )}
                  </>
                );
              })()}

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

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import AdminNav from "../components/AdminNav";
import QRScanner from "../components/QRScanner";
import { PriceStepperInput } from "../components/PriceStepperInput";
import { getPublicGoogleReviewUrl, isInstagramUrl, formatInstagramUrl, extractInstagramUsername } from "../../../lib/redirect";

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
  cost?: number;
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "tap" | "name" | "price" | "profit">("date");
  const [deleteConfirmCode, setDeleteConfirmCode] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [originalCard, setOriginalCard] = useState<CardData | null>(null);
  const [resettingCode, setResettingCode] = useState<string | null>(null);
  const [editTargetType, setEditTargetType] = useState<"google" | "instagram">("google");
  const [editPlaceId, setEditPlaceId] = useState("");
  const [editInstagramUsername, setEditInstagramUsername] = useState("");
  const [editConfirmResetTaps, setEditConfirmResetTaps] = useState(false);

  function startEdit(card: CardData) {
    setEditingCard({ ...card });
    setOriginalCard(card);
    setEditConfirmResetTaps(false);
    const rawUrl = card.googleReviewUrl || "";
    if (isInstagramUrl(rawUrl)) {
      setEditTargetType("instagram");
      setEditInstagramUsername(extractInstagramUsername(rawUrl));
      setEditPlaceId("");
    } else {
      setEditTargetType("google");
      setEditInstagramUsername("");
      const match = rawUrl.match(/placeid=([a-zA-Z0-9_\-]+)/i);
      setEditPlaceId(match ? match[1] : "");
    }
  }

  function handlePlaceIdChange(rawVal: string) {
    let pid = rawVal.trim();
    // Auto-extract place ID if user pastes full URL
    const match = pid.match(/placeid=([a-zA-Z0-9_\-]+)/i);
    if (match) pid = match[1];
    setEditPlaceId(pid);
    setEditingCard(prev => prev ? {
      ...prev,
      googleReviewUrl: pid ? `https://search.google.com/local/writereview?placeid=${pid}` : "",
    } : null);
  }
  const [downloadingQrCode, setDownloadingQrCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLinkText, setCopiedLinkText] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const qrOnlyRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (editingCard || deleteConfirmCode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [editingCard, deleteConfirmCode]);

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

    let finalTargetUrl = "";
    if (editTargetType === "instagram") {
      finalTargetUrl = formatInstagramUrl(editInstagramUsername);
    } else {
      const pid = editPlaceId.trim();
      finalTargetUrl = pid
        ? `https://search.google.com/local/writereview?placeid=${pid}`
        : (editingCard.googleReviewUrl?.trim() || "");
    }

    if (!finalTargetUrl) {
      alert(editTargetType === "instagram" ? "Username atau link Instagram wajib diisi." : "Google Place ID wajib diisi.");
      return;
    }

    const isTargetChanged = Boolean(
      originalCard && originalCard.googleReviewUrl.trim() !== finalTargetUrl
    );
    const shouldResetTaps = Boolean(isTargetChanged && editConfirmResetTaps);

    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: editingCard.code,
        storeName: editingCard.storeName.trim(),
        googleReviewUrl: finalTargetUrl,
        price: editingCard.price ?? 50000,
        cost: editingCard.cost ?? 0,
        resetTaps: shouldResetTaps,
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

  function copyLinkText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLinkText(text);
      setTimeout(() => setCopiedLinkText(null), 2000);
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
        if (sortBy === "profit") return ((b.price ?? 50000) - (b.cost ?? 0)) - ((a.price ?? 50000) - (a.cost ?? 0));
        if (sortBy === "price") return (b.price ?? 50000) - (a.price ?? 50000);
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
      });
  }, [cards, searchTerm, sortBy]);

  const totalRevenue = useMemo(() => cards.reduce((s, c) => s + (c.price ?? 50000), 0), [cards]);
  const totalCost = useMemo(() => cards.reduce((s, c) => s + (c.cost ?? 0), 0), [cards]);
  const totalProfit = useMemo(() => totalRevenue - totalCost, [totalRevenue, totalCost]);
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

            {/* Metrics: Kartu Aktif & Keuntungan Bersih */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
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

              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                background: "linear-gradient(180deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 12,
              }}>
                <span style={{ fontSize: "1.2rem" }}>💰</span>
                <div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6EE7B7", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Keuntungan Bersih
                  </div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#34D399", lineHeight: 1.1 }}>
                    Rp {totalProfit.toLocaleString("id-ID")}
                  </div>
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
                  onChange={e => setSortBy(e.target.value as "date" | "tap" | "name" | "price" | "profit")}
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
                  <option value="profit" style={{ background: "#111118" }}>Keuntungan Tertinggi</option>
                  <option value="price" style={{ background: "#111118" }}>Harga Jual Tertinggi</option>
                  <option value="tap" style={{ background: "#111118" }}>Tap Terbanyak</option>
                  <option value="name" style={{ background: "#111118" }}>Nama Toko (A–Z)</option>
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

                        {/* Row 2: Details Summary (Keuntungan, Harga Jual, Modal & Target Ulasan/Instagram) */}
                        {(() => {
                          const isIg = isInstagramUrl(card.googleReviewUrl);
                          const targetUrl = getPublicGoogleReviewUrl(card.googleReviewUrl, card.storeName);
                          const cardPrice = card.price ?? 50000;
                          const cardCost = card.cost ?? 0;
                          const cardProfit = cardPrice - cardCost;
                          return (
                            <div className="card-details-summary">
                              <div className="card-finance-grid">
                                <div className="card-finance-item">
                                  <span className="card-finance-label">Untung Bersih</span>
                                  <strong style={{ color: cardProfit >= 0 ? "#34D399" : "#F87171" }} className="card-finance-val-hero">
                                    Rp {cardProfit.toLocaleString("id-ID")}
                                  </strong>
                                </div>
                                <div className="card-finance-item card-finance-divider">
                                  <span className="card-finance-label">Harga Jual</span>
                                  <span className="card-finance-val">
                                    Rp {cardPrice.toLocaleString("id-ID")}
                                  </span>
                                </div>
                                <div className="card-finance-item card-finance-divider">
                                  <span className="card-finance-label">Modal Awal</span>
                                  <span className="card-finance-val" style={{ color: cardCost > 0 ? "#CBD5E1" : "var(--text-muted)" }}>
                                    Rp {cardCost.toLocaleString("id-ID")}
                                  </span>
                                </div>
                              </div>

                              <div className="card-target-row">
                                <a
                                  href={targetUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="card-target-btn"
                                  style={{
                                    color: isIg ? "#F472B6" : "#FCD34D",
                                    background: isIg ? "rgba(236, 72, 153, 0.12)" : "rgba(245, 158, 11, 0.12)",
                                    border: `1px solid ${isIg ? "rgba(236, 72, 153, 0.28)" : "rgba(245, 158, 11, 0.25)"}`,
                                  }}
                                  title={isIg ? "Buka profil Instagram" : "Buka ulasan toko di Google Search"}
                                >
                                  <span>{isIg ? "📸" : "⭐"}</span>
                                  <span>{isIg ? "Buka Profil Instagram" : "Buka Menu Google Review"}</span>
                                  <span style={{ fontSize: "0.72rem", opacity: 0.8 }}>↗</span>
                                </a>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Row 2.5: Link NFC & Tombol Salin Cepat (Desktop & Mobile Optimized) */}
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          padding: "10px 12px",
                          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)",
                          border: "1px solid rgba(99, 102, 241, 0.2)",
                          borderRadius: 10,
                        }}>
                          {/* Top: NFC Badge + URL + Buka ↗ */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                              <span style={{
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                color: "#818CF8",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                whiteSpace: "nowrap",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "rgba(99, 102, 241, 0.15)",
                                padding: "2px 7px",
                                borderRadius: 5,
                                flexShrink: 0,
                              }}>
                                <span>📱</span> Link NFC
                              </span>
                              <a
                                href={fullCardUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: "#C7D2FE",
                                  textDecoration: "none",
                                  fontSize: "0.78rem",
                                  fontFamily: "monospace",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  minWidth: 0,
                                }}
                                title="Klik untuk membuka link kartu"
                              >
                                {fullCardUrl}
                              </a>
                            </div>

                            <a
                              href={fullCardUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: "0.74rem",
                                color: "#A5B4FC",
                                textDecoration: "none",
                                fontWeight: 600,
                                flexShrink: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.08)",
                              }}
                              title="Buka di tab baru"
                            >
                              Buka ↗
                            </a>
                          </div>

                          {/* Bottom: Tombol Salin Lebar & Nyaman untuk Mobile & Desktop */}
                          <button
                            type="button"
                            onClick={() => copyLinkText(fullCardUrl)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                              padding: "8px 14px",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              borderRadius: 8,
                              border: `1px solid ${copiedLinkText === fullCardUrl ? "rgba(16, 185, 129, 0.5)" : "rgba(99, 102, 241, 0.35)"}`,
                              background: copiedLinkText === fullCardUrl
                                ? "linear-gradient(135deg, #059669, #10B981)"
                                : "linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(79, 70, 229, 0.32))",
                              color: copiedLinkText === fullCardUrl ? "#FFFFFF" : "#E0E7FF",
                              cursor: "pointer",
                              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                              boxShadow: copiedLinkText === fullCardUrl
                                ? "0 2px 10px rgba(16, 185, 129, 0.3)"
                                : "0 2px 8px rgba(0, 0, 0, 0.15)",
                            }}
                            title="Salin seluruh link URL NFC ke clipboard"
                          >
                            <span>{copiedLinkText === fullCardUrl ? "✅" : "📋"}</span>
                            <span>{copiedLinkText === fullCardUrl ? "Link NFC Berhasil Disalin!" : "Salin Link Kartu NFC"}</span>
                          </button>
                        </div>

                        {/* Row 3: Action Buttons (Riwayat Tap & High-Res QR Download - 2 Kolom Sejajar Rapi) */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          alignItems: "stretch",
                        }}>
                          <Link
                            href={`/admin/taps?search=${encodeURIComponent(card.storeName)}&period=all`}
                            className="btn btn-ghost"
                            style={{
                              justifyContent: "center",
                              padding: "8px 10px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              color: "#C7D2FE",
                              borderColor: "rgba(99,102,241,0.35)",
                              background: "rgba(99,102,241,0.08)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              textDecoration: "none",
                              transition: "all 0.15s ease",
                              whiteSpace: "nowrap",
                            }}
                            title={`Lihat riwayat aktivitas tap ${card.storeName}`}
                          >
                            <span>📊</span>
                            <span>Riwayat ({card.tapCount ?? 0}) ↗</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => downloadQrOnly(card)}
                            disabled={downloadingQrCode === card.code || !baseUrl}
                            className="btn btn-ghost"
                            style={{
                              justifyContent: "center",
                              padding: "8px 10px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              color: "#34D399",
                              borderColor: "rgba(16,185,129,0.3)",
                              background: "rgba(16,185,129,0.06)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              whiteSpace: "nowrap",
                            }}
                            title="Download QR Code resolusi tinggi (1000px PNG) untuk cetak fisik"
                          >
                            <span>📷</span>
                            <span>{downloadingQrCode === card.code ? "Mengunduh..." : "Unduh QR"}</span>
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
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.82)",
            zIndex: 400,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
          onClick={() => setEditingCard(null)}
        >
          <div
            className="card"
            style={{
              width: "min(100%, 480px)",
              maxHeight: "min(90vh, 90dvh)",
              background: "#13131C",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              padding: 0,
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.75)",
              margin: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              background: "#151520",
              flexShrink: 0,
            }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#F0F0FF", margin: 0 }}>
                ✏️ Edit Kartu Toko
              </h2>
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="btn btn-ghost"
                style={{ padding: "4px 8px", fontSize: "0.85rem", lineHeight: 1 }}
                title="Tutup Modal"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleEditSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                  padding: "18px 20px",
                }}
              >
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

              {/* Tipe Tujuan Kartu */}
              <div className="form-group">
                <label className="label">Tipe Tujuan Kartu</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTargetType("google");
                      if (editPlaceId) {
                        setEditingCard({
                          ...editingCard,
                          googleReviewUrl: `https://search.google.com/local/writereview?placeid=${editPlaceId}`,
                        });
                      }
                    }}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 9,
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      background: editTargetType === "google"
                        ? "linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.35))"
                        : "rgba(255, 255, 255, 0.04)",
                      border: editTargetType === "google"
                        ? "1px solid rgba(245, 158, 11, 0.6)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      color: editTargetType === "google" ? "#FDE68A" : "var(--text-muted)",
                      boxShadow: editTargetType === "google" ? "0 2px 10px rgba(245, 158, 11, 0.2)" : "none",
                    }}
                  >
                    <span>⭐</span> Google Review
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditTargetType("instagram");
                      if (editInstagramUsername) {
                        setEditingCard({
                          ...editingCard,
                          googleReviewUrl: formatInstagramUrl(editInstagramUsername),
                        });
                      }
                    }}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 9,
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      background: editTargetType === "instagram"
                        ? "linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(219, 39, 119, 0.35))"
                        : "rgba(255, 255, 255, 0.04)",
                      border: editTargetType === "instagram"
                        ? "1px solid rgba(236, 72, 153, 0.6)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      color: editTargetType === "instagram" ? "#FBCFE8" : "var(--text-muted)",
                      boxShadow: editTargetType === "instagram" ? "0 2px 10px rgba(236, 72, 153, 0.2)" : "none",
                    }}
                  >
                    <span>📸</span> Instagram
                  </button>
                </div>
              </div>

              {editTargetType === "google" ? (
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
                    <div style={{
                      marginTop: 6,
                      padding: "7px 11px",
                      background: "rgba(52, 211, 153, 0.08)",
                      border: "1px solid rgba(52, 211, 153, 0.25)",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.74rem", color: "#34D399", fontWeight: 600, whiteSpace: "nowrap" }}>
                        <span>✅</span>
                        <span>Review Google Siap</span>
                      </div>
                      {editPlaceId && (
                        <span style={{
                          fontFamily: "monospace",
                          fontSize: "0.7rem",
                          color: "#A7F3D0",
                          background: "rgba(52, 211, 153, 0.15)",
                          padding: "2px 8px",
                          borderRadius: 5,
                          border: "1px solid rgba(52, 211, 153, 0.3)",
                          whiteSpace: "nowrap",
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {editPlaceId}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="label" style={{ marginBottom: 0 }}>
                      Username atau Link Instagram
                    </label>
                    {editInstagramUsername && (
                      <a
                        href={formatInstagramUrl(editInstagramUsername)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.7rem", color: "#F472B6", textDecoration: "none", fontWeight: 600 }}
                      >
                        Tes Buka Profil ↗
                      </a>
                    )}
                  </div>
                  <input
                    className="input"
                    value={editInstagramUsername}
                    onChange={e => {
                      const val = e.target.value.trim();
                      setEditInstagramUsername(val);
                      setEditingCard(prev => prev ? {
                        ...prev,
                        googleReviewUrl: val ? formatInstagramUrl(val) : "",
                      } : null);
                    }}
                    placeholder="cth: @twlve.bakehouse atau https://instagram.com/..."
                    maxLength={150}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                    💡 <strong>Ganti Akun IG?</strong> Masukkan username (dengan atau tanpa @) atau link Instagram toko yang baru.
                  </p>
                  {editingCard.googleReviewUrl && (() => {
                    const username = extractInstagramUsername(editingCard.googleReviewUrl);
                    return (
                      <div style={{
                        marginTop: 6,
                        padding: "7px 11px",
                        background: "rgba(236, 72, 153, 0.08)",
                        border: "1px solid rgba(236, 72, 153, 0.25)",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        flexWrap: "wrap",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.74rem", color: "#34D399", fontWeight: 600, whiteSpace: "nowrap" }}>
                          <span>✅</span>
                          <span style={{ color: "#FBCFE8" }}>Target Instagram Siap</span>
                        </div>
                        {username && (
                          <span style={{
                            fontFamily: "monospace",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#F472B6",
                            background: "rgba(236, 72, 153, 0.15)",
                            padding: "2px 8px",
                            borderRadius: 5,
                            border: "1px solid rgba(236, 72, 153, 0.3)",
                            whiteSpace: "nowrap",
                          }}>
                            @{username}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Harga Jual (Rp)</label>
                  <PriceStepperInput
                    value={editingCard.price ?? 50000}
                    onChange={p => setEditingCard({ ...editingCard, price: p })}
                    placeholder="50.000"
                    step={5000}
                    min={0}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="label">Modal Awal (Rp)</label>
                  <PriceStepperInput
                    value={editingCard.cost ?? 0}
                    onChange={c => setEditingCard({ ...editingCard, cost: c })}
                    placeholder="0"
                    step={5000}
                    min={0}
                    required={false}
                  />
                </div>
              </div>

              {/* Estimasi Keuntungan Bersih per kartu */}
              {(() => {
                const p = editingCard.price ?? 50000;
                const c = editingCard.cost ?? 0;
                const profit = p - c;
                return (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: profit >= 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                    border: `1px solid ${profit >= 0 ? "rgba(16, 185, 129, 0.22)" : "rgba(239, 68, 68, 0.25)"}`,
                    borderRadius: 8,
                    marginBottom: 16,
                  }}>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                      <span>💵</span>
                      <span>Untung Bersih / Kartu:</span>
                    </span>
                    <span style={{
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      color: profit >= 0 ? "#34D399" : "#F87171",
                    }}>
                      Rp {profit.toLocaleString("id-ID")}
                    </span>
                  </div>
                );
              })()}

              {/* Deteksi jika target pengalihan atau nama toko berubah saat edit */}
              {(() => {
                const currentTarget = editTargetType === "instagram"
                  ? formatInstagramUrl(editInstagramUsername)
                  : (editPlaceId ? `https://search.google.com/local/writereview?placeid=${editPlaceId}` : (editingCard.googleReviewUrl?.trim() || ""));
                const isTargetChanged = Boolean(originalCard && originalCard.googleReviewUrl.trim() !== currentTarget);
                const isStoreNameChanged = Boolean(originalCard && originalCard.storeName.trim().toLowerCase() !== editingCard.storeName.trim().toLowerCase());
                const currentTaps = originalCard?.tapCount ?? 0;

                if (isTargetChanged) {
                  return (
                    <div style={{
                      padding: "12px 14px",
                      background: "rgba(99, 102, 241, 0.08)",
                      border: "1px solid rgba(99, 102, 241, 0.28)",
                      borderRadius: 10,
                      marginBottom: 14,
                    }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#C7D2FE", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>🎯 Target Pengalihan Berubah</span>
                      </div>
                      <p style={{ fontSize: "0.73rem", color: "#94A3B8", margin: "0 0 10px", lineHeight: 1.45 }}>
                        Tujuan ulasan/Instagram kartu ini diubah. Secara bawaan, riwayat <strong>{currentTaps} tap</strong> tetap aman dan dipertahankan.
                      </p>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: "0.76rem", color: editConfirmResetTaps ? "#FCA5A5" : "#E2E8F0" }}>
                        <input
                          type="checkbox"
                          checked={editConfirmResetTaps}
                          onChange={(e) => setEditConfirmResetTaps(e.target.checked)}
                          style={{ marginTop: 2, accentColor: "#EF4444", cursor: "pointer" }}
                        />
                        <span>
                          <strong>Reset hitungan tap ke 0</strong> (Centang hanya jika kartu ini dipindahkan ke toko/klien baru)
                        </span>
                      </label>
                    </div>
                  );
                }

                if (isStoreNameChanged) {
                  return (
                    <div style={{
                      padding: "8px 12px",
                      background: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.22)",
                      borderRadius: 8,
                      color: "#6EE7B7",
                      fontSize: "0.74rem",
                      lineHeight: 1.4,
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}>
                      <span>✓</span> Nama toko diperbarui. Seluruh riwayat {currentTaps} tap tetap aman dan dipertahankan.
                    </div>
                  );
                }

                return null;
              })()}

              </div>

              {/* Sticky Footer Action Buttons */}
              <div style={{
                display: "flex",
                gap: 10,
                padding: "14px 20px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                background: "#151520",
                flexShrink: 0,
              }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setEditingCard(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                >
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

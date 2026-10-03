"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "tap" | "name">("date");
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const qrRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/Beri Kami Ulasan.png";
    img.onload = () => setBgImg(img);
  }, []);

  async function fetchCards() {
    try {
      const res = await fetch("/api/admin/codes");
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCards(); }, []);

  async function handleDelete(code: string) {
    if (!confirm(`Yakin hapus kartu "${code}"? Kartu ini tidak akan bisa dipakai lagi.`)) return;
    const res = await fetch(`/api/admin/codes/${code}`, { method: "DELETE" });
    if (res.ok) setCards(prev => prev.filter(c => c.code !== code));
    else alert("Gagal menghapus kartu.");
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
    if (res.ok) { setEditingCard(null); fetchCards(); }
    else alert("Gagal menyimpan perubahan.");
  }

  async function downloadCard(card: CardData) {
    setDownloadingCode(card.code);
    await new Promise(r => setTimeout(r, 400));
    const qrCanvas = qrRefs.current[card.code];
    if (!qrCanvas || !bgImg) {
      alert("Template belum siap, coba lagi sebentar.");
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  const filtered = cards
    .filter(c =>
      c.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "tap") return (b.tapCount || 0) - (a.tapCount || 0);
      if (sortBy === "name") return a.storeName.localeCompare(b.storeName);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalRevenue = cards.reduce((s, c) => s + (c.price ?? 50000), 0);
  const totalTaps = cards.reduce((s, c) => s + (c.tapCount ?? 0), 0);

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#0A0A0F;color:#F0F0FF;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
    .pw{max-width:1000px;margin:0 auto;padding:24px 16px 80px;}
    .topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:28px;flex-wrap:wrap;}
    .topbar h1{font-size:1.4rem;font-weight:800;}
    .topbar p{color:#9A9AB0;font-size:0.82rem;margin-top:4px;}
    .back{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:8px;color:#C0C0D8;text-decoration:none;font-size:0.82rem;font-weight:500;transition:all 0.2s;white-space:nowrap;}
    .back:hover{background:rgba(255,255,255,0.09);color:#F0F0FF;}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px;}
    .sc{background:#111118;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px 16px;}
    .sv{font-size:1.3rem;font-weight:800;margin-bottom:2px;}
    .sl{font-size:0.68rem;color:#5A5A72;font-weight:600;text-transform:uppercase;letter-spacing:.06em;}
    .toolbar{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;}
    .sbx{flex:1;min-width:180px;padding:10px 13px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#F0F0FF;font-size:.875rem;outline:none;font-family:inherit;transition:border-color .2s;}
    .sbx:focus{border-color:rgba(99,102,241,.5);}
    .ssel{padding:10px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#F0F0FF;font-size:.875rem;font-family:inherit;outline:none;cursor:pointer;}
    .ci{background:#111118;border:1px solid rgba(255,255,255,0.07);border-radius:13px;padding:16px 18px;margin-bottom:10px;transition:border-color .2s;}
    .ci:hover{border-color:rgba(99,102,241,.2);}
    .ch{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px;flex-wrap:wrap;}
    .cn{font-size:1rem;font-weight:700;color:#F0F0FF;}
    .ca{display:flex;gap:6px;flex-shrink:0;}
    .bdg{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:999px;font-size:.72rem;font-weight:600;}
    .bcode{background:rgba(99,102,241,.1);color:#A5B4FC;border:1px solid rgba(99,102,241,.2);font-family:monospace;letter-spacing:.04em;}
    .btap{background:rgba(245,158,11,.1);color:#FCD34D;border:1px solid rgba(245,158,11,.2);}
    .bact{background:rgba(16,185,129,.1);color:#34D399;border:1px solid rgba(16,185,129,.2);}
    .cm{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:10px;}
    .mi{display:flex;flex-direction:column;gap:2px;}
    .mlb{font-size:.65rem;text-transform:uppercase;letter-spacing:.05em;color:#5A5A72;font-weight:600;}
    .mv{color:#C0C0D8;font-weight:500;font-size:.82rem;}
    .ur{padding:8px 11px;background:rgba(0,0,0,.25);border-radius:7px;font-size:.73rem;}
    .ur a{color:#818CF8;text-decoration:none;word-break:break-all;}
    .ur a:hover{color:#A5B4FC;}
    .ib{width:34px;height:34px;border-radius:8px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.85rem;transition:all .15s;flex-shrink:0;}
    .ig{background:rgba(255,255,255,.05);color:#C0C0D8;border:1px solid rgba(255,255,255,.1);}
    .ig:hover{background:rgba(255,255,255,.1);}
    .idng{background:rgba(239,68,68,.08);color:#F87171;border:1px solid rgba(239,68,68,.2);}
    .idng:hover{background:rgba(239,68,68,.16);}
    .idl{background:rgba(99,102,241,.1);color:#A5B4FC;border:1px solid rgba(99,102,241,.2);}
    .idl:hover:not(:disabled){background:rgba(99,102,241,.2);}
    .idl:disabled{opacity:.4;cursor:not-allowed;}
    .mbg{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(5px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;}
    .mo{background:#13131C;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;width:min(100%,420px);max-height:90vh;overflow-y:auto;}
    .mo h2{font-size:1.05rem;font-weight:700;margin-bottom:18px;}
    .fl{display:block;font-size:.68rem;font-weight:600;color:#9A9AB0;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em;}
    .fi{width:100%;padding:10px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:#F0F0FF;font-family:inherit;font-size:.875rem;outline:none;margin-bottom:12px;transition:border-color .2s;}
    .fi:focus{border-color:rgba(99,102,241,.5);}
    .fi:disabled{opacity:.4;cursor:not-allowed;}
    .ma{display:flex;gap:8px;margin-top:16px;}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 18px;border-radius:8px;font-size:.875rem;font-weight:600;cursor:pointer;border:none;transition:all .2s;font-family:inherit;flex:1;}
    .bp{background:#4F46E5;color:white;}
    .bp:hover{background:#6366F1;}
    .bgh{background:transparent;color:#9A9AB0;border:1px solid rgba(255,255,255,.09);}
    .bgh:hover{background:rgba(255,255,255,.05);color:#F0F0FF;}
    .qrh{position:fixed;left:-9999px;top:-9999px;pointer-events:none;}
    @media(max-width:600px){.stats{grid-template-columns:repeat(2,1fr);}}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="qrh" aria-hidden="true">
        {cards.map(card => (
          <QRCodeCanvas
            key={card.code}
            value={card.googleReviewUrl}
            size={QR_SIZE}
            ref={(el: HTMLCanvasElement | null) => { qrRefs.current[card.code] = el; }}
            level="H"
            includeMargin={false}
          />
        ))}
      </div>

      <div style={{ background: "#0A0A0F", minHeight: "100vh" }}>
        <div className="pw">
          <div className="topbar">
            <div>
              <h1>🗂️ Manajemen Kartu</h1>
              <p>Lihat, edit, hapus, dan download ulang QR semua kartu yang sudah di-assign.</p>
            </div>
            <a href="/admin" className="back">← Dashboard</a>
          </div>

          <div className="stats">
            <div className="sc">
              <div className="sv" style={{ color: "#A5B4FC" }}>{cards.length}</div>
              <div className="sl">💳 Kartu Aktif</div>
            </div>
            <div className="sc">
              <div className="sv" style={{ color: "#34D399" }}>Rp {totalRevenue.toLocaleString("id-ID")}</div>
              <div className="sl">💰 Total Pendapatan</div>
            </div>
            <div className="sc">
              <div className="sv" style={{ color: "#FCD34D" }}>{totalTaps}</div>
              <div className="sl">👆 Total Tap</div>
            </div>
          </div>

          <div className="toolbar">
            <input
              type="text"
              className="sbx"
              placeholder="🔍 Cari nama toko atau kode..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <select className="ssel" value={sortBy} onChange={e => setSortBy(e.target.value as "date" | "tap" | "name")}>
              <option value="date">Terbaru</option>
              <option value="tap">Tap Terbanyak</option>
              <option value="name">Nama A–Z</option>
            </select>
          </div>

          {loading ? (
            <p style={{ color: "#9A9AB0", textAlign: "center", padding: "40px 0" }}>Memuat data...</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: "#5A5A72", textAlign: "center", padding: "40px 0" }}>
              {searchTerm ? "Tidak ada kartu yang cocok dengan pencarian." : "Belum ada kartu aktif."}
            </p>
          ) : (
            <div>
              {filtered.map(card => (
                <div key={card.code} className="ci">
                  <div className="ch">
                    <div>
                      <div className="cn">{card.storeName}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <span className="bdg bcode">{card.code}</span>
                        <span className="bdg bact">● Aktif</span>
                        <span className="bdg btap">👆 {card.tapCount ?? 0} Tap</span>
                      </div>
                    </div>
                    <div className="ca">
                      <button
                        className="ib idl"
                        onClick={() => downloadCard(card)}
                        disabled={downloadingCode === card.code || !bgImg}
                        title={!bgImg ? "Template sedang dimuat..." : "Download kartu PNG dengan QR"}
                      >
                        {downloadingCode === card.code ? "⏳" : "⬇️"}
                      </button>
                      <button className="ib ig" onClick={() => setEditingCard(card)} title="Edit">✏️</button>
                      <button className="ib idng" onClick={() => handleDelete(card.code)} title="Hapus">🗑️</button>
                    </div>
                  </div>

                  <div className="cm">
                    <div className="mi">
                      <div className="mlb">Tanggal Assign</div>
                      <div className="mv">{formatDate(card.createdAt)}</div>
                    </div>
                    <div className="mi">
                      <div className="mlb">Harga Jual</div>
                      <div className="mv" style={{ color: "#34D399" }}>Rp {(card.price ?? 50000).toLocaleString("id-ID")}</div>
                    </div>
                    <div className="mi">
                      <div className="mlb">Total Tap</div>
                      <div className="mv" style={{ color: "#FCD34D" }}>{card.tapCount ?? 0}×</div>
                    </div>
                  </div>

                  <div className="ur">
                    🔗 <a href={card.googleReviewUrl} target="_blank" rel="noreferrer">{card.googleReviewUrl}</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingCard && (
        <div className="mbg" onClick={() => setEditingCard(null)}>
          <div className="mo" onClick={e => e.stopPropagation()}>
            <h2>✏️ Edit Kartu</h2>
            <form onSubmit={handleEditSubmit}>
              <label className="fl">Kode Kartu</label>
              <input className="fi" value={editingCard.code} disabled />
              <label className="fl">Nama Toko</label>
              <input className="fi" value={editingCard.storeName} onChange={e => setEditingCard({ ...editingCard, storeName: e.target.value })} required />
              <label className="fl">Google Review URL</label>
              <input className="fi" value={editingCard.googleReviewUrl} onChange={e => setEditingCard({ ...editingCard, googleReviewUrl: e.target.value })} required />
              <label className="fl">Harga Jual (Rp)</label>
              <input className="fi" type="number" value={editingCard.price ?? 50000} onChange={e => setEditingCard({ ...editingCard, price: Number(e.target.value) })} required />
              <div className="ma">
                <button type="button" className="btn bgh" onClick={() => setEditingCard(null)}>Batal</button>
                <button type="submit" className="btn bp">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

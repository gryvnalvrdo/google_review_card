"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// ─── Konfigurasi posisi QR pada desain PNG (638 × 1004 px) ──────────────────
const CARD_W   = 638;
const CARD_H   = 1004;
const QR_SIZE  = 280;
const QR_PAD   = 22;
const BOX_SIZE = QR_SIZE + QR_PAD * 2;
const BOX_X    = Math.round((CARD_W - BOX_SIZE) / 2);
const BOX_Y    = 438;
const RADIUS   = 18;

function generateRandomCode(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

function compositeCard(bgImg: HTMLImageElement, qrCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width  = CARD_W;
  out.height = CARD_H;
  const ctx = out.getContext("2d")!;

  ctx.drawImage(bgImg, 0, 0, CARD_W, CARD_H);

  // Kotak putih rounded
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(BOX_X + RADIUS, BOX_Y);
  ctx.lineTo(BOX_X + BOX_SIZE - RADIUS, BOX_Y);
  ctx.arcTo(BOX_X + BOX_SIZE, BOX_Y,            BOX_X + BOX_SIZE, BOX_Y + RADIUS,           RADIUS);
  ctx.lineTo(BOX_X + BOX_SIZE, BOX_Y + BOX_SIZE - RADIUS);
  ctx.arcTo(BOX_X + BOX_SIZE, BOX_Y + BOX_SIZE, BOX_X + BOX_SIZE - RADIUS, BOX_Y + BOX_SIZE, RADIUS);
  ctx.lineTo(BOX_X + RADIUS, BOX_Y + BOX_SIZE);
  ctx.arcTo(BOX_X, BOX_Y + BOX_SIZE,            BOX_X, BOX_Y + BOX_SIZE - RADIUS,           RADIUS);
  ctx.lineTo(BOX_X, BOX_Y + RADIUS);
  ctx.arcTo(BOX_X, BOX_Y,                       BOX_X + RADIUS, BOX_Y,                      RADIUS);
  ctx.closePath();
  ctx.fill();

  ctx.drawImage(qrCanvas, BOX_X + QR_PAD, BOX_Y + QR_PAD, QR_SIZE, QR_SIZE);
  return out;
}

// ─── CardItem ────────────────────────────────────────────────────────────────
interface CardItemProps {
  code: string;
  url: string;
  bgImage: HTMLImageElement | null;
  onCanvasReady: (code: string, canvas: HTMLCanvasElement) => void;
}

function CardItem({ code, url, bgImage, onCanvasReady }: CardItemProps) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!bgImage) return;
    const timer = setTimeout(() => {
      const qrCanvas = document.getElementById(`qr-${code}`) as HTMLCanvasElement | null;
      if (!qrCanvas) return;
      const composed = compositeCard(bgImage, qrCanvas);
      if (previewRef.current) {
        const ctx = previewRef.current.getContext("2d")!;
        ctx.clearRect(0, 0, previewRef.current.width, previewRef.current.height);
        ctx.drawImage(composed, 0, 0, previewRef.current.width, previewRef.current.height);
      }
      onCanvasReady(code, composed);
      setReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [bgImage, code, url, onCanvasReady]);

  const previewW = 176;
  const previewH = Math.round(CARD_H * (previewW / CARD_W));

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8,
      opacity: ready ? 1 : 0.35, transition:"opacity 0.3s" }}>

      {/* Hidden QR for compositing */}
      <div style={{ position:"absolute", visibility:"hidden", pointerEvents:"none", top:-9999 }}>
        <QRCodeCanvas id={`qr-${code}`} value={url} size={QR_SIZE} level="H" marginSize={0} />
      </div>

      <div style={{ borderRadius:10, overflow:"hidden", width:previewW, height:previewH,
        background:"#111", boxShadow:"0 8px 28px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
        transition:"transform 0.2s, box-shadow 0.2s", cursor:"pointer" }}
        className="card-thumb"
      >
        <canvas ref={previewRef} width={previewW} height={previewH}
          style={{ display:"block", width:previewW, height:previewH }} />
      </div>

      <code style={{ fontSize:"0.68rem", color:"rgba(255,255,255,0.28)",
        letterSpacing:"0.1em", fontFamily:"monospace" }}>
        {code}
      </code>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PrintQRCodes() {
  const [count, setCount]       = useState(10);
  const [codes, setCodes]       = useState<string[]>([]);
  const [baseUrl, setBaseUrl]   = useState("");
  const [bgImage, setBgImage]   = useState<HTMLImageElement | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [isZipping, setIsZipping]     = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveResult, setSaveResult]   = useState<string | null>(null);
  const [progress, setProgress]       = useState("");
  const composedCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    setBaseUrl(window.location.origin);
    const img = new Image();
    img.onload  = () => { setBgImage(img); setBgLoaded(true); };
    img.onerror = () => console.error("Gagal load /card-design.png");
    img.crossOrigin = "anonymous";
    img.src = "/card-design.png";
  }, []);

  // ── Reactive count: tambah/kurangi kartu saat angka berubah ──────────────
  useEffect(() => {
    if (!bgLoaded || codes.length === 0) return; // belum generate perdana

    setCodes((prev) => {
      if (count === prev.length) return prev;
      if (count > prev.length) {
        // Tambah kode baru
        const extra: string[] = [];
        for (let i = prev.length; i < count; i++) extra.push(generateRandomCode());
        return [...prev, ...extra];
      } else {
        // Kurangi dari akhir
        const removed = prev.slice(count);
        removed.forEach((c) => composedCanvases.current.delete(c));
        return prev.slice(0, count);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, bgLoaded]);

  function handleGenerate() {
    composedCanvases.current.clear();
    setSaveResult(null);
    const newCodes: string[] = [];
    for (let i = 0; i < count; i++) newCodes.push(generateRandomCode());
    setCodes(newCodes);
  }

  const handleCanvasReady = useCallback((code: string, canvas: HTMLCanvasElement) => {
    composedCanvases.current.set(code, canvas);
  }, []);

  function handleDownloadSingle(code: string) {
    const canvas = composedCanvases.current.get(code);
    if (!canvas) return;
    canvas.toBlob((blob) => { if (blob) saveAs(blob, `Kartu_${code}.png`); }, "image/png");
  }

  async function handleDownloadZip() {
    setIsZipping(true);
    const zip = new JSZip();
    let i = 0;
    for (const [code, canvas] of composedCanvases.current) {
      i++;
      setProgress(`Menyiapkan ${i}/${composedCanvases.current.size} — ${code}`);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const ab   = await blob.arrayBuffer();
      zip.file(`Kartu_${code}.png`, ab);
    }
    setProgress("Membuat ZIP...");
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "NFC_Review_Cards.zip");
    setIsZipping(false);
    setProgress("");
  }

  async function handleSaveToStok() {
    if (codes.length === 0) return;
    setIsSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveResult(`✅ ${data.saved} kode berhasil disimpan ke stok!`);
      } else {
        setSaveResult(`❌ Gagal: ${data.error ?? "unknown error"}`);
      }
    } catch {
      setSaveResult("❌ Koneksi gagal.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; font-family: 'Inter', system-ui, sans-serif; color: white; min-height: 100vh; }

        .panel {
          background: rgba(14,14,22,0.97);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(20px);
          padding: 16px 28px;
          position: sticky; top: 0; z-index: 100;
        }
        .panel-inner { max-width: 1140px; margin: 0 auto; }
        .panel-title { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 2px; }
        .panel-sub   { font-size: 0.72rem; color: rgba(255,255,255,0.3); margin-bottom: 14px; }
        .controls    { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .ctrl-label { font-size: 0.8rem; color: rgba(255,255,255,0.45); white-space: nowrap; }
        .ctrl-input {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; color: white;
          padding: 9px 12px; font-family: inherit;
          font-size: 0.875rem; width: 78px; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ctrl-input:focus { border-color: rgba(99,102,241,0.6); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }

        /* Custom Elegant Number Input */
        .number-input-wrap {
          display: flex; align-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
          height: 38px;
        }
        .number-input-wrap:focus-within {
          border-color: rgba(99,102,241,0.6); box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .num-btn {
          background: transparent; border: none;
          color: rgba(255,255,255,0.5);
          width: 32px; height: 100%; cursor: pointer;
          font-size: 1.1rem; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .num-btn:hover { background: rgba(255,255,255,0.08); color: white; }
        .ctrl-input.num-no-spin {
          border: none; background: transparent; width: 46px;
          text-align: center; padding: 0; box-shadow: none !important;
          font-weight: 600; font-size: 0.95rem;
        }
        .ctrl-input.num-no-spin::-webkit-inner-spin-button,
        .ctrl-input.num-no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .ctrl-input.num-no-spin { -moz-appearance: textfield; }

        .btn {
          display: inline-flex; align-items: center; gap: 6px;
          border: none; border-radius: 8px; font-family: inherit;
          font-size: 0.85rem; font-weight: 600; cursor: pointer;
          padding: 10px 18px; transition: all 0.18s; white-space: nowrap;
          text-decoration: none;
        }
        .btn:active:not(:disabled) { transform: scale(0.97); }
        .btn-indigo  { background: linear-gradient(135deg,#4F46E5,#7C3AED); color: white; box-shadow: 0 4px 14px rgba(79,70,229,0.35); }
        .btn-indigo:hover:not(:disabled)  { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,70,229,0.5); }
        .btn-indigo:disabled  { opacity: 0.45; cursor: not-allowed; }
        .btn-amber   { background: linear-gradient(135deg,#b45309,#F59E0B); color: white; }
        .btn-amber:hover:not(:disabled)   { transform: translateY(-1px); }
        .btn-amber:disabled   { opacity: 0.45; cursor: not-allowed; }
        .btn-emerald { background: linear-gradient(135deg,#047857,#10B981); color: white; }
        .btn-emerald:hover:not(:disabled) { transform: translateY(-1px); }
        .btn-cyan    { background: linear-gradient(135deg,#0369a1,#06B6D4); color: white; }
        .btn-cyan:hover:not(:disabled)    { transform: translateY(-1px); }
        .btn-cyan:disabled    { opacity: 0.45; cursor: not-allowed; }
        .btn-ghost {
          background: transparent; color: rgba(165,180,252,0.65);
          border: 1px solid rgba(99,102,241,0.18); font-size: 0.8rem;
        }
        .btn-ghost:hover { color: #A5B4FC; border-color: rgba(99,102,241,0.35); }
        .spacer { margin-left: auto; }

        /* Counter badge */
        .count-badge {
          display: inline-flex; align-items: center;
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
          color: #A5B4FC; border-radius: 999px; padding: 4px 12px;
          font-size: 0.75rem; font-weight: 700;
        }

        .progress-pill {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
          color: #A5B4FC; border-radius: 999px; padding: 6px 14px;
          font-size: 0.75rem; font-weight: 600;
        }
        .spin { display: inline-block; width: 10px; height: 10px; border: 2px solid rgba(165,180,252,0.3); border-top-color: #A5B4FC; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Save result toast */
        .save-toast {
          margin-top: 10px;
          font-size: 0.8rem;
          padding: 8px 14px;
          border-radius: 8px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.25);
          color: #6EE7B7;
          display: inline-block;
        }
        .save-toast.err {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.25);
          color: #FCA5A5;
        }

        /* Grid */
        .grid-area { max-width: 1140px; margin: 0 auto; padding: 26px 24px 100px; }
        .grid-meta { font-size: 0.78rem; color: rgba(255,255,255,0.28); margin-bottom: 18px; }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
          gap: 20px;
        }

        .card-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: pointer;
        }
        .card-wrap:hover .card-thumb {
          transform: translateY(-4px);
          box-shadow: 0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.13) !important;
        }
        .card-wrap:hover .dl-hint { opacity: 1; }
        .dl-hint { opacity: 0; font-size: 0.67rem; color: rgba(165,180,252,0.7); transition: opacity 0.2s; }

        .empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 62vh; gap: 14px; text-align: center;
        }
        .empty-icon  { font-size: 3.5rem; opacity: 0.22; }
        .empty-title { font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.32); }
        .empty-sub   { font-size: 0.82rem; color: rgba(255,255,255,0.16); max-width: 300px; line-height: 1.7; }

        @media print {
          .panel { display: none !important; }
          .grid-area { padding: 5mm !important; max-width: none !important; }
          .cards-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 5mm !important; }
          .dl-hint { display: none !important; }
          .card-thumb { box-shadow: none !important; }
        }
      `}</style>

      {/* ── Panel ── */}
      <div className="panel">
        <div className="panel-inner">
          <div className="panel-title">🎴 Generator Kartu NFC Review</div>
          <div className="panel-sub">Desain kamu + QR unik tiap kartu — download PNG atau simpan ke inventori stok</div>

          <div className="controls">
            <span className="ctrl-label">Jumlah kartu:</span>
            
            <div className="number-input-wrap">
              <button 
                className="num-btn" 
                onClick={() => setCount((c) => Math.max(1, c - 1))}
              >−</button>
              <input
                type="number"
                className="ctrl-input num-no-spin"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value))))}
                min={1} max={200}
              />
              <button 
                className="num-btn" 
                onClick={() => setCount((c) => Math.min(200, c + 1))}
              >+</button>
            </div>

            {/* Badge count real-time */}
            {codes.length > 0 && (
              <span className="count-badge">{codes.length} kartu</span>
            )}

            <button className="btn btn-indigo" onClick={handleGenerate} disabled={!bgLoaded}>
              {bgLoaded ? "✨ Generate Kartu" : "⏳ Loading..."}
            </button>

            {codes.length > 0 && !isZipping && !isSaving && (
              <>
                {/* Simpan ke stok inventori */}
                <button className="btn btn-cyan" onClick={handleSaveToStok}>
                  💾 Simpan ke Stok
                </button>

                <button className="btn btn-amber" onClick={handleDownloadZip}>
                  📦 Download ZIP
                </button>

                <button className="btn btn-emerald" onClick={() => window.print()}>
                  🖨️ Print
                </button>
              </>
            )}

            {(isZipping || isSaving) && (
              <div className="progress-pill">
                <span className="spin" />
                {isSaving ? "Menyimpan ke stok..." : progress}
              </div>
            )}

            <a href="/admin" className="btn btn-ghost spacer">← Dashboard</a>
          </div>

          {/* Save result toast */}
          {saveResult && (
            <div className={`save-toast ${saveResult.startsWith("❌") ? "err" : ""}`}>
              {saveResult}
            </div>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="grid-area">
        {codes.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎴</div>
            <div className="empty-title">Belum ada kartu</div>
            <div className="empty-sub">
              Atur jumlah lalu klik <strong>Generate Kartu</strong>.<br />
              Ubah angka kapan saja — kartu langsung menyesuaikan otomatis.<br />
              Setelah puas, klik <strong>💾 Simpan ke Stok</strong> agar kode terlacak di dashboard.
            </div>
          </div>
        ) : (
          <>
            <div className="grid-meta">
              {codes.length} kartu · klik kartu untuk download satu PNG
            </div>
            <div className="cards-grid">
              {codes.map((code) => (
                <div key={code} className="card-wrap" onClick={() => handleDownloadSingle(code)}>
                  <CardItem
                    code={code}
                    url={`${baseUrl}/c/${code}`}
                    bgImage={bgImage}
                    onCanvasReady={handleCanvasReady}
                  />
                  <span className="dl-hint">⬇ download PNG</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

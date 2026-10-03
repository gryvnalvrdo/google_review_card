"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// ─── Konfigurasi posisi QR pada desain PNG (638 × 1004 px) ──────────────────
const CARD_W  = 638;
const CARD_H  = 1004;
const QR_SIZE = 280;       // ukuran QR code (px)
const QR_PAD  = 22;        // padding putih di sekeliling QR
const BOX_SIZE = QR_SIZE + QR_PAD * 2;
const BOX_X   = Math.round((CARD_W - BOX_SIZE) / 2);  // centered
const BOX_Y   = 438;       // dari atas — sesuai area kosong desain
const RADIUS  = 18;        // rounded corners kotak putih

function generateRandomCode(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

/** Render satu canvas dari background image + QR canvas yang sudah di-render di DOM */
function compositeCard(bgImg: HTMLImageElement, qrCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width  = CARD_W;
  out.height = CARD_H;
  const ctx = out.getContext("2d")!;

  // 1. Background desain
  ctx.drawImage(bgImg, 0, 0, CARD_W, CARD_H);

  // 2. Kotak putih rounded
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(BOX_X + RADIUS, BOX_Y);
  ctx.lineTo(BOX_X + BOX_SIZE - RADIUS, BOX_Y);
  ctx.arcTo(BOX_X + BOX_SIZE, BOX_Y,           BOX_X + BOX_SIZE, BOX_Y + RADIUS,          RADIUS);
  ctx.lineTo(BOX_X + BOX_SIZE, BOX_Y + BOX_SIZE - RADIUS);
  ctx.arcTo(BOX_X + BOX_SIZE, BOX_Y + BOX_SIZE, BOX_X + BOX_SIZE - RADIUS, BOX_Y + BOX_SIZE, RADIUS);
  ctx.lineTo(BOX_X + RADIUS, BOX_Y + BOX_SIZE);
  ctx.arcTo(BOX_X, BOX_Y + BOX_SIZE,            BOX_X, BOX_Y + BOX_SIZE - RADIUS,          RADIUS);
  ctx.lineTo(BOX_X, BOX_Y + RADIUS);
  ctx.arcTo(BOX_X, BOX_Y,                       BOX_X + RADIUS, BOX_Y,                     RADIUS);
  ctx.closePath();
  ctx.fill();

  // 3. Gambar QR dari canvas qrcode.react
  ctx.drawImage(qrCanvas, BOX_X + QR_PAD, BOX_Y + QR_PAD, QR_SIZE, QR_SIZE);

  return out;
}

// ─── Komponen satu kartu (menyimpan ref ke canvas QR yang di-render) ─────────
interface CardItemProps {
  code: string;
  url: string;
  bgImage: HTMLImageElement | null;
  onCanvasReady: (code: string, canvas: HTMLCanvasElement) => void;
}

function CardItem({ code, url, bgImage, onCanvasReady }: CardItemProps) {
  const qrRef       = useRef<HTMLCanvasElement | null>(null);
  const previewRef  = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  // Setelah QR code ter-render, composite & tampilkan preview
  useEffect(() => {
    if (!bgImage) return;

    // qrcode.react render ke canvas dengan id tertentu
    const timer = setTimeout(() => {
      const qrCanvas = document.getElementById(`qr-${code}`) as HTMLCanvasElement | null;
      if (!qrCanvas) return;

      const composed = compositeCard(bgImage, qrCanvas);

      // Tampilkan di preview canvas (scale down)
      if (previewRef.current) {
        const ctx = previewRef.current.getContext("2d")!;
        ctx.clearRect(0, 0, previewRef.current.width, previewRef.current.height);
        ctx.drawImage(composed, 0, 0, previewRef.current.width, previewRef.current.height);
      }

      onCanvasReady(code, composed);
      setReady(true);
    }, 80); // tunggu qrcode.react selesai render

    return () => clearTimeout(timer);
  }, [bgImage, code, url, onCanvasReady]);

  const previewW = 176;
  const previewH = Math.round(CARD_H * (previewW / CARD_W));

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      opacity: ready ? 1 : 0.4,
      transition: "opacity 0.3s",
    }}>
      {/* QR code tersembunyi (hanya untuk compositing) */}
      <div style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", top: -9999 }}>
        <QRCodeCanvas
          id={`qr-${code}`}
          value={url}
          size={QR_SIZE}
          level="H"
          marginSize={0}
        />
      </div>

      {/* Preview canvas */}
      <div style={{
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
        width: previewW,
        height: previewH,
        background: "#111",
        flexShrink: 0,
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
        className="card-preview"
      >
        <canvas
          ref={previewRef}
          width={previewW}
          height={previewH}
          style={{ display: "block", width: previewW, height: previewH }}
        />
      </div>

      <code style={{
        fontSize: "0.68rem",
        color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.1em",
        fontFamily: "monospace",
      }}>
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
  const [isZipping, setIsZipping]   = useState(false);
  const [progress, setProgress]     = useState("");
  const composedCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    setBaseUrl(window.location.origin);

    const img = new Image();
    img.onload  = () => { setBgImage(img); setBgLoaded(true); };
    img.onerror = () => console.error("Gagal load /card-design.png");
    img.crossOrigin = "anonymous";
    img.src = "/card-design.png";
  }, []);

  function handleGenerate() {
    composedCanvases.current.clear();
    const newCodes: string[] = [];
    for (let i = 0; i < count; i++) newCodes.push(generateRandomCode());
    setCodes(newCodes);
  }

  function handleCanvasReady(code: string, canvas: HTMLCanvasElement) {
    composedCanvases.current.set(code, canvas);
  }

  function handleDownloadSingle(code: string) {
    const canvas = composedCanvases.current.get(code);
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) saveAs(blob, `Kartu_${code}.png`);
    }, "image/png");
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

  const readyCount = composedCanvases.current.size;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #0a0a0f;
          font-family: 'Inter', system-ui, sans-serif;
          color: white;
          min-height: 100vh;
        }

        .panel {
          background: rgba(14,14,22,0.97);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(20px);
          padding: 18px 28px;
          position: sticky; top: 0; z-index: 100;
        }
        .panel-inner { max-width: 1140px; margin: 0 auto; }
        .panel-title { font-size: 1rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
        .panel-sub   { font-size: 0.72rem; color: rgba(255,255,255,0.3); margin-top: 2px; margin-bottom: 16px; }

        .controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .ctrl-label { font-size: 0.8rem; color: rgba(255,255,255,0.45); white-space: nowrap; }
        .ctrl-input {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; color: white;
          padding: 9px 12px; font-family: inherit;
          font-size: 0.875rem; width: 78px; outline: none;
        }
        .ctrl-input:focus { border-color: rgba(99,102,241,0.6); box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }

        .btn {
          display: inline-flex; align-items: center; gap: 6px;
          border: none; border-radius: 8px; font-family: inherit;
          font-size: 0.85rem; font-weight: 600; cursor: pointer;
          padding: 10px 18px; transition: all 0.18s; white-space: nowrap;
          text-decoration: none;
        }
        .btn:active:not(:disabled) { transform: scale(0.97); }
        .btn-indigo { background: linear-gradient(135deg,#4F46E5,#7C3AED); color: white; box-shadow: 0 4px 14px rgba(79,70,229,0.35); }
        .btn-indigo:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,70,229,0.5); }
        .btn-indigo:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn-amber  { background: linear-gradient(135deg,#b45309,#F59E0B); color: white; }
        .btn-amber:hover:not(:disabled)  { transform: translateY(-1px); }
        .btn-amber:disabled  { opacity: 0.45; cursor: not-allowed; }
        .btn-emerald{ background: linear-gradient(135deg,#047857,#10B981); color: white; }
        .btn-emerald:hover { transform: translateY(-1px); }
        .btn-ghost {
          background: transparent; color: rgba(165,180,252,0.65);
          border: 1px solid rgba(99,102,241,0.18); font-size: 0.8rem;
        }
        .btn-ghost:hover { color: #A5B4FC; border-color: rgba(99,102,241,0.35); }

        .spacer { margin-left: auto; }

        .progress-pill {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
          color: #A5B4FC; border-radius: 999px; padding: 6px 14px;
          font-size: 0.75rem; font-weight: 600;
        }
        .spin { display: inline-block; width: 10px; height: 10px; border: 2px solid rgba(165,180,252,0.3); border-top-color: #A5B4FC; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Grid */
        .grid-area { max-width: 1140px; margin: 0 auto; padding: 28px 24px 100px; }
        .grid-meta { font-size: 0.78rem; color: rgba(255,255,255,0.28); margin-bottom: 18px; }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
          gap: 22px;
        }

        .card-preview-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          cursor: pointer;
        }
        .card-preview-wrap:hover .card-preview { transform: translateY(-4px) scale(1.01); box-shadow: 0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.12) !important; }
        .card-preview-wrap:hover .dl-label { opacity: 1; }
        .card-preview {
          border-radius: 10px; overflow: hidden;
          box-shadow: 0 8px 28px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.07);
          transition: transform 0.2s, box-shadow 0.2s;
          background: #111;
        }
        .dl-label {
          opacity: 0; font-size: 0.68rem; color: rgba(165,180,252,0.7);
          transition: opacity 0.2s; display: flex; align-items: center; gap: 4px;
        }

        .empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 65vh; gap: 14px; text-align: center;
        }
        .empty-icon  { font-size: 3.5rem; opacity: 0.25; }
        .empty-title { font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.32); }
        .empty-sub   { font-size: 0.82rem; color: rgba(255,255,255,0.16); max-width: 300px; line-height: 1.7; }

        @media print {
          .panel { display: none !important; }
          .grid-area { padding: 5mm !important; max-width: none !important; }
          .cards-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 5mm !important; }
          .dl-label { display: none !important; }
          .card-preview { box-shadow: none !important; }
        }
      `}</style>

      {/* Panel */}
      <div className="panel">
        <div className="panel-inner">
          <div className="panel-title">🎴 Generator Kartu NFC Review</div>
          <div className="panel-sub">Desain kartu kamu + QR unik tiap kartu — siap cetak atau download PNG</div>

          <div className="controls">
            <span className="ctrl-label">Jumlah kartu:</span>
            <input
              type="number"
              className="ctrl-input"
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value))))}
              min={1} max={200}
            />

            <button
              className="btn btn-indigo"
              onClick={handleGenerate}
              disabled={!bgLoaded}
            >
              {bgLoaded ? "✨ Generate Kartu" : "⏳ Loading desain..."}
            </button>

            {codes.length > 0 && !isZipping && (
              <>
                <button
                  className="btn btn-amber"
                  onClick={handleDownloadZip}
                  disabled={composedCanvases.current.size === 0}
                >
                  📦 Download Semua (ZIP)
                </button>
                <button className="btn btn-emerald" onClick={() => window.print()}>
                  🖨️ Print
                </button>
              </>
            )}

            {isZipping && (
              <div className="progress-pill">
                <span className="spin" />
                {progress}
              </div>
            )}

            <a href="/admin" className="btn btn-ghost spacer">← Dashboard</a>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid-area">
        {codes.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎴</div>
            <div className="empty-title">Belum ada kartu</div>
            <div className="empty-sub">
              Atur jumlah lalu klik <strong>Generate Kartu</strong>.<br />
              Setiap kartu = desain kamu + QR unik di dalam kotak putih.
            </div>
          </div>
        ) : (
          <>
            <div className="grid-meta">
              {codes.length} kartu · klik kartu untuk download satu PNG
            </div>
            <div className="cards-grid">
              {codes.map((code) => (
                <div
                  key={code}
                  className="card-preview-wrap"
                  onClick={() => handleDownloadSingle(code)}
                >
                  <CardItem
                    code={code}
                    url={`${baseUrl}/c/${code}`}
                    bgImage={bgImage}
                    onCanvasReady={handleCanvasReady}
                  />
                  <span className="dl-label">⬇ download PNG</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

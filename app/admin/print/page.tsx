"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import AdminNav from "../components/AdminNav";

// ─── Default Configuration for Standard Card ─────────────────────────────────
const DEFAULT_CARD_W = 638;
const DEFAULT_CARD_H = 1004;
const DEFAULT_QR_SIZE = 280;
const DEFAULT_QR_PAD = 22;
const DEFAULT_BOX_SIZE = DEFAULT_QR_SIZE + DEFAULT_QR_PAD * 2;
const DEFAULT_BOX_X = Math.round((DEFAULT_CARD_W - DEFAULT_BOX_SIZE) / 2);
const DEFAULT_BOX_Y = 438;

export interface QRPlacementConfig {
  x: number;
  y: number;
  size: number;
  style: "transparent" | "white_box";
  padding: number;
  radius: number;
}

const DEFAULT_PLACEMENT: QRPlacementConfig = {
  x: DEFAULT_BOX_X + DEFAULT_QR_PAD,
  y: DEFAULT_BOX_Y + DEFAULT_QR_PAD,
  size: DEFAULT_QR_SIZE,
  style: "white_box",
  padding: DEFAULT_QR_PAD,
  radius: 18,
};

function generateRandomCode(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

function compositeCard(
  bgImg: HTMLImageElement,
  qrCanvas: HTMLCanvasElement,
  placement: QRPlacementConfig
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const cardW = bgImg.naturalWidth || DEFAULT_CARD_W;
  const cardH = bgImg.naturalHeight || DEFAULT_CARD_H;
  out.width = cardW;
  out.height = cardH;
  const ctx = out.getContext("2d")!;

  // 1. Gambar latar desain (bisa template bawaan atau custom klien)
  ctx.drawImage(bgImg, 0, 0, cardW, cardH);

  const qrX = placement.x;
  const qrY = placement.y;
  const qrSize = placement.size;

  // 2. Kotak putih rounded (jika dipilih opsi white_box)
  if (placement.style === "white_box") {
    const pad = placement.padding || 20;
    const rad = placement.radius || 18;
    const boxX = qrX - pad;
    const boxY = qrY - pad;
    const boxSize = qrSize + pad * 2;

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(boxX + rad, boxY);
    ctx.lineTo(boxX + boxSize - rad, boxY);
    ctx.arcTo(boxX + boxSize, boxY, boxX + boxSize, boxY + rad, rad);
    ctx.lineTo(boxX + boxSize, boxY + boxSize - rad);
    ctx.arcTo(boxX + boxSize, boxY + boxSize, boxX + boxSize - rad, boxY + boxSize, rad);
    ctx.lineTo(boxX + rad, boxY + boxSize);
    ctx.arcTo(boxX, boxY + boxSize, boxX, boxY + boxSize - rad, rad);
    ctx.lineTo(boxX, boxY + rad);
    ctx.arcTo(boxX, boxY, boxX + rad, boxY, rad);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Gambar QR code di atas kanvas
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  return out;
}

// ─── CardItem ────────────────────────────────────────────────────────────────
interface CardItemProps {
  code: string;
  url: string;
  bgImage: HTMLImageElement | null;
  placement: QRPlacementConfig;
  onCanvasReady: (code: string, canvas: HTMLCanvasElement) => void;
}

function CardItem({ code, url, bgImage, placement, onCanvasReady }: CardItemProps) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!bgImage) return;
    const timer = setTimeout(() => {
      const qrCanvas = document.getElementById(`qr-${code}`) as HTMLCanvasElement | null;
      if (!qrCanvas) return;
      const composed = compositeCard(bgImage, qrCanvas, placement);
      if (previewRef.current) {
        const ctx = previewRef.current.getContext("2d")!;
        ctx.clearRect(0, 0, previewRef.current.width, previewRef.current.height);
        ctx.drawImage(composed, 0, 0, previewRef.current.width, previewRef.current.height);
      }
      onCanvasReady(code, composed);
      setReady(true);
    }, 60);
    return () => clearTimeout(timer);
  }, [bgImage, code, url, placement, onCanvasReady]);

  const cardW = bgImage?.naturalWidth || DEFAULT_CARD_W;
  const cardH = bgImage?.naturalHeight || DEFAULT_CARD_H;
  const previewW = 176;
  const previewH = Math.round(cardH * (previewW / cardW));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: ready ? 1 : 0.35, transition: "opacity 0.3s" }}>
      {/* Hidden QR for compositing (High resolution) */}
      <div style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", top: -9999 }}>
        <QRCodeCanvas id={`qr-${code}`} value={url} size={Math.max(placement.size, 450)} level="H" marginSize={0} />
      </div>

      <div
        style={{
          borderRadius: 10,
          overflow: "hidden",
          width: previewW,
          height: previewH,
          background: "#111",
          boxShadow: "0 8px 28px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)",
          transition: "transform 0.2s, box-shadow 0.2s",
          cursor: "pointer",
        }}
        className="card-thumb"
      >
        <canvas ref={previewRef} width={previewW} height={previewH} style={{ display: "block", width: previewW, height: previewH }} />
      </div>

      <code style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em", fontFamily: "monospace" }}>
        {code}
      </code>
    </div>
  );
}

export default function PrintQRCodes() {
  const [count, setCount] = useState(10);
  const [codes, setCodes] = useState<string[]>([]);
  const [baseUrl, setBaseUrl] = useState("");

  // Template State
  const [templateMode, setTemplateMode] = useState<"default" | "custom">("default");
  const [customImageName, setCustomImageName] = useState<string>("");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [defaultImg, setDefaultImg] = useState<HTMLImageElement | null>(null);
  const [customImg, setCustomImg] = useState<HTMLImageElement | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);

  // QR Placement State
  const [placement, setPlacement] = useState<QRPlacementConfig>(DEFAULT_PLACEMENT);
  const [showPlacementEditor, setShowPlacementEditor] = useState(false);

  const [isZipping, setIsZipping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const composedCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load default template on mount
  useEffect(() => {
    setBaseUrl(window.location.origin);
    const img = new Image();
    img.onload = () => {
      setDefaultImg(img);
      setBgImage(img);
      setBgLoaded(true);
    };
    img.onerror = () => console.error("Gagal load /card-design.png");
    img.crossOrigin = "anonymous";
    img.src = "/card-design.png";

    // Cek jika ada custom template tersimpan di localStorage
    try {
      const savedConfig = localStorage.getItem("custom_qr_placement");
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.placement) setPlacement(parsed.placement);
      }
    } catch (e) {
      console.warn("Could not read saved placement:", e);
    }
  }, []);

  // Handle Switch Mode Template
  function handleSelectMode(mode: "default" | "custom") {
    setTemplateMode(mode);
    composedCanvases.current.clear();
    if (mode === "default") {
      if (defaultImg) {
        setBgImage(defaultImg);
        setPlacement(DEFAULT_PLACEMENT);
      }
    } else {
      if (customImg) {
        setBgImage(customImg);
      } else {
        // Trigger upload jika belum ada custom template
        fileInputRef.current?.click();
      }
    }
  }

  // Handle File Upload Desain Klien
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setCustomImg(img);
        setBgImage(img);
        setTemplateMode("custom");
        setShowPlacementEditor(true);

        const cardW = img.naturalWidth;
        const cardH = img.naturalHeight;

        // Auto default placement di tengah desain klien (seperti contoh Purs Coffee)
        const initialSize = Math.round(Math.min(cardW, cardH) * 0.42);
        const initialX = Math.round((cardW - initialSize) / 2);
        const initialY = Math.round((cardH - initialSize) / 2);

        const newPlacement: QRPlacementConfig = {
          x: initialX,
          y: initialY,
          size: initialSize,
          style: "transparent", // transparan agar menyatu dengan kotak kuning Purs Coffee
          padding: 16,
          radius: 16,
        };

        setPlacement(newPlacement);
        composedCanvases.current.clear();

        // Simpan ke localStorage
        try {
          localStorage.setItem("custom_qr_placement", JSON.stringify({ placement: newPlacement }));
        } catch {}
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    // Reset file input agar bisa upload file sama jika diubah
    e.target.value = "";
  }

  // Quick Center Helpers
  function handleCenterHorizontal() {
    if (!bgImage) return;
    const cardW = bgImage.naturalWidth || DEFAULT_CARD_W;
    setPlacement((prev) => ({
      ...prev,
      x: Math.round((cardW - prev.size) / 2),
    }));
  }

  function handleCenterVertical() {
    if (!bgImage) return;
    const cardH = bgImage.naturalHeight || DEFAULT_CARD_H;
    setPlacement((prev) => ({
      ...prev,
      y: Math.round((cardH - prev.size) / 2),
    }));
  }

  function handleCenterFull() {
    if (!bgImage) return;
    const cardW = bgImage.naturalWidth || DEFAULT_CARD_W;
    const cardH = bgImage.naturalHeight || DEFAULT_CARD_H;
    setPlacement((prev) => ({
      ...prev,
      x: Math.round((cardW - prev.size) / 2),
      y: Math.round((cardH - prev.size) / 2),
    }));
  }

  // ── Reactive count: tambah/kurangi kartu saat angka berubah ──────────────
  useEffect(() => {
    if (!bgLoaded || codes.length === 0) return;

    setCodes((prev) => {
      if (count === prev.length) return prev;
      if (count > prev.length) {
        const extra: string[] = [];
        for (let i = prev.length; i < count; i++) extra.push(generateRandomCode());
        return [...prev, ...extra];
      } else {
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
      const ab = await blob.arrayBuffer();
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

  const cardW = bgImage?.naturalWidth || DEFAULT_CARD_W;
  const cardH = bgImage?.naturalHeight || DEFAULT_CARD_H;

  return (
    <>
      <AdminNav active="print" />

      {/* Hidden File Input for Custom Design Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      {/* ── Panel Kontrol Utama ── */}
      <div className="print-panel">
        <div className="print-panel-inner">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div className="print-panel-title">🎴 Mesin Cetak QR Code &amp; Desain Kartu</div>
              <div className="print-panel-sub">
                Cetak massal QR code unik di atas template standar maupun desain custom klien (seperti Purs Coffee).
              </div>
            </div>

            {/* Template Status Pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>Dimensi Kartu:</span>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0" }}>
                {cardW} × {cardH} px
              </span>
            </div>
          </div>

          {/* ── Template Selection Bar ── */}
          <div className="template-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#EDE9FE" }}>Pilihan Template:</span>
              <div className="template-toggle-group">
                <button
                  type="button"
                  className={`template-toggle-btn ${templateMode === "default" ? "active" : ""}`}
                  onClick={() => handleSelectMode("default")}
                >
                  💳 Standar Hantic
                </button>
                <button
                  type="button"
                  className={`template-toggle-btn ${templateMode === "custom" ? "active" : ""}`}
                  onClick={() => handleSelectMode("custom")}
                >
                  🎨 Desain Klien {customImageName ? `(${customImageName.slice(0, 15)}...)` : "(Custom)"}
                </button>
              </div>

              {/* Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="print-btn print-btn-ghost"
                style={{ fontSize: "0.76rem", padding: "6px 12px" }}
              >
                📁 Upload Gambar Desain {customImg ? "Baru" : ""}
              </button>
            </div>

            {/* Toggle Editor Penyesuaian QR */}
            <button
              type="button"
              onClick={() => setShowPlacementEditor((v) => !v)}
              className="print-btn print-btn-ghost"
              style={{
                fontSize: "0.76rem",
                padding: "6px 12px",
                borderColor: showPlacementEditor ? "rgba(99,102,241,0.5)" : undefined,
                background: showPlacementEditor ? "rgba(99,102,241,0.15)" : undefined,
                color: showPlacementEditor ? "#A5B4FC" : undefined,
              }}
            >
              {showPlacementEditor ? "✕ Tutup Posisi QR" : "⚙️ Atur Posisi & Ukuran QR"}
            </button>
          </div>

          {/* ── QR Placement & Position Adjuster Panel ── */}
          {showPlacementEditor && (
            <div className="placement-editor">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#F8FAFC", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🎯</span> Penempatan QR Code di Atas Kartu
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#94A3B8" }}>
                    Geser slider di bawah ini agar QR tepat berada di dalam space kosong kartu klien Anda.
                  </div>
                </div>

                {/* Quick Auto Center Buttons */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" onClick={handleCenterHorizontal} className="print-btn print-btn-ghost" style={{ padding: "5px 10px", fontSize: "0.72rem" }} title="Pusatkan posisi QR secara horizontal">
                    🎯 Auto-Center X
                  </button>
                  <button type="button" onClick={handleCenterVertical} className="print-btn print-btn-ghost" style={{ padding: "5px 10px", fontSize: "0.72rem" }} title="Pusatkan posisi QR secara vertikal">
                    🎯 Auto-Center Y
                  </button>
                  <button type="button" onClick={handleCenterFull} className="print-btn print-btn-ghost" style={{ padding: "5px 10px", fontSize: "0.72rem", color: "#34D399", borderColor: "rgba(16,185,129,0.3)" }} title="Pusatkan tepat di tengah-tengah kartu">
                    ✨ Tengah Penuh
                  </button>
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="slider-row">
                {/* Posisi X */}
                <div className="slider-item">
                  <div className="slider-header">
                    <span>Posisi X (Kiri ↔ Kanan):</span>
                    <strong style={{ color: "#A5B4FC" }}>{placement.x} px</strong>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min={0}
                    max={Math.max(cardW - placement.size, 100)}
                    value={placement.x}
                    onChange={(e) => setPlacement((p) => ({ ...p, x: Number(e.target.value) }))}
                  />
                </div>

                {/* Posisi Y */}
                <div className="slider-item">
                  <div className="slider-header">
                    <span>Posisi Y (Atas ↕ Bawah):</span>
                    <strong style={{ color: "#A5B4FC" }}>{placement.y} px</strong>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min={0}
                    max={Math.max(cardH - placement.size, 100)}
                    value={placement.y}
                    onChange={(e) => setPlacement((p) => ({ ...p, y: Number(e.target.value) }))}
                  />
                </div>

                {/* Ukuran QR */}
                <div className="slider-item">
                  <div className="slider-header">
                    <span>Ukuran QR Code:</span>
                    <strong style={{ color: "#34D399" }}>{placement.size} × {placement.size} px</strong>
                  </div>
                  <input
                    type="range"
                    className="slider-input"
                    min={60}
                    max={Math.min(cardW, cardH)}
                    value={placement.size}
                    onChange={(e) => setPlacement((p) => ({ ...p, size: Number(e.target.value) }))}
                  />
                </div>

                {/* Gaya Latar QR */}
                <div className="slider-item">
                  <div className="slider-header">
                    <span>Gaya Latar QR:</span>
                    <strong style={{ color: placement.style === "transparent" ? "#FBBF24" : "#FFF" }}>
                      {placement.style === "transparent" ? "Transparan (Langsung)" : "Kotak Putih Rounded"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => setPlacement((p) => ({ ...p, style: "transparent" }))}
                      className="print-btn"
                      style={{
                        flex: 1, padding: "5px 8px", fontSize: "0.72rem",
                        background: placement.style === "transparent" ? "rgba(245, 158, 11, 0.2)" : "rgba(255,255,255,0.04)",
                        border: placement.style === "transparent" ? "1px solid #F59E0B" : "1px solid rgba(255,255,255,0.08)",
                        color: placement.style === "transparent" ? "#FCD34D" : "#94A3B8",
                      }}
                    >
                      ✨ Transparan (Purs)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlacement((p) => ({ ...p, style: "white_box" }))}
                      className="print-btn"
                      style={{
                        flex: 1, padding: "5px 8px", fontSize: "0.72rem",
                        background: placement.style === "white_box" ? "rgba(99, 102, 241, 0.2)" : "rgba(255,255,255,0.04)",
                        border: placement.style === "white_box" ? "1px solid #6366F1" : "1px solid rgba(255,255,255,0.08)",
                        color: placement.style === "white_box" ? "#C4B5FD" : "#94A3B8",
                      }}
                    >
                      ⬜ Kotak Putih
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tombol Generator & Aksi ── */}
          <div className="print-controls">
            <span className="print-ctrl-label">Jumlah kartu:</span>

            <div className="print-number-input-wrap">
              <button className="print-num-btn" onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
              <input
                type="number"
                className="print-ctrl-input num-no-spin"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value))))}
                min={1} max={200}
              />
              <button className="print-num-btn" onClick={() => setCount((c) => Math.min(200, c + 1))}>+</button>
            </div>

            {/* Quick Presets */}
            <div style={{ display: "flex", gap: 4 }}>
              {[10, 20, 50, 100].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className="print-btn print-btn-ghost"
                  style={{
                    padding: "6px 10px", fontSize: "0.75rem", borderRadius: 6,
                    background: count === n ? "rgba(99,102,241,0.25)" : "transparent",
                    color: count === n ? "#A5B4FC" : "var(--text-muted)",
                    borderColor: count === n ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Badge count real-time */}
            {codes.length > 0 && <span className="print-count-badge">{codes.length} kartu</span>}

            <button className="print-btn print-btn-indigo" onClick={handleGenerate} disabled={!bgLoaded}>
              {bgLoaded ? "✨ Generate Kartu" : "⏳ Loading..."}
            </button>

            {codes.length > 0 && !isZipping && !isSaving && (
              <>
                <button className="print-btn print-btn-cyan" onClick={handleSaveToStok}>
                  💾 Simpan ke Stok
                </button>

                <button className="print-btn print-btn-amber" onClick={handleDownloadZip}>
                  📦 Download ZIP
                </button>

                <button className="print-btn print-btn-emerald" onClick={() => window.print()}>
                  🖨️ Print
                </button>
              </>
            )}

            {(isZipping || isSaving) && (
              <div className="print-progress-pill">
                <span className="print-spin" />
                {isSaving ? "Menyimpan ke stok..." : progress}
              </div>
            )}
          </div>

          {/* Save result toast */}
          {saveResult && (
            <div className={`print-save-toast ${saveResult.startsWith("❌") ? "err" : ""}`}>
              {saveResult}
            </div>
          )}
        </div>
      </div>

      {/* ── Grid Kartu ── */}
      <div className="print-grid-area">
        {codes.length === 0 ? (
          <div className="print-empty">
            <div className="print-empty-icon">🎴</div>
            <div className="print-empty-title">Belum ada kartu di-generate</div>
            <div className="print-empty-sub">
              {templateMode === "custom"
                ? "Upload desain kustom dari klien, sesuaikan posisi QR agar pas di kotaknya, lalu klik Generate Kartu."
                : "Atur jumlah lalu klik Generate Kartu. Anda juga bisa mengunggah desain kartu khusus dari klien lewat tombol di atas."}
            </div>
          </div>
        ) : (
          <>
            <div className="print-grid-meta">
              {codes.length} kartu · klik kartu untuk download satu PNG resolusi tinggi ({cardW} × {cardH} px)
            </div>
            <div className="cards-grid">
              {codes.map((code) => (
                <div key={code} className="card-wrap" onClick={() => handleDownloadSingle(code)}>
                  <CardItem
                    code={code}
                    url={`${baseUrl}/c/${code}`}
                    bgImage={bgImage}
                    placement={placement}
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
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

type QRDotStyle = "dots" | "rounded" | "squares";

interface QRPlacementConfig {
  x: number;
  y: number;
  size: number;
  style: "transparent" | "white_box";
  padding: number;
  radius: number;
  fgColor?: string;
  dotStyle?: QRDotStyle;
}

const DEFAULT_PLACEMENT: QRPlacementConfig = {
  x: DEFAULT_BOX_X + DEFAULT_QR_PAD,
  y: DEFAULT_BOX_Y + DEFAULT_QR_PAD,
  size: DEFAULT_QR_SIZE,
  style: "white_box",
  padding: DEFAULT_QR_PAD,
  radius: 18,
  fgColor: "#000000",
  dotStyle: "dots",
};

// ─── Smart Box Detection Algorithm ────────────────────────────────────────────
function detectBoxInImage(img: HTMLImageElement): { x: number; y: number; size: number } {
  const cardW = img.naturalWidth || DEFAULT_CARD_W;
  const cardH = img.naturalHeight || DEFAULT_CARD_H;
  if (!cardW || !cardH) return { x: 100, y: 100, size: 200 };

  try {
    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No 2d context");
    ctx.drawImage(img, 0, 0, cardW, cardH);

    // Ambil sampel warna di bagian tengah kartu (misal kotak kuning Purs Coffee)
    const midX = Math.floor(cardW / 2);
    const midY = Math.floor(cardH / 2);
    const centerPix = ctx.getImageData(midX, midY, 1, 1).data;
    const tr = centerPix[0];
    const tg = centerPix[1];
    const tb = centerPix[2];

    // Cek apakah warna tengah berbeda dengan warna sudut (berarti ada kontainer di tengah)
    const cornerPix = ctx.getImageData(Math.floor(cardW * 0.05), Math.floor(cardH * 0.05), 1, 1).data;
    const cornerDiff = Math.abs(tr - cornerPix[0]) + Math.abs(tg - cornerPix[1]) + Math.abs(tb - cornerPix[2]);

    if (cornerDiff > 35) {
      // Ada kontainer warna berbeda di tengah! Scan batas bounding box-nya:
      const step = Math.max(1, Math.floor(Math.min(cardW, cardH) / 400));
      const startX = Math.floor(cardW * 0.12);
      const endX = Math.floor(cardW * 0.88);
      const startY = Math.floor(cardH * 0.12);
      const endY = Math.floor(cardH * 0.88);

      let minX = cardW, maxX = 0, minY = cardH, maxY = 0, matches = 0;
      const imgData = ctx.getImageData(0, 0, cardW, cardH).data;

      for (let y = startY; y < endY; y += step) {
        for (let x = startX; x < endX; x += step) {
          const idx = (y * cardW + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const diff = Math.abs(r - tr) + Math.abs(g - tg) + Math.abs(b - tb);
          if (diff < 50) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            matches++;
          }
        }
      }

      const boxW = maxX - minX;
      const boxH = maxY - minY;
      if (matches > 20 && boxW > cardW * 0.18 && boxH > cardH * 0.18) {
        // Kotak terdeteksi! Buat QR pas di dalam kotak dengan jarak aman 6.5% dari border cokelat
        const rawSize = Math.min(boxW, boxH);
        const safeMargin = Math.round(rawSize * 0.065);
        const finalSize = Math.round(rawSize - safeMargin * 2);
        const cX = minX + boxW / 2;
        const cY = minY + boxH / 2;
        return {
          x: Math.round(cX - finalSize / 2),
          y: Math.round(cY - finalSize / 2),
          size: finalSize,
        };
      }
    }
  } catch (err) {
    console.warn("Auto-detect box fallback:", err);
  }

  // Fallback default: 36% tepat di tengah kartu
  const fallbackSize = Math.round(Math.min(cardW, cardH) * 0.36);
  return {
    x: Math.round((cardW - fallbackSize) / 2),
    y: Math.round((cardH - fallbackSize) / 2),
    size: fallbackSize,
  };
}

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

// ─── Styled QR Code Renderer ──────────────────────────────────────────────────
function renderStyledQR(
  canvas: HTMLCanvasElement,
  text: string,
  size: number,
  dotStyle: QRDotStyle = "dots",
  fgColor: string = "#000000",
  bgColor: string = "transparent"
) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  if (bgColor !== "transparent") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const count = qr.modules.size;
  const cellSize = size / count;

  ctx.fillStyle = fgColor;
  ctx.strokeStyle = fgColor;

  const isFinder = (r: number, c: number) => {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= count - 7) return true;
    if (r >= count - 7 && c < 7) return true;
    return false;
  };

  const fillRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
    ctx.fill();
  };

  const strokeRoundedRect = (x: number, y: number, w: number, h: number, r: number, lw: number) => {
    ctx.lineWidth = lw;
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
    ctx.stroke();
  };

  // 1. Gambar data modules (non-finder)
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.modules.get(r, c) && !isFinder(r, c)) {
        const x = c * cellSize;
        const y = r * cellSize;
        if (dotStyle === "dots") {
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;
          const radius = (cellSize / 2) * 0.88;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (dotStyle === "rounded") {
          const pad = cellSize * 0.08;
          fillRoundedRect(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2, cellSize * 0.35);
        } else {
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }
  }

  // 2. Gambar 3 Finder Patterns (Sudut Kiri-Atas, Kanan-Atas, Kiri-Bawah)
  const finderPositions = [
    { row: 0, col: 0 },
    { row: 0, col: count - 7 },
    { row: count - 7, col: 0 },
  ];

  finderPositions.forEach(({ row, col }) => {
    const startX = col * cellSize;
    const startY = row * cellSize;

    if (dotStyle === "dots" || dotStyle === "rounded") {
      // Modern Rounded Eyes
      const ringX = startX + 0.5 * cellSize;
      const ringY = startY + 0.5 * cellSize;
      const ringSize = 6 * cellSize;
      const outerRad = 1.7 * cellSize;
      strokeRoundedRect(ringX, ringY, ringSize, ringSize, outerRad, cellSize);

      const eyeX = startX + 2 * cellSize;
      const eyeY = startY + 2 * cellSize;
      const eyeSize = 3 * cellSize;
      if (dotStyle === "dots") {
        fillRoundedRect(eyeX, eyeY, eyeSize, eyeSize, 1.2 * cellSize);
      } else {
        fillRoundedRect(eyeX, eyeY, eyeSize, eyeSize, 0.8 * cellSize);
      }
    } else {
      // Classic square eyes
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (qr.modules.get(row + r, col + c)) {
            ctx.fillRect((col + c) * cellSize, (row + r) * cellSize, cellSize, cellSize);
          }
        }
      }
    }
  });
}

// ─── 3D Acrylic Tabletop Mockup Canvas Generator ──────────────────────────────
function createAcrylicMockupCanvas(cardCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d")!;

  // 1. Warm Café Ambient Gradient Background
  const bgGrad = ctx.createRadialGradient(600, 360, 80, 600, 450, 750);
  bgGrad.addColorStop(0, "#3A2114"); // Warm coffee lamp glow
  bgGrad.addColorStop(0.55, "#1F1109"); // Dark mahogany wood
  bgGrad.addColorStop(1, "#0A0503"); // Deep vignette
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 1000);

  // Subtle wood tabletop horizon at y = 740
  const tableTopGrad = ctx.createLinearGradient(0, 740, 0, 1000);
  tableTopGrad.addColorStop(0, "rgba(25, 12, 6, 0.95)");
  tableTopGrad.addColorStop(1, "rgba(10, 5, 2, 0.98)");
  ctx.fillStyle = tableTopGrad;
  ctx.fillRect(0, 740, 1200, 260);

  // Table edge bevel highlight
  ctx.strokeStyle = "rgba(180, 110, 60, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 740);
  ctx.lineTo(1200, 740);
  ctx.stroke();

  // 2. Realistic Soft Drop Shadow under acrylic base
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(600, 775, 290, 26, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.filter = "blur(18px)";
  ctx.fill();
  ctx.restore();

  // Contact shadow directly beneath the base
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(600, 762, 230, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.filter = "blur(4px)";
  ctx.fill();
  ctx.restore();

  // 3. Acrylic Standee Frame Geometry
  const cardW = cardCanvas.width;
  const cardH = cardCanvas.height;
  const cardAspect = cardW / cardH;

  let standCardW = 460;
  let standCardH = Math.round(standCardW / cardAspect);
  if (standCardH > 520) {
    standCardH = 520;
    standCardW = Math.round(standCardH * cardAspect);
  }

  const borderPad = 14;
  const standTotalW = standCardW + borderPad * 2;
  const standTotalH = standCardH + borderPad * 2;
  const standX = Math.round((1200 - standTotalW) / 2);
  const standY = 745 - standTotalH;
  const cardX = standX + borderPad;
  const cardY = standY + borderPad;

  // Clear Acrylic Back Plate (Glass)
  ctx.save();
  ctx.beginPath();
  const rad = 14;
  ctx.moveTo(standX + rad, standY);
  ctx.lineTo(standX + standTotalW - rad, standY);
  ctx.arcTo(standX + standTotalW, standY, standX + standTotalW, standY + rad, rad);
  ctx.lineTo(standX + standTotalW, standY + standTotalH);
  ctx.lineTo(standX, standY + standTotalH);
  ctx.lineTo(standX, standY + rad);
  ctx.arcTo(standX, standY, standX + rad, standY, rad);
  ctx.closePath();

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fill();

  // Acrylic Edge Polish Border
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.stroke();
  ctx.restore();

  // 4. Draw the Card Image inside the Acrylic Frame
  ctx.save();
  ctx.beginPath();
  const cRad = 8;
  ctx.moveTo(cardX + cRad, cardY);
  ctx.lineTo(cardX + standCardW - cRad, cardY);
  ctx.arcTo(cardX + standCardW, cardY, cardX + standCardW, cardY + cRad, cRad);
  ctx.lineTo(cardX + standCardW, cardY + standCardH - cRad);
  ctx.arcTo(cardX + standCardW, cardY + standCardH, cardX + standCardW - cRad, cardY + standCardH, cRad);
  ctx.lineTo(cardX + cRad, cardY + standCardH);
  ctx.arcTo(cardX, cardY + standCardH, cardX, cardY + standCardH - cRad, cRad);
  ctx.lineTo(cardX, cardY + cRad);
  ctx.arcTo(cardX, cardY, cardX + cRad, cardY, cRad);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(cardCanvas, cardX, cardY, standCardW, standCardH);
  ctx.restore();

  // 5. Realistic Diagonal Glass Reflection / Sheen
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(standX, standY);
  ctx.lineTo(standX + standTotalW, standY);
  ctx.lineTo(standX + standTotalW, standY + standTotalH);
  ctx.lineTo(standX, standY + standTotalH);
  ctx.closePath();
  ctx.clip();

  const sheenGrad = ctx.createLinearGradient(standX, standY, standX + standTotalW, standY + standTotalH);
  sheenGrad.addColorStop(0, "rgba(255, 255, 255, 0.32)");
  sheenGrad.addColorStop(0.25, "rgba(255, 255, 255, 0.08)");
  sheenGrad.addColorStop(0.42, "rgba(255, 255, 255, 0.0)");
  sheenGrad.addColorStop(0.65, "rgba(255, 255, 255, 0.03)");
  sheenGrad.addColorStop(0.85, "rgba(255, 255, 255, 0.15)");
  sheenGrad.addColorStop(1, "rgba(255, 255, 255, 0.04)");

  ctx.fillStyle = sheenGrad;
  ctx.fillRect(standX, standY, standTotalW, standTotalH);

  // Sharp Glint diagonal light ray
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(standX + standTotalW * 0.1, standY);
  ctx.lineTo(standX + standTotalW * 0.6, standY + standTotalH);
  ctx.stroke();
  ctx.restore();

  // 6. Acrylic Base Pedestal (T-Stand Base)
  const baseW = Math.max(standTotalW * 0.88, 380);
  const baseH = 26;
  const baseX = Math.round((1200 - baseW) / 2);
  const baseY = 738;
  const baseRad = 6;

  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(baseX, baseY, baseW, baseH, baseRad);
  } else {
    ctx.rect(baseX, baseY, baseW, baseH);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.stroke();

  // Top highlight line on acrylic base
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(baseX + 10, baseY + 2);
  ctx.lineTo(baseX + baseW - 10, baseY + 2);
  ctx.stroke();
  ctx.restore();

  // 7. Sleek Title & Badge Overlays
  ctx.save();
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const badgeText = "STAND AKRILIK MEJA CAFÉ · UKURAN 10 × 10 CM";
  const metrics = ctx.measureText(badgeText);
  const bW = metrics.width + 36;
  const bH = 34;
  const bX = (1200 - bW) / 2;
  const bY = 50;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  if (ctx.roundRect) {
    ctx.roundRect(bX, bY, bW, bH, 17);
  } else {
    ctx.rect(bX, bY, bW, bH);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#F3F4F6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, 600, bY + bH / 2);

  // Bottom brand note
  ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillText("Hantic NFC & QR Review System · Ready to Print & Tap", 600, 940);
  ctx.restore();

  return canvas;
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
    const qrCanvas = document.createElement("canvas");
    const qrRes = Math.max(placement.size, 512); // Resolusi tinggi untuk cetak super tajam
    renderStyledQR(
      qrCanvas,
      url,
      qrRes,
      placement.dotStyle || "dots",
      placement.fgColor || "#000000",
      placement.style === "white_box" ? "#FFFFFF" : "transparent"
    );

    const composed = compositeCard(bgImage, qrCanvas, placement);
    if (previewRef.current) {
      const ctx = previewRef.current.getContext("2d")!;
      ctx.clearRect(0, 0, previewRef.current.width, previewRef.current.height);
      ctx.drawImage(composed, 0, 0, previewRef.current.width, previewRef.current.height);
    }
    onCanvasReady(code, composed);
    setReady(true);
  }, [bgImage, code, url, placement, onCanvasReady]);

  const cardW = bgImage?.naturalWidth || DEFAULT_CARD_W;
  const cardH = bgImage?.naturalHeight || DEFAULT_CARD_H;
  const previewW = 176;
  const previewH = Math.round(cardH * (previewW / cardW));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: ready ? 1 : 0.35, transition: "opacity 0.3s" }}>
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
  const [showMockup, setShowMockup] = useState(false);
  const [mockupCopied, setMockupCopied] = useState(false);

  const [isZipping, setIsZipping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const composedCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const liveQrCanvasRef = useRef<HTMLCanvasElement>(null);
  const mockupPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Helper untuk update posisi dari pointer drag / click langsung di kartu
  const updatePlacementFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!previewWrapRef.current) return;
      const rect = previewWrapRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const currentCardW = bgImage?.naturalWidth || DEFAULT_CARD_W;
      const currentCardH = bgImage?.naturalHeight || DEFAULT_CARD_H;

      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;

      const rawX = relX * currentCardW - placement.size / 2;
      const rawY = relY * currentCardH - placement.size / 2;

      const maxX = Math.max(0, currentCardW - placement.size);
      const maxY = Math.max(0, currentCardH - placement.size);
      const nextX = Math.max(0, Math.min(maxX, Math.round(rawX)));
      const nextY = Math.max(0, Math.min(maxY, Math.round(rawY)));

      setPlacement((prev) => ({ ...prev, x: nextX, y: nextY }));
    },
    [bgImage, placement.size]
  );

  function handleNudge(dx: number, dy: number) {
    const currentCardW = bgImage?.naturalWidth || DEFAULT_CARD_W;
    const currentCardH = bgImage?.naturalHeight || DEFAULT_CARD_H;
    const maxX = Math.max(0, currentCardW - placement.size);
    const maxY = Math.max(0, currentCardH - placement.size);
    setPlacement((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(maxX, prev.x + dx)),
      y: Math.max(0, Math.min(maxY, prev.y + dy)),
    }));
  }

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

  // Auto-save placement to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("custom_qr_placement", JSON.stringify({ placement }));
    } catch {}
  }, [placement]);

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

        // Smart Box Detection (Deteksi otomatis kotak tengah di desain seperti Purs Coffee)
        const detected = detectBoxInImage(img);
        const newPlacement: QRPlacementConfig = {
          x: detected.x,
          y: detected.y,
          size: detected.size,
          style: "transparent", // transparan agar warna kuning asli Purs Coffee tidak tertutup!
          fgColor: "#000000",
          dotStyle: "dots",
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

  // Smart Snap to Detected Box
  function handleAutoSnapBox() {
    if (!bgImage) return;
    const detected = detectBoxInImage(bgImage);
    setPlacement((prev) => ({
      ...prev,
      x: detected.x,
      y: detected.y,
      size: detected.size,
      style: "transparent",
      dotStyle: prev.dotStyle || "dots",
    }));
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

  // Helper untuk mendapatkan canvas kartu (untuk export maupun mockup akrilik)
  const getMockupCardCanvas = useCallback((): HTMLCanvasElement | null => {
    if (composedCanvases.current.size > 0) {
      const first = composedCanvases.current.values().next().value;
      if (first) return first;
    }
    if (!bgImage) return null;
    const qrCanvas = document.createElement("canvas");
    const qrRes = Math.max(placement.size, 512);
    renderStyledQR(
      qrCanvas,
      `${baseUrl || "https://hantic.id"}/c/demo`,
      qrRes,
      placement.dotStyle || "dots",
      placement.fgColor || "#000000",
      placement.style === "white_box" ? "#FFFFFF" : "transparent"
    );
    return compositeCard(bgImage, qrCanvas, placement);
  }, [bgImage, placement, baseUrl]);

  // Download Mockup PNG 1200x1000
  function handleDownloadMockupPNG() {
    const card = getMockupCardCanvas();
    if (!card) return;
    const scene = createAcrylicMockupCanvas(card);
    scene.toBlob((blob) => {
      if (blob) {
        const name = customImageName
          ? `Mockup_Akrilik_${customImageName.replace(/\.[^/.]+$/, "")}.png`
          : "Mockup_Akrilik_Meja_Cafe.png";
        saveAs(blob, name);
      }
    }, "image/png");
  }

  // Salin pesan WhatsApp untuk minta approval klien
  function handleCopyWhatsAppText() {
    const brandName = customImageName
      ? customImageName.replace(/[-_]/g, " ").replace(/\.[^/.]+$/, "").toUpperCase()
      : "Purs Coffee";

    const waText = `Halo Kak! 👋

Berikut preview mockup Kartu Google Review NFC & QR Code di Stand Akrilik Meja Café (Ukuran 10 × 10 cm) untuk ${brandName}.

✨ Fitur & Spesifikasi:
• Chip NFC NTAG213 (Tinggal tap HP langsung terbuka ulasan bintang 5 Google Maps)
• QR Code Estetik (Modul titik bulat modern, langsung discan kamera HP)
• Stand Akrilik Bening Tebal 3mm (Tahan air, kokoh di meja, & tahan tumpahan minuman)

Mohon dicek apakah posisi logo, tulisan, dan QR Code sudah sesuai sebelum kami masukkan ke proses cetak fisik ya kak. Terima kasih! 🙏`;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(waText);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = waText;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(textArea);
    }

    setMockupCopied(true);
    setTimeout(() => setMockupCopied(false), 2500);
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

  // Live preview scale calculation
  const maxPrevW = 250;
  const maxPrevH = 370;
  let prevW = maxPrevW;
  let prevH = Math.round(prevW * (cardH / cardW));
  if (prevH > maxPrevH) {
    prevH = maxPrevH;
    prevW = Math.round(prevH * (cardW / cardH));
  }
  const scale = prevW / cardW;
  const qrPrevLeft = Math.round(placement.x * scale);
  const qrPrevTop = Math.round(placement.y * scale);
  const qrPrevSize = Math.max(24, Math.round(placement.size * scale));
  const qrPrevPad = Math.round((placement.padding || 16) * scale);
  const qrPrevRad = Math.round((placement.radius || 16) * scale);

  // Render live preview QR pada kartu secara real-time dengan gaya dotStyle & fgColor aktif
  useEffect(() => {
    if (!liveQrCanvasRef.current) return;
    const innerSize = placement.style === "white_box" ? Math.max(16, qrPrevSize - qrPrevPad * 2) : qrPrevSize;
    renderStyledQR(
      liveQrCanvasRef.current,
      "https://hantic.id/demo",
      innerSize,
      placement.dotStyle || "dots",
      placement.fgColor || "#000000",
      "transparent"
    );
  }, [placement.dotStyle, placement.fgColor, placement.style, qrPrevSize, qrPrevPad]);

  // Render WYSIWYG 3D Tabletop Acrylic Mockup Preview di dalam modal
  useEffect(() => {
    if (!showMockup || !mockupPreviewCanvasRef.current) return;
    const card = getMockupCardCanvas();
    if (!card) return;
    const scene = createAcrylicMockupCanvas(card);
    const prevCanvas = mockupPreviewCanvasRef.current;
    prevCanvas.width = 640;
    prevCanvas.height = 533; // Proporsional dari 1200x1000
    const ctx = prevCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(scene, 0, 0, prevCanvas.width, prevCanvas.height);
    }
  }, [showMockup, getMockupCardCanvas]);

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
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>Dimensi Kartu:</span>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0" }}>
                {cardW} × {cardH} px
              </span>
              {Math.abs(cardW - cardH) < 20 && (
                <span style={{ fontSize: "0.74rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)", color: "#FCD34D" }}>
                  📐 1:1 Persegi (Standar Cetak 10 × 10 cm Meja Café)
                </span>
              )}
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

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Tombol Preview Mockup Akrilik Meja (Fitur Nomor 6) */}
              <button
                type="button"
                onClick={() => setShowMockup(true)}
                className="print-btn"
                style={{
                  fontSize: "0.76rem",
                  padding: "6px 14px",
                  background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                  border: "1px solid rgba(167, 139, 250, 0.4)",
                  color: "#FFF",
                  fontWeight: 700,
                  boxShadow: "0 2px 10px rgba(99, 102, 241, 0.35)",
                }}
              >
                ☕ 📸 Mockup Akrilik Meja (WhatsApp)
              </button>

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
          </div>

          {/* ── QR Placement & Position Adjuster Panel ── */}
          {showPlacementEditor && (
            <div className="placement-editor">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12 }}>
                <div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#F8FAFC", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🎯</span> Atur Posisi QR Code Secara Visual Langsung
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#94A3B8" }}>
                    Klik atau geser langsung kotak QR pada kartu di sebelah kanan, atau gunakan slider dan tombol panah untuk posisi presisi.
                  </div>
                </div>

                {/* Quick Auto Center Buttons & Smart Snap */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handleAutoSnapBox}
                    className="print-btn print-btn-indigo"
                    style={{
                      padding: "6px 12px",
                      fontSize: "0.75rem",
                      background: "linear-gradient(135deg, #F59E0B, #D97706)",
                      border: "none",
                      color: "#FFF",
                      boxShadow: "0 2px 10px rgba(245, 158, 11, 0.4)",
                      fontWeight: 700,
                    }}
                    title="Deteksi kotak kuning pada kartu secara otomatis dan letakkan QR persis di dalamnya!"
                  >
                    ✨ 🎯 Pas-kan ke Kotak Otomatis (Smart Snap)
                  </button>
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

              <div className="placement-split">
                {/* Kolom Kiri: Slider, Angka Presisi, & Tombol Geser */}
                <div className="placement-controls-col">
                  {/* Sliders Grid */}
                  <div className="slider-row">
                    {/* Posisi X */}
                    <div className="slider-item">
                      <div className="slider-header">
                        <span>Posisi X (Kiri ↔ Kanan):</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number"
                            min={0}
                            max={Math.max(cardW - placement.size, 0)}
                            value={placement.x}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(cardW - placement.size, Number(e.target.value)));
                              setPlacement((p) => ({ ...p, x: val }));
                            }}
                            className="print-ctrl-input"
                            style={{ width: 68, padding: "3px 6px", fontSize: "0.75rem", height: 26, textAlign: "right" }}
                          />
                          <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>px</span>
                        </div>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number"
                            min={0}
                            max={Math.max(cardH - placement.size, 0)}
                            value={placement.y}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(cardH - placement.size, Number(e.target.value)));
                              setPlacement((p) => ({ ...p, y: val }));
                            }}
                            className="print-ctrl-input"
                            style={{ width: 68, padding: "3px 6px", fontSize: "0.75rem", height: 26, textAlign: "right" }}
                          />
                          <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>px</span>
                        </div>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="number"
                            min={60}
                            max={Math.min(cardW, cardH)}
                            value={placement.size}
                            onChange={(e) => {
                              const val = Math.max(60, Math.min(Math.min(cardW, cardH), Number(e.target.value)));
                              setPlacement((p) => ({
                                ...p,
                                size: val,
                                x: Math.min(p.x, cardW - val),
                                y: Math.min(p.y, cardH - val),
                              }));
                            }}
                            className="print-ctrl-input"
                            style={{ width: 68, padding: "3px 6px", fontSize: "0.75rem", height: 26, textAlign: "right" }}
                          />
                          <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>px</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        className="slider-input"
                        min={60}
                        max={Math.min(cardW, cardH)}
                        value={placement.size}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPlacement((p) => ({
                            ...p,
                            size: val,
                            x: Math.min(p.x, cardW - val),
                            y: Math.min(p.y, cardH - val),
                          }));
                        }}
                      />
                    </div>

                    {/* Warna QR Code */}
                    <div className="slider-item">
                      <div className="slider-header">
                        <span>Warna QR Code:</span>
                        <strong style={{ color: placement.fgColor || "#000000" }}>
                          {placement.fgColor === "#3D2213" ? "☕ Cokelat Purs" : "⬛ Hitam Pekat"}
                        </strong>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        <button
                          type="button"
                          onClick={() => setPlacement((p) => ({ ...p, fgColor: "#000000" }))}
                          className="print-btn"
                          style={{
                            flex: 1, padding: "5px 8px", fontSize: "0.72rem",
                            background: (!placement.fgColor || placement.fgColor === "#000000") ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                            border: (!placement.fgColor || placement.fgColor === "#000000") ? "1px solid #FFF" : "1px solid rgba(255,255,255,0.08)",
                            color: "#FFF",
                          }}
                        >
                          ⬛ Hitam
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlacement((p) => ({ ...p, fgColor: "#3D2213" }))}
                          className="print-btn"
                          style={{
                            flex: 1, padding: "5px 8px", fontSize: "0.72rem",
                            background: placement.fgColor === "#3D2213" ? "rgba(180, 83, 9, 0.3)" : "rgba(255,255,255,0.04)",
                            border: placement.fgColor === "#3D2213" ? "1px solid #F59E0B" : "1px solid rgba(255,255,255,0.08)",
                            color: "#FCD34D",
                          }}
                        >
                          ☕ Cokelat Purs
                        </button>
                      </div>
                    </div>

                    {/* Gaya Latar QR */}
                    <div className="slider-item">
                      <div className="slider-header">
                        <span>Gaya Latar QR:</span>
                        <strong style={{ color: placement.style === "transparent" ? "#FBBF24" : "#FFF" }}>
                          {placement.style === "transparent" ? "Transparan (Purs)" : "Kotak Putih Rounded"}
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

                    {/* Gaya Pola QR (Fitur Nomor 5) */}
                    <div className="slider-item">
                      <div className="slider-header">
                        <span>Gaya Pola QR:</span>
                        <strong style={{ color: placement.dotStyle === "dots" ? "#F59E0B" : placement.dotStyle === "rounded" ? "#A5B4FC" : "#FFF" }}>
                          {(!placement.dotStyle || placement.dotStyle === "dots")
                            ? "🔵 Titik Bulat (Modern)"
                            : placement.dotStyle === "rounded"
                            ? "✨ Membulat Halus"
                            : "⬛ Kotak Standar"}
                        </strong>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        <button
                          type="button"
                          onClick={() => setPlacement((p) => ({ ...p, dotStyle: "dots" }))}
                          className="print-btn"
                          style={{
                            flex: 1, padding: "5px 6px", fontSize: "0.72rem",
                            background: (!placement.dotStyle || placement.dotStyle === "dots") ? "rgba(245, 158, 11, 0.25)" : "rgba(255,255,255,0.04)",
                            border: (!placement.dotStyle || placement.dotStyle === "dots") ? "1px solid #F59E0B" : "1px solid rgba(255,255,255,0.08)",
                            color: (!placement.dotStyle || placement.dotStyle === "dots") ? "#FCD34D" : "#94A3B8",
                          }}
                          title="Titik bulat modern estetik café (seperti Purs Coffee / Spotify / Apple)"
                        >
                          🔵 Dots (Café)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlacement((p) => ({ ...p, dotStyle: "rounded" }))}
                          className="print-btn"
                          style={{
                            flex: 1, padding: "5px 6px", fontSize: "0.72rem",
                            background: placement.dotStyle === "rounded" ? "rgba(99, 102, 241, 0.25)" : "rgba(255,255,255,0.04)",
                            border: placement.dotStyle === "rounded" ? "1px solid #6366F1" : "1px solid rgba(255,255,255,0.08)",
                            color: placement.dotStyle === "rounded" ? "#C7D2FE" : "#94A3B8",
                          }}
                          title="Sudut membulat squircle lembut"
                        >
                          ✨ Membulat
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlacement((p) => ({ ...p, dotStyle: "squares" }))}
                          className="print-btn"
                          style={{
                            flex: 1, padding: "5px 6px", fontSize: "0.72rem",
                            background: placement.dotStyle === "squares" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                            border: placement.dotStyle === "squares" ? "1px solid #FFF" : "1px solid rgba(255,255,255,0.08)",
                            color: placement.dotStyle === "squares" ? "#FFF" : "#94A3B8",
                          }}
                          title="Modul kotak tajam standar"
                        >
                          ⬛ Kotak
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Geser Halus (Nudge) & Presets */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, background: "rgba(255,255,255,0.02)", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="nudge-ctrl-box">
                      <span style={{ fontSize: "0.74rem", color: "#94A3B8", marginRight: 4, fontWeight: 600 }}>Geser Presisi (±10px):</span>
                      <button type="button" onClick={() => handleNudge(-10, 0)} className="nudge-btn" title="Geser ke kiri 10px">⬅️ Kiri</button>
                      <button type="button" onClick={() => handleNudge(10, 0)} className="nudge-btn" title="Geser ke kanan 10px">➡️ Kanan</button>
                      <button type="button" onClick={() => handleNudge(0, -10)} className="nudge-btn" title="Geser ke atas 10px">⬆️ Atas</button>
                      <button type="button" onClick={() => handleNudge(0, 10)} className="nudge-btn" title="Geser ke bawah 10px">⬇️ Bawah</button>
                    </div>

                    {/* Preset Ukuran Cepat */}
                    <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>Ukuran Cepat:</span>
                      {[0.28, 0.36, 0.44, 0.52].map((ratio) => {
                        const sz = Math.round(Math.min(cardW, cardH) * ratio);
                        return (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => {
                              setPlacement((p) => ({
                                ...p,
                                size: sz,
                                x: Math.min(p.x, cardW - sz),
                                y: Math.min(p.y, cardH - sz),
                              }));
                            }}
                            className="nudge-btn"
                            style={{
                              fontSize: "0.68rem",
                              padding: "3px 6px",
                              borderColor: placement.size === sz ? "rgba(99,102,241,0.5)" : undefined,
                              color: placement.size === sz ? "#A5B4FC" : undefined,
                            }}
                          >
                            {Math.round(ratio * 100)}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Kolom Kanan: LIVE INTERACTIVE CARD PREVIEW */}
                <div className="placement-preview-col">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#E0E7FF", display: "flex", alignItems: "center", gap: 5 }}>
                      <span>🔴</span> Live Preview Kartu
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "#94A3B8" }}>Skala Nyata</span>
                  </div>

                  {/* Canvas Wrap / Interactive Box */}
                  <div
                    ref={previewWrapRef}
                    className="live-preview-box"
                    style={{ width: prevW, height: prevH }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setIsDragging(true);
                      updatePlacementFromPointer(e.clientX, e.clientY);
                    }}
                    onPointerMove={(e) => {
                      if (!isDragging) return;
                      updatePlacementFromPointer(e.clientX, e.clientY);
                    }}
                    onPointerUp={(e) => {
                      if (isDragging) {
                        setIsDragging(false);
                        try {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        } catch {}
                      }
                    }}
                    onPointerCancel={() => setIsDragging(false)}
                    title="Klik atau geser langsung di sini untuk memindahkan QR Code ke posisi yang diinginkan"
                  >
                    {/* Background Card Image */}
                    {bgImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bgImage.src}
                        alt="Desain Kartu"
                        style={{
                          width: prevW,
                          height: prevH,
                          display: "block",
                          userSelect: "none",
                          pointerEvents: "none",
                        }}
                      />
                    ) : (
                      <div style={{ color: "#666", fontSize: "0.8rem" }}>Loading desain...</div>
                    )}

                    {/* QR Code Overlay Box (Interactive Target) */}
                    <div
                      className="qr-target-overlay"
                      style={{
                        left: qrPrevLeft,
                        top: qrPrevTop,
                        width: qrPrevSize,
                        height: qrPrevSize,
                        borderRadius: placement.style === "white_box" ? qrPrevRad : 4,
                        background: placement.style === "white_box" ? "#FFFFFF" : "transparent",
                        padding: placement.style === "white_box" ? qrPrevPad : 0,
                        boxSizing: "border-box",
                      }}
                    >
                      <canvas
                        ref={liveQrCanvasRef}
                        width={placement.style === "white_box" ? Math.max(16, qrPrevSize - qrPrevPad * 2) : qrPrevSize}
                        height={placement.style === "white_box" ? Math.max(16, qrPrevSize - qrPrevPad * 2) : qrPrevSize}
                        style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
                      />

                      {/* Small Indicator Tag */}
                      <div
                        style={{
                          position: "absolute",
                          top: -18,
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#4F46E5",
                          color: "#FFF",
                          fontSize: "0.58rem",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 4,
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
                        }}
                      >
                        🎯 QR {placement.size}px
                      </div>
                    </div>

                    {/* Drag Hint */}
                    <span className="live-drag-hint">👆 Klik atau Tarik QR di Kartu</span>
                  </div>

                  {/* Coordinate Tag */}
                  <div style={{ fontSize: "0.68rem", color: "#94A3B8", textAlign: "center", lineHeight: 1.4 }}>
                    📍 X: <strong style={{ color: "#A5B4FC" }}>{placement.x}px</strong> · Y: <strong style={{ color: "#A5B4FC" }}>{placement.y}px</strong> · Ukuran: <strong style={{ color: "#34D399" }}>{placement.size}px</strong>
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
      {/* ── Modal Mockup Akrilik Meja Café 3D (Fitur Nomor 6) ── */}
      {showMockup && (
        <div className="mockup-modal-overlay" onClick={() => setShowMockup(false)}>
          <div className="mockup-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="mockup-header">
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#F8FAFC", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>☕</span> Preview Mockup Stand Akrilik Meja Café (3D)
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: 2 }}>
                  Visualisasi realistis kartu NFC &amp; QR Code di atas dudukan akrilik meja café (10 × 10 cm).
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMockup(false)}
                className="print-btn print-btn-ghost"
                style={{ padding: "4px 10px", fontSize: "0.9rem" }}
              >
                ✕
              </button>
            </div>

            {/* Viewport 3D Showcase */}
            <div className="mockup-scene-viewport">
              <canvas
                ref={mockupPreviewCanvasRef}
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  borderRadius: 14,
                  boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)",
                  display: "block",
                }}
              />
              <div
                style={{
                  marginTop: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(0, 0, 0, 0.45)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  padding: "4px 14px",
                  borderRadius: 999,
                  fontSize: "0.72rem",
                  color: "#E2E8F0",
                }}
              >
                <span>📐 Rasio 1:1 Persegi (10 × 10 cm)</span>
                <span style={{ color: "rgba(255,255,255,0.25)" }}>•</span>
                <span style={{ color: "#34D399" }}>✨ Akrilik Bening 3mm Tabletop</span>
              </div>
            </div>

            {/* Footer Aksi */}
            <div className="mockup-footer">
              <button
                type="button"
                onClick={handleCopyWhatsAppText}
                className="print-btn"
                style={{
                  padding: "8px 14px",
                  fontSize: "0.78rem",
                  background: mockupCopied ? "rgba(16, 185, 129, 0.25)" : "rgba(37, 211, 102, 0.15)",
                  border: mockupCopied ? "1px solid #10B981" : "1px solid rgba(37, 211, 102, 0.4)",
                  color: mockupCopied ? "#34D399" : "#25D366",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {mockupCopied ? "✅ Pesan WhatsApp Disalin!" : "📋 Salin Teks WhatsApp Klien"}
              </button>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleDownloadMockupPNG}
                  className="print-btn print-btn-indigo"
                  style={{
                    padding: "8px 16px",
                    fontSize: "0.78rem",
                    background: "linear-gradient(135deg, #F59E0B, #D97706)",
                    border: "none",
                    color: "#FFF",
                    fontWeight: 700,
                    boxShadow: "0 2px 12px rgba(245, 158, 11, 0.4)",
                  }}
                >
                  📥 Download Mockup PNG (1200×1000)
                </button>
                <button
                  type="button"
                  onClick={() => setShowMockup(false)}
                  className="print-btn print-btn-ghost"
                  style={{ padding: "8px 14px", fontSize: "0.78rem" }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

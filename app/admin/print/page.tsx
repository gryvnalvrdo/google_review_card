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
export type QRLogoType = "none" | "google" | "star" | "nfc";

interface QRPlacementConfig {
  x: number;
  y: number;
  size: number;
  style: "transparent" | "white_box";
  padding: number;
  radius: number;
  fgColor?: string;
  boxColor?: string;
  dotStyle?: QRDotStyle;
  logoType?: QRLogoType;
  showCtaText?: boolean;
  ctaText?: string;
  ctaColor?: string;
}

const DEFAULT_PLACEMENT: QRPlacementConfig = {
  x: DEFAULT_BOX_X,
  y: DEFAULT_BOX_Y,
  size: DEFAULT_BOX_SIZE,
  style: "white_box",
  padding: DEFAULT_QR_PAD,
  radius: 18,
  fgColor: "#000000",
  boxColor: "#FFFFFF",
  dotStyle: "squares",
  logoType: "none",
  showCtaText: false,
  ctaText: "Tap Kartu NFC / Scan QR",
  ctaColor: "#FFFFFF",
};

// ─── Smart Box Detection Algorithm ────────────────────────────────────────────
function detectBoxInImage(img: HTMLImageElement): { x: number; y: number; size: number; detected: boolean } {
  const cardW = img.naturalWidth || DEFAULT_CARD_W;
  const cardH = img.naturalHeight || DEFAULT_CARD_H;
  if (!cardW || !cardH) return { x: 100, y: 100, size: 200, detected: false };

  try {
    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No 2d context");
    ctx.drawImage(img, 0, 0, cardW, cardH);

    // Ambil sampel warna di bagian tengah kartu
    const midX = Math.floor(cardW / 2);
    const midY = Math.floor(cardH / 2);
    const centerPix = ctx.getImageData(midX, midY, 1, 1).data;
    const tr = centerPix[0];
    const tg = centerPix[1];
    const tb = centerPix[2];

    // Cek apakah warna tengah berbeda dengan warna sudut (menandakan ada kontainer khusus di tengah)
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
        // Kotak terdeteksi! Buat QR pas di dalam kotak
        const rawSize = Math.min(boxW, boxH);
        const safeMargin = Math.round(rawSize * 0.05);
        const finalSize = Math.round(rawSize - safeMargin * 2);
        const cX = minX + boxW / 2;
        const cY = minY + boxH / 2;
        return {
          x: Math.round(cX - finalSize / 2),
          y: Math.round(cY - finalSize / 2),
          size: finalSize,
          detected: true,
        };
      }
    }
  } catch (err) {
    console.warn("Auto-detect box fallback:", err);
  }

  // Fallback: 42% tepat di tengah kartu
  const fallbackSize = Math.round(Math.min(cardW, cardH) * 0.42);
  return {
    x: Math.round((cardW - fallbackSize) / 2),
    y: Math.round((cardH - fallbackSize) / 2),
    size: fallbackSize,
    detected: false,
  };
}

// ─── Deteksi QR Code Bawaan Desain Klien (ZXing QR Scanner & Fallback Box) ───
async function detectClientQRCode(img: HTMLImageElement): Promise<{
  x: number;
  y: number;
  size: number;
  detected: boolean;
  qrFound: boolean;
  text?: string;
}> {
  const cardW = img.naturalWidth || DEFAULT_CARD_W;
  const cardH = img.naturalHeight || DEFAULT_CARD_H;
  if (!cardW || !cardH) return { x: 100, y: 100, size: 200, detected: false, qrFound: false };

  // 1. Coba deteksi QR code nyata bawaan klien menggunakan ZXing BrowserQRCodeReader
  try {
    const { BrowserQRCodeReader } = await import("@zxing/library");
    const reader = new BrowserQRCodeReader();
    const result = await reader.decodeFromImageElement(img);

    if (result) {
      const points = result.getResultPoints();
      if (points && points.length >= 2) {
        const xs = points.map((p) => p.getX());
        const ys = points.map((p) => p.getY());
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const distFinder = Math.max(maxX - minX, maxY - minY);
        // Finder pattern berjarak ~75-80% dari lebar total QR code
        const rawSize = Math.max(distFinder * 1.34, 70);
        const cX = (minX + maxX) / 2;
        const cY = (minY + maxY) / 2;

        const size = Math.round(Math.min(rawSize, Math.min(cardW, cardH) * 0.95));
        const x = Math.max(0, Math.round(cX - size / 2));
        const y = Math.max(0, Math.round(cY - size / 2));

        return {
          x,
          y,
          size,
          detected: true,
          qrFound: true,
          text: result.getText(),
        };
      }
    }
  } catch (err) {
    console.log("ZXing auto QR detect pass:", err);
  }

  // 2. Fallback: Deteksi kotak warna di tengah kartu
  const boxResult = detectBoxInImage(img);
  return {
    ...boxResult,
    qrFound: false,
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

// ─── Center Logo Vector Drawers ──────────────────────────────────────────────
function drawGoogleLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, iconSize: number) {
  if (typeof Path2D === "undefined") {
    ctx.save();
    ctx.fillStyle = "#4285F4";
    ctx.font = `bold ${Math.round(iconSize * 0.8)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("G", cx, cy);
    ctx.restore();
    return;
  }

  try {
    ctx.save();
    ctx.translate(cx - iconSize / 2, cy - iconSize / 2);
    const scale = iconSize / 48;
    ctx.scale(scale, scale);

    const pRed = new Path2D("M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z");
    const pBlue = new Path2D("M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z");
    const pYellow = new Path2D("M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z");
    const pGreen = new Path2D("M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z");

    ctx.fillStyle = "#EA4335"; ctx.fill(pRed);
    ctx.fillStyle = "#4285F4"; ctx.fill(pBlue);
    ctx.fillStyle = "#FBBC05"; ctx.fill(pYellow);
    ctx.fillStyle = "#34A853"; ctx.fill(pGreen);
    ctx.restore();
  } catch {
    ctx.restore();
  }
}

function drawStarLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, iconSize: number) {
  const outerR = iconSize / 2;
  const innerR = outerR * 0.42;
  const spikes = 5;
  ctx.save();
  ctx.beginPath();
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerR;
    y = cy + Math.sin(rot) * outerR;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerR;
    y = cy + Math.sin(rot) * innerR;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
  ctx.fillStyle = "#F59E0B";
  ctx.shadowColor = "rgba(245, 158, 11, 0.4)";
  ctx.shadowBlur = Math.max(2, iconSize * 0.12);
  ctx.fill();
  ctx.restore();
}

function drawNfcLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, iconSize: number) {
  ctx.save();
  ctx.strokeStyle = "#4F46E5";
  ctx.fillStyle = "#4F46E5";
  ctx.lineCap = "round";
  const lw = Math.max(2, iconSize * 0.09);
  ctx.lineWidth = lw;

  const originX = cx - iconSize * 0.22;
  ctx.beginPath();
  ctx.arc(originX, cy, lw * 0.75, 0, Math.PI * 2);
  ctx.fill();

  const radii = [iconSize * 0.26, iconSize * 0.46, iconSize * 0.66];
  radii.forEach((r) => {
    ctx.beginPath();
    ctx.arc(originX, cy, r, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();
  });
  ctx.restore();
}

function compositeCard(
  bgImg: HTMLImageElement,
  qrCanvas: HTMLCanvasElement,
  placement: QRPlacementConfig,
  code?: string
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const cardW = bgImg.naturalWidth || DEFAULT_CARD_W;
  const cardH = bgImg.naturalHeight || DEFAULT_CARD_H;
  out.width = cardW;
  out.height = cardH;
  const ctx = out.getContext("2d")!;

  // 1. Gambar latar desain (bisa template bawaan atau custom klien)
  ctx.drawImage(bgImg, 0, 0, cardW, cardH);

  const boxX = placement.x;
  const boxY = placement.y;
  const boxSize = placement.size;

  // 2. Kotak putih / warna rounded (jika dipilih opsi white_box)
  if (placement.style === "white_box") {
    const pad = Math.min(placement.padding ?? 18, Math.floor(boxSize * 0.3));
    const rad = placement.radius ?? 18;

    ctx.fillStyle = placement.boxColor || "#FFFFFF";
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

    // Gambar QR di dalam kotak dengan padding
    const innerQrX = boxX + pad;
    const innerQrY = boxY + pad;
    const innerQrSize = Math.max(16, boxSize - pad * 2);
    ctx.drawImage(qrCanvas, innerQrX, innerQrY, innerQrSize, innerQrSize);
  } else {
    // 3. Gambar QR code langsung di atas kanvas (tanpa latar kotak)
    ctx.drawImage(qrCanvas, boxX, boxY, boxSize, boxSize);
  }

  // 3. Optional Call-to-Action (CTA) Text di bawah QR
  if (placement.showCtaText && placement.ctaText && placement.ctaText.trim()) {
    ctx.save();
    const ctaY = boxY + boxSize + Math.max(16, Math.floor(cardH * 0.024));
    const ctaX = boxX + boxSize / 2;
    const fontSize = Math.max(14, Math.min(26, Math.round(boxSize * 0.075)));
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = placement.ctaColor || "#FFFFFF";
    ctx.fillText(placement.ctaText.trim(), ctaX, ctaY);
    ctx.restore();
  }

  return out;
}

// ─── Styled QR Code Renderer ──────────────────────────────────────────────────
function renderStyledQR(
  canvas: HTMLCanvasElement,
  text: string,
  size: number,
  dotStyle: QRDotStyle = "squares",
  fgColor: string = "#000000",
  bgColor: string = "transparent",
  logoType: QRLogoType = "none"
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

  const isCenterBadge = (r: number, c: number) => {
    if (logoType === "none") return false;
    const centerCell = (count - 1) / 2;
    const badgeRadiusCells = (count * 0.24) / 2;
    const dist = Math.hypot(r - centerCell, c - centerCell);
    return dist <= badgeRadiusCells + 0.3;
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

  // 1. Gambar data modules (non-finder, non-center badge)
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.modules.get(r, c) && !isFinder(r, c) && !isCenterBadge(r, c)) {
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

  // 3. Center Logo Badge (jika logoType !== "none")
  if (logoType !== "none") {
    const centerPx = size / 2;
    const badgePx = size * 0.23;
    const badgeRadius = badgePx / 2;

    ctx.save();
    // Circle badge background
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
    ctx.shadowBlur = Math.max(3, size * 0.015);
    ctx.shadowOffsetY = Math.max(1, size * 0.005);
    ctx.beginPath();
    ctx.arc(centerPx, centerPx, badgeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Border ring around badge
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(1.5, size * 0.006);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.stroke();

    // Draw chosen vector icon
    const iconSize = badgePx * 0.62;
    if (logoType === "google") {
      drawGoogleLogo(ctx, centerPx, centerPx, iconSize);
    } else if (logoType === "star") {
      drawStarLogo(ctx, centerPx, centerPx, iconSize);
    } else if (logoType === "nfc") {
      drawNfcLogo(ctx, centerPx, centerPx, iconSize);
    }
    ctx.restore();
  }
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
      placement.dotStyle || "squares",
      placement.fgColor || "#000000",
      "transparent",
      placement.logoType || "none"
    );

    const composed = compositeCard(bgImage, qrCanvas, placement, code);
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

  // QR Placement State (Terpisah antara Template Standar dan Desain Klien)
  const [defaultPlacement, setDefaultPlacement] = useState<QRPlacementConfig>(DEFAULT_PLACEMENT);
  const [customPlacement, setCustomPlacement] = useState<QRPlacementConfig>(DEFAULT_PLACEMENT);
  const [showPlacementEditor, setShowPlacementEditor] = useState(false);
  const [snapFeedback, setSnapFeedback] = useState<string | null>(null);

  // Placement aktif sesuai mode yang sedang dipilih
  const placement = templateMode === "default" ? defaultPlacement : customPlacement;

  const setPlacement = useCallback(
    (updater: React.SetStateAction<QRPlacementConfig>) => {
      composedCanvases.current.clear();
      if (templateMode === "default") {
        setDefaultPlacement((prev) => {
          const next = typeof updater === "function" ? updater(prev) : updater;
          try {
            localStorage.setItem("default_qr_placement_v2", JSON.stringify({ placement: next }));
          } catch {}
          return next;
        });
      } else {
        setCustomPlacement((prev) => {
          const next = typeof updater === "function" ? updater(prev) : updater;
          try {
            localStorage.setItem("custom_qr_placement", JSON.stringify({ placement: next }));
          } catch {}
          return next;
        });
      }
    },
    [templateMode]
  );

  const [isZipping, setIsZipping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const composedCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const liveQrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"qr" | "position" | "labels">("qr");

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
    [bgImage, placement.size, setPlacement]
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

  // Load default template on mount + pulihkan konfigurasi tersimpan
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

    try {
      localStorage.removeItem("default_qr_placement"); // Bersihkan key lama jika ada
      const savedDefault = localStorage.getItem("default_qr_placement_v2");
      if (savedDefault) {
        const parsed = JSON.parse(savedDefault);
        if (parsed.placement) {
          setDefaultPlacement({ ...DEFAULT_PLACEMENT, ...parsed.placement });
        }
      }
    } catch {}

    try {
      const savedCustom = localStorage.getItem("custom_qr_placement");
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        if (parsed.placement) {
          setCustomPlacement({ ...DEFAULT_PLACEMENT, ...parsed.placement });
        }
      }
    } catch {}
  }, []);

  // Handle Switch Mode Template
  function handleSelectMode(mode: "default" | "custom") {
    if (mode === templateMode && ((mode === "default" && bgImage === defaultImg) || (mode === "custom" && bgImage === customImg))) {
      return;
    }
    if (mode === "default") {
      setTemplateMode("default");
      composedCanvases.current.clear();
      setCodes([]); // Tutup & bersihkan kartu yang sudah di-generate dari desain sebelumnya
      setSaveResult(null);
      if (defaultImg) {
        setBgImage(defaultImg);
      }
    } else {
      if (customImg) {
        setTemplateMode("custom");
        composedCanvases.current.clear();
        setCodes([]); // Tutup & bersihkan kartu yang sudah di-generate dari desain sebelumnya
        setSaveResult(null);
        setBgImage(customImg);
        setShowPlacementEditor(true);
      } else {
        // Trigger upload jika belum ada custom template
        fileInputRef.current?.click();
      }
    }
  }

  // Tutup studio dan reset bersih kembali ke desain Standar Hantic
  function handleCloseAndResetCustom() {
    setShowPlacementEditor(false);
    setTemplateMode("default");
    if (defaultImg) {
      setBgImage(defaultImg);
    }
    setCustomImg(null);
    setCustomImageName("");
    try {
      localStorage.removeItem("custom_qr_placement");
    } catch {}
    composedCanvases.current.clear();
    setCodes([]); // Kosongkan daftar kartu lama
    setSaveResult(null);
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
      img.onload = async () => {
        setCustomImg(img);
        setBgImage(img);
        setTemplateMode("custom");
        setShowPlacementEditor(true);
        composedCanvases.current.clear();
        setCodes([]); // Reset kartu yang di-generate agar user menekan Generate Kartu ulang untuk desain baru
        setSaveResult(null);

        const result = await detectClientQRCode(img);
        const newPlacement: QRPlacementConfig = {
          x: result.x,
          y: result.y,
          size: result.size,
          style: "white_box", // Kotak putih solid agar QR dummy bawaan klien 100% tertutup dan terhapus
          boxColor: "#FFFFFF",
          fgColor: "#000000",
          dotStyle: "squares",
          logoType: "none",
          padding: 18,
          radius: 14,
          showCtaText: false,
          ctaText: "Tap Kartu NFC / Scan QR",
          ctaColor: "#FFFFFF",
        };

        setPlacement(newPlacement);
        composedCanvases.current.clear();

        try {
          localStorage.setItem("custom_qr_placement", JSON.stringify({ placement: newPlacement }));
        } catch {}

        if (result.qrFound) {
          setSnapFeedback("🎯 Berhasil mendeteksi QR Code bawaan klien! Area QR lama otomatis ditimpa & diganti dengan QR unik baru.");
        } else if (result.detected) {
          setSnapFeedback("✅ Area kotak desain kartu terdeteksi! Ukuran & posisi QR disesuaikan.");
        } else {
          setSnapFeedback("ℹ️ Tidak ditemukan QR otomatis, posisi QR disesuaikan di tengah kartu. Silakan sesuaikan.");
        }
        setTimeout(() => setSnapFeedback(null), 4500);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Paskan ke Kotak Desain (Auto-Detect) - Tidak pernah mengubah gaya/warna pilihan user!
  function handleAutoSnapBox() {
    if (!bgImage) return;
    const result = detectBoxInImage(bgImage);
    setPlacement((prev) => ({
      ...prev,
      x: result.x,
      y: result.y,
      size: result.size,
      // style tetap terjaga sesuai preferensi user (white_box atau transparent)
    }));

    if (result.detected) {
      setSnapFeedback("✅ Area kotak kartu terdeteksi! Posisi & ukuran QR disesuaikan.");
    } else {
      setSnapFeedback("ℹ️ Tidak ditemukan kotak khusus, posisi QR diratakan tepat di tengah kartu.");
    }
    setTimeout(() => setSnapFeedback(null), 3500);
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
    setSnapFeedback("🎯 Posisi QR diratakan tepat di tengah kartu.");
    setTimeout(() => setSnapFeedback(null), 2500);
  }

  function handleResetPlacement() {
    if (templateMode === "default") {
      setPlacement(DEFAULT_PLACEMENT);
      try {
        localStorage.removeItem("default_qr_placement");
      } catch {}
      setSnapFeedback("↺ Desain & posisi QR dikembalikan ke standar kalibrasi Hantic.");
    } else {
      if (!bgImage) return;
      const cardW = bgImage.naturalWidth || DEFAULT_CARD_W;
      const cardH = bgImage.naturalHeight || DEFAULT_CARD_H;
      const defaultSz = Math.round(Math.min(cardW, cardH) * 0.42);
      setPlacement((prev) => ({
        ...prev,
        x: Math.round((cardW - defaultSz) / 2),
        y: Math.round((cardH - defaultSz) / 2),
        size: defaultSz,
        style: "white_box",
        padding: 18,
        radius: 16,
      }));
      setSnapFeedback("↺ Ukuran dan posisi QR dikembalikan ke standar awal.");
    }
    setTimeout(() => setSnapFeedback(null), 3000);
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

    // Otomatis scroll halus ke area kartu hasil cetak
    setTimeout(() => {
      document.getElementById("cards-grid-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  const handleCanvasReady = useCallback((code: string, canvas: HTMLCanvasElement) => {
    composedCanvases.current.set(code, canvas);
  }, []);



  function handleOpenPreview(code: string) {
    const canvas = composedCanvases.current.get(code);
    if (canvas) {
      setPreviewDataUrl(canvas.toDataURL("image/png"));
      setPreviewCode(code);
    } else {
      handleDownloadSingle(code);
    }
  }

  // ── Auto Save to Stock Helper ─────────────────────────────────────────────
  const autoSaveToStock = useCallback(async (codesToSave: string[]) => {
    if (!codesToSave || codesToSave.length === 0) return;
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: codesToSave }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveResult(`✅ ${data.saved ?? codesToSave.length} kartu otomatis disimpan ke stok!`);
        setTimeout(() => setSaveResult(null), 4000);
      }
    } catch {
      // Background auto-save without disruption
    }
  }, []);

  function handleDownloadSingle(code: string) {
    const canvas = composedCanvases.current.get(code);
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, `Kartu_${code}.png`);
        autoSaveToStock([code]);
      }
    }, "image/png");
  }

  async function handleDownloadAllPngDirect() {
    setIsSaving(true);
    setProgress("Mendownload file PNG...");
    for (const [code, canvas] of composedCanvases.current) {
      canvas.toBlob((blob) => {
        if (blob) saveAs(blob, `Kartu_${code}.png`);
      }, "image/png");
      await new Promise((r) => setTimeout(r, 220));
    }
    await autoSaveToStock(codes);
    setIsSaving(false);
    setProgress("");
  }

  async function handleSmartDownload() {
    if (codes.length === 0) return;
    if (codes.length >= 10) {
      await handleDownloadZip();
    } else if (codes.length === 1) {
      handleDownloadSingle(codes[0]);
    } else {
      await handleDownloadAllPngDirect();
    }
  }

  async function handleDetectAndReplaceQR() {
    if (!bgImage) return;
    setSnapFeedback("🔍 Sedang memindai QR code pada desain kartu...");
    const result = await detectClientQRCode(bgImage);

    setPlacement((prev) => ({
      ...prev,
      x: result.x,
      y: result.y,
      size: result.size,
      style: "white_box", // Wajib kotak putih solid agar QR lama 100% terhapus dan bersih
      padding: Math.max(16, prev.padding || 18),
      radius: Math.max(12, prev.radius || 14),
    }));

    if (result.qrFound) {
      setSnapFeedback(
        `🎯 QR Code bawaan klien terdeteksi! Area QR lama otomatis dihapus & ditimpa QR unik baru.`
      );
    } else if (result.detected) {
      setSnapFeedback("✅ Area kotak desain kartu terdeteksi! Posisi QR disesuaikan.");
    } else {
      setSnapFeedback("ℹ️ QR bawaan tidak terdeteksi otomatis, posisi QR diratakan di tengah kartu. Anda dapat menggeser/mengatur ukurannya.");
    }
    setTimeout(() => setSnapFeedback(null), 4500);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewCode) {
        setPreviewCode(null);
        setPreviewDataUrl(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewCode]);

  function handleClearAllCards() {
    if (codes.length === 0) return;
    if (window.confirm(`Hapus seluruh ${codes.length} kartu yang sudah di-generate?`)) {
      composedCanvases.current.clear();
      setCodes([]);
      setSaveResult(null);
    }
  }

  function handleDeleteSingle(codeToDelete: string, e: React.MouseEvent) {
    e.stopPropagation();
    composedCanvases.current.delete(codeToDelete);
    setCodes((prev) => {
      const next = prev.filter((c) => c !== codeToDelete);
      setCount(next.length);
      return next;
    });
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
    await autoSaveToStock(codes);
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

  const effectivePlacement = placement;

  const cardW = bgImage?.naturalWidth || DEFAULT_CARD_W;
  const cardH = bgImage?.naturalHeight || DEFAULT_CARD_H;

  // Live preview scale calculation (Desktop Studio Optimized)
  const maxPrevW = 340;
  const maxPrevH = 500;
  let prevW = maxPrevW;
  let prevH = Math.round(prevW * (cardH / cardW));
  if (prevH > maxPrevH) {
    prevH = maxPrevH;
    prevW = Math.round(prevH * (cardW / cardH));
  }
  const scale = prevW / cardW;
  const qrPrevLeft = Math.round(effectivePlacement.x * scale);
  const qrPrevTop = Math.round(effectivePlacement.y * scale);
  const qrPrevSize = Math.max(24, Math.round(effectivePlacement.size * scale));
  const qrPrevPad = Math.round((effectivePlacement.padding || 16) * scale);
  const qrPrevRad = Math.round((effectivePlacement.radius || 16) * scale);

  // Render live preview QR pada kartu secara real-time dengan gaya dotStyle & fgColor & logo aktif
  useEffect(() => {
    if (!liveQrCanvasRef.current) return;
    const innerSize = effectivePlacement.style === "white_box" ? Math.max(16, qrPrevSize - qrPrevPad * 2) : qrPrevSize;
    renderStyledQR(
      liveQrCanvasRef.current,
      "https://hantic.id/demo",
      innerSize,
      effectivePlacement.dotStyle || "squares",
      effectivePlacement.fgColor || "#000000",
      "transparent",
      effectivePlacement.logoType || "none"
    );
  }, [effectivePlacement.dotStyle, effectivePlacement.fgColor, effectivePlacement.style, effectivePlacement.logoType, qrPrevSize, qrPrevPad]);

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
          {/* Banner Notifikasi Layar Kecil / Mobile */}
          <div className="print-mobile-notice">
            <span style={{ fontSize: "1.1rem" }}>💻</span>
            <span>
              <strong>Mode Desktop Direkomendasikan:</strong> Pengaturan posisi presisi kartu &amp; ekspor ZIP dirancang untuk layar PC/laptop.
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div className="print-panel-title">🎴 Mesin Cetak QR Code &amp; Desain Kartu</div>
              <div className="print-panel-sub">
                Cetak massal QR code unik di atas template standar maupun desain kustom klien.
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
                  onClick={() => {
                    if (!customImg) {
                      fileInputRef.current?.click();
                    } else {
                      handleSelectMode("custom");
                    }
                  }}
                  title={customImg ? "Gunakan desain custom yang sudah diupload" : "Upload gambar kartu khusus dari klien"}
                >
                  {customImg
                    ? `🎨 ${customImageName ? customImageName.slice(0, 16) : "Desain Klien"}`
                    : "📁 Upload Desain Klien"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`print-btn ${showPlacementEditor ? "print-btn-indigo" : "print-btn-ghost"}`}
                onClick={() => setShowPlacementEditor((prev) => !prev)}
                style={{ fontSize: "0.74rem", padding: "6px 14px", gap: 6, fontWeight: 700 }}
                title="Buka Studio Desain untuk mengatur logo tengah (Google/Bintang/NFC/Polos), gaya titik, warna, dan posisi QR"
              >
                <span>🎨</span>
                <span>{showPlacementEditor ? "Tutup Studio Desain" : "Kustomisasi Desain QR"}</span>
              </button>

              {templateMode === "default" ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "#94A3B8", background: "rgba(255,255,255,0.03)", padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span>💳</span> Template Standar Hantic
                </div>
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "#FCD34D", background: "rgba(245,158,11,0.1)", padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(245,158,11,0.25)" }}>
                  <span>🎨</span> Desain Kustom Klien
                </div>
              )}
            </div>
          </div>

          {/* ── QR Placement & Position Adjuster Panel (BISA DIAKSES BAIK STANDAR MAUPUN CUSTOM) ── */}
          {showPlacementEditor && (
            <div className="placement-editor">
              <div className="placement-editor-header">
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F8FAFC", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span>🎯</span> Studio Desain &amp; Posisi QR Code
                    <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 6, background: templateMode === "default" ? "rgba(99,102,241,0.2)" : "rgba(245,158,11,0.2)", color: templateMode === "default" ? "#A5B4FC" : "#FCD34D", border: `1px solid ${templateMode === "default" ? "rgba(99,102,241,0.4)" : "rgba(245,158,11,0.4)"}` }}>
                      {templateMode === "default" ? "Template Standar Hantic" : `Desain Klien (${customImageName || "Kustom"})`}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: 2 }}>
                    {templateMode === "default"
                      ? "Pilih logo tengah (Google, Bintang 5, NFC, atau Polos tanpa logo), gaya titik, warna, dan ukuran QR untuk template standar."
                      : "Tarik kotak QR pada kartu atau klik langsung ke posisi baru. Atur gaya titik, warna, dan ukuran secara instan."}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {templateMode === "custom" && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="print-btn print-btn-ghost"
                      style={{ fontSize: "0.72rem", padding: "5px 12px" }}
                      title="Ganti dengan file gambar kartu lain"
                    >
                      🔄 Ganti Gambar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetPlacement}
                    className="print-btn print-btn-ghost"
                    style={{ fontSize: "0.72rem", padding: "5px 12px" }}
                    title={templateMode === "default" ? "Kembalikan ke setelan standar Hantic asli" : "Kembalikan posisi & ukuran ke setelan bawaan"}
                  >
                    ↺ Reset ke Standar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPlacementEditor(false)}
                    className="print-btn print-btn-ghost"
                    style={{ fontSize: "0.72rem", padding: "5px 12px", borderColor: "rgba(255,255,255,0.15)" }}
                    title="Tutup studio desain"
                  >
                    ✕ Tutup Studio
                  </button>
                </div>
              </div>

              <div className="placement-studio-grid">
                {/* ── Studio Left (or Top on Mobile): LIVE PREVIEW PANEL ── */}
                <div className="placement-preview-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#E0E7FF", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
                      Live Preview Kartu
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "#94A3B8", background: "rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: 4 }}>
                      {cardW} × {cardH} px
                    </span>
                  </div>

                  {/* Canvas Wrap / Interactive Box */}
                  <div
                    ref={previewWrapRef}
                    className="live-preview-box"
                    style={{ width: prevW, height: prevH }}
                    onClick={(e) => {
                      updatePlacementFromPointer(e.clientX, e.clientY);
                    }}
                    title="Klik atau geser QR Code ke posisi yang diinginkan"
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

                    {/* QR Code Overlay Box (Interactive Target Dragging) */}
                    <div
                      className="qr-target-overlay"
                      style={{
                        left: qrPrevLeft,
                        top: qrPrevTop,
                        width: qrPrevSize,
                        height: qrPrevSize,
                        borderRadius: placement.style === "white_box" ? qrPrevRad : 4,
                        background: placement.style === "white_box" ? (placement.boxColor || "#FFFFFF") : "transparent",
                        padding: placement.style === "white_box" ? qrPrevPad : 0,
                        boxSizing: "border-box",
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setIsDragging(true);
                      }}
                      onPointerMove={(e) => {
                        if (!isDragging) return;
                        e.stopPropagation();
                        updatePlacementFromPointer(e.clientX, e.clientY);
                      }}
                      onPointerUp={(e) => {
                        if (isDragging) {
                          e.stopPropagation();
                          setIsDragging(false);
                          try {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          } catch {}
                        }
                      }}
                      onPointerCancel={(e) => {
                        e.stopPropagation();
                        setIsDragging(false);
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
                          top: -19,
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#4F46E5",
                          color: "#FFF",
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
                        }}
                      >
                        🎯 QR {placement.size}px
                      </div>
                    </div>

                    {/* Live CTA Text Preview in Card */}
                    {placement.showCtaText && placement.ctaText && (
                      <div
                        style={{
                          position: "absolute",
                          left: qrPrevLeft + qrPrevSize / 2,
                          top: qrPrevTop + qrPrevSize + 6,
                          transform: "translateX(-50%)",
                          color: placement.ctaColor || "#FFFFFF",
                          fontSize: Math.max(9, Math.round(qrPrevSize * 0.08)),
                          fontWeight: 700,
                          textShadow: "0 2px 6px rgba(0,0,0,0.85)",
                          pointerEvents: "none",
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          maxWidth: prevW - 16,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {placement.ctaText}
                      </div>
                    )}

                    {/* Drag Hint */}
                    <span className="live-drag-hint">👆 Klik atau Tarik QR di Kartu</span>
                  </div>

                  {/* Coordinate Tag */}
                  <div style={{
                    fontSize: "0.72rem",
                    color: "#94A3B8",
                    textAlign: "center",
                    background: "rgba(255,255,255,0.03)",
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.06)",
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-around"
                  }}>
                    <span>X: <strong style={{ color: "#A5B4FC" }}>{placement.x}px</strong></span>
                    <span>Y: <strong style={{ color: "#A5B4FC" }}>{placement.y}px</strong></span>
                    <span>Ukuran: <strong style={{ color: "#34D399" }}>{placement.size}px</strong></span>
                  </div>

                  {/* Quick Action Buttons Directly Under Card */}
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    {templateMode === "custom" ? (
                      <button
                        type="button"
                        onClick={handleDetectAndReplaceQR}
                        className="print-btn"
                        style={{
                          width: "100%",
                          padding: "9px 14px",
                          fontSize: "0.78rem",
                          background: "linear-gradient(135deg, #4F46E5, #6366F1)",
                          border: "1px solid rgba(99,102,241,0.4)",
                          color: "#FFF",
                          boxShadow: "0 2px 10px rgba(99, 102, 241, 0.3)",
                          fontWeight: 700,
                          justifyContent: "center",
                          gap: 6,
                        }}
                        title="Deteksi QR Code bawaan pada desain kartu klien, lalu hapus/timpa bersih dengan QR code dinamis unik baru"
                      >
                        <span>🎯 Deteksi &amp; Timpa QR Desain Klien</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResetPlacement}
                        className="print-btn"
                        style={{
                          width: "100%",
                          padding: "9px 14px",
                          fontSize: "0.78rem",
                          background: "rgba(99, 102, 241, 0.15)",
                          border: "1px solid rgba(99, 102, 241, 0.35)",
                          color: "#C7D2FE",
                          fontWeight: 700,
                          justifyContent: "center",
                          gap: 6,
                        }}
                        title="Kembalikan posisi dan ukuran QR code tepat di tengah kotak putih kartu Standar Hantic"
                      >
                        <span>🎯 Paskan ke Kotak Standar Hantic ({DEFAULT_BOX_SIZE}×{DEFAULT_BOX_SIZE} px)</span>
                      </button>
                    )}

                    {snapFeedback && (
                      <div style={{
                        fontSize: "0.72rem",
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "rgba(99, 102, 241, 0.15)",
                        border: "1px solid rgba(99, 102, 241, 0.35)",
                        color: "#C7D2FE",
                        textAlign: "center",
                        animation: "fadeIn 0.2s ease",
                      }}>
                        {snapFeedback}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5 }}>
                      <button
                        type="button"
                        onClick={handleCenterFull}
                        className="print-btn print-btn-ghost"
                        style={{ padding: "6px 6px", fontSize: "0.7rem", justifyContent: "center", color: "#34D399", borderColor: "rgba(16,185,129,0.3)" }}
                        title="Pusatkan tepat di tengah-tengah kartu"
                      >
                        🎯 Center
                      </button>
                      <button
                        type="button"
                        onClick={handleCenterHorizontal}
                        className="print-btn print-btn-ghost"
                        style={{ padding: "6px 6px", fontSize: "0.7rem", justifyContent: "center" }}
                        title="Pusatkan posisi QR secara horizontal"
                      >
                        ↔️ Tengah X
                      </button>
                      <button
                        type="button"
                        onClick={handleCenterVertical}
                        className="print-btn print-btn-ghost"
                        style={{ padding: "6px 6px", fontSize: "0.7rem", justifyContent: "center" }}
                        title="Pusatkan posisi QR secara vertikal"
                      >
                        ↕️ Tengah Y
                      </button>
                      <button
                        type="button"
                        onClick={handleResetPlacement}
                        className="print-btn print-btn-ghost"
                        style={{ padding: "6px 6px", fontSize: "0.7rem", justifyContent: "center", color: "#F87171", borderColor: "rgba(239,68,68,0.25)" }}
                        title="Kembalikan ukuran dan posisi ke standar awal"
                      >
                        ↺ Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Studio Right: CONTROLS & INSPECTOR PANEL ── */}
                {/* ── Studio Right: TABBED CONTROLS & INSPECTOR PANEL ── */}
                <div className="placement-controls-panel">
                  {/* Studio Navigation Tabs */}
                  <div className="studio-tabs-bar">
                    <button
                      type="button"
                      onClick={() => setInspectorTab("qr")}
                      className={`studio-tab-btn ${inspectorTab === "qr" ? "active" : ""}`}
                    >
                      <span>🔲</span> Gaya &amp; Logo QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorTab("position")}
                      className={`studio-tab-btn ${inspectorTab === "position" ? "active" : ""}`}
                    >
                      <span>🎯</span> Posisi &amp; Ukuran
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorTab("labels")}
                      className={`studio-tab-btn ${inspectorTab === "labels" ? "active" : ""}`}
                    >
                      <span>💬</span> Teks Ajakan (CTA)
                    </button>
                  </div>

                  {/* ════ TAB 1: GAYA & LOGO QR ════ */}
                  {inspectorTab === "qr" && (
                    <>
                      {/* Sub-Card 1: Logo & Pola */}
                      <div className="inspector-card">
                        <div className="inspector-card-title">
                          <span>✨</span> Logo Tengah &amp; Pola Titik
                        </div>

                        <div className="slider-group-grid">
                          {/* Logo Tengah Watermark */}
                          <div className="slider-item">
                            <div className="slider-header">
                              <span>Logo Tengah (Brand Watermark):</span>
                              <strong style={{ color: (!placement.logoType || placement.logoType === "none") ? "#94A3B8" : "#A5B4FC" }}>
                                {placement.logoType === "google"
                                  ? "🔍 Google Official (4-Warna)"
                                  : placement.logoType === "star"
                                  ? "⭐ Bintang 5 (Gold Review)"
                                  : placement.logoType === "nfc"
                                  ? "📶 NFC Contactless"
                                  : "🚫 Polos (Tanpa Logo)"}
                              </strong>
                            </div>
                            <div className="studio-chip-group">
                              <button
                                type="button"
                                onClick={() => setPlacement((p) => ({ ...p, logoType: "none" }))}
                                className={`studio-chip ${(!placement.logoType || placement.logoType === "none") ? "active" : ""}`}
                              >
                                <span>🚫</span> Polos (Kosong)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPlacement((p) => ({ ...p, logoType: "google" }))}
                                className={`studio-chip ${placement.logoType === "google" ? "active" : ""}`}
                              >
                                <span>🔍</span> Google &quot;G&quot;
                              </button>
                              <button
                                type="button"
                                onClick={() => setPlacement((p) => ({ ...p, logoType: "star" }))}
                                className={`studio-chip ${placement.logoType === "star" ? "active" : ""}`}
                              >
                                <span>⭐</span> Bintang 5 (Gold)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPlacement((p) => ({ ...p, logoType: "nfc" }))}
                                className={`studio-chip ${placement.logoType === "nfc" ? "active" : ""}`}
                              >
                                <span>📶</span> NFC Contactless
                              </button>
                            </div>
                            <p style={{ fontSize: "0.69rem", color: "#64748B", margin: "2px 0 0", lineHeight: 1.4 }}>
                              Pilihan polos membuat QR code bersih &amp; standar. Jika memilih logo, digambar pada level koreksi error tinggi (H) agar tetap cepat terbaca kamera HP.
                            </p>
                          </div>

                          {/* Gaya Titik QR */}
                          <div className="slider-item" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                            <div className="slider-header">
                              <span>Gaya Pola Titik QR:</span>
                              <strong style={{ color: (!placement.dotStyle || placement.dotStyle === "squares") ? "#FFF" : placement.dotStyle === "rounded" ? "#A5B4FC" : "#34D399" }}>
                                {placement.dotStyle === "dots"
                                  ? "🔵 Titik Bulat (Modern)"
                                  : placement.dotStyle === "rounded"
                                  ? "✨ Halus (Rounded)"
                                  : "⬛ Standar (Kotak)"}
                              </strong>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => setPlacement((p) => ({ ...p, dotStyle: "squares" }))}
                                className="print-btn"
                                style={{
                                  flex: 1, padding: "7px 6px", fontSize: "0.72rem", justifyContent: "center",
                                  background: (!placement.dotStyle || placement.dotStyle === "squares") ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.04)",
                                  border: (!placement.dotStyle || placement.dotStyle === "squares") ? "1px solid #FFF" : "1px solid rgba(255,255,255,0.08)",
                                  color: (!placement.dotStyle || placement.dotStyle === "squares") ? "#FFF" : "#94A3B8",
                                  fontWeight: (!placement.dotStyle || placement.dotStyle === "squares") ? 700 : 500,
                                }}
                              >
                                ⬛ Kotak (Standar)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPlacement((p) => ({ ...p, dotStyle: "dots" }))}
                                className="print-btn"
                                style={{
                                  flex: 1, padding: "7px 6px", fontSize: "0.72rem", justifyContent: "center",
                                  background: placement.dotStyle === "dots" ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.04)",
                                  border: placement.dotStyle === "dots" ? "1px solid #10B981" : "1px solid rgba(255,255,255,0.08)",
                                  color: placement.dotStyle === "dots" ? "#34D399" : "#94A3B8",
                                  fontWeight: placement.dotStyle === "dots" ? 700 : 500,
                                }}
                              >
                                🔵 Titik Bulat
                              </button>
                              <button
                                type="button"
                                onClick={() => setPlacement((p) => ({ ...p, dotStyle: "rounded" }))}
                                className="print-btn"
                                style={{
                                  flex: 1, padding: "7px 6px", fontSize: "0.72rem", justifyContent: "center",
                                  background: placement.dotStyle === "rounded" ? "rgba(99, 102, 241, 0.25)" : "rgba(255,255,255,0.04)",
                                  border: placement.dotStyle === "rounded" ? "1px solid #6366F1" : "1px solid rgba(255,255,255,0.08)",
                                  color: placement.dotStyle === "rounded" ? "#C7D2FE" : "#94A3B8",
                                  fontWeight: placement.dotStyle === "rounded" ? 700 : 500,
                                }}
                              >
                                ✨ Halus
                              </button>
                            </div>
                          </div>

                          {/* Warna QR Code Foreground */}
                          <div className="slider-item" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                            <div className="slider-header">
                              <span>Warna QR Code:</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 12, height: 12, borderRadius: "50%", background: placement.fgColor || "#000000", border: "1px solid rgba(255,255,255,0.3)" }} />
                                <strong style={{ color: "#E2E8F0" }}>{placement.fgColor || "#000000"}</strong>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {[
                                { name: "Hitam", hex: "#000000" },
                                { name: "Navy", hex: "#1E3A8A" },
                                { name: "Emerald", hex: "#065F46" },
                                { name: "Indigo", hex: "#4338CA" },
                                { name: "Bronze", hex: "#78350F" },
                              ].map((c) => (
                                <button
                                  key={c.hex}
                                  type="button"
                                  onClick={() => setPlacement((p) => ({ ...p, fgColor: c.hex }))}
                                  className={`color-swatch-btn ${placement.fgColor === c.hex ? "active" : ""}`}
                                  style={{ background: c.hex }}
                                  title={`${c.name} (${c.hex})`}
                                />
                              ))}
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "4px 8px",
                                  borderRadius: 8,
                                  background: "rgba(255, 255, 255, 0.05)",
                                  border: "1px solid rgba(255, 255, 255, 0.12)",
                                }}
                              >
                                <span style={{ fontSize: "0.72rem", color: "#CBD5E1", fontWeight: 600 }}>🎨 Kustom:</span>
                                <label
                                  style={{
                                    position: "relative",
                                    width: 22,
                                    height: 22,
                                    borderRadius: 6,
                                    background: placement.fgColor || "#000000",
                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                    cursor: "pointer",
                                    display: "inline-block",
                                    overflow: "hidden",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                                    flexShrink: 0,
                                  }}
                                  title="Klik untuk memilih warna QR bebas"
                                >
                                  <input
                                    type="color"
                                    value={placement.fgColor || "#000000"}
                                    onChange={(e) => setPlacement((p) => ({ ...p, fgColor: e.target.value }))}
                                    style={{
                                      position: "absolute",
                                      top: -6,
                                      left: -6,
                                      width: 36,
                                      height: 36,
                                      opacity: 0,
                                      cursor: "pointer",
                                    }}
                                  />
                                </label>
                                <input
                                  type="text"
                                  value={placement.fgColor || "#000000"}
                                  onChange={(e) => setPlacement((p) => ({ ...p, fgColor: e.target.value }))}
                                  maxLength={7}
                                  placeholder="#000000"
                                  style={{
                                    width: 66,
                                    padding: "2px 4px",
                                    fontSize: "0.72rem",
                                    fontFamily: "monospace",
                                    fontWeight: 600,
                                    background: "rgba(0,0,0,0.3)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 4,
                                    color: "#93C5FD",
                                    outline: "none",
                                    textAlign: "center",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Card 2: Latar Belakang Kotak / Transparan */}
                      <div className="inspector-card">
                        <div className="inspector-card-title">
                          <span>⬜</span> Latar Belakang &amp; Penutup
                        </div>

                        <div className="slider-group-grid">
                          {/* Tipe Latar Belakang */}
                          <div className="slider-item">
                            <div className="slider-header">
                              <span>Tipe Latar Belakang:</span>
                              <strong style={{ color: placement.style === "white_box" ? "#60A5FA" : "#FBBF24" }}>
                                {placement.style === "white_box" ? "⬜ Kotak Penutup (Solid)" : "🔲 Transparan (Tanpa Kotak)"}
                              </strong>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setPlacement((p) => ({ ...p, style: "white_box" }))}
                                className="print-btn"
                                style={{
                                  flex: 1, padding: "8px 10px", fontSize: "0.75rem", justifyContent: "center",
                                  background: placement.style === "white_box" ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.04)",
                                  border: placement.style === "white_box" ? "1px solid #3B82F6" : "1px solid rgba(255,255,255,0.08)",
                                  color: placement.style === "white_box" ? "#93C5FD" : "#94A3B8",
                                  fontWeight: 600,
                                }}
                              >
                                ⬜ Kotak Penutup
                              </button>
                              <button
                                type="button"
                                onClick={() => setPlacement((p) => ({ ...p, style: "transparent" }))}
                                className="print-btn"
                                style={{
                                  flex: 1, padding: "8px 10px", fontSize: "0.75rem", justifyContent: "center",
                                  background: placement.style === "transparent" ? "rgba(245, 158, 11, 0.2)" : "rgba(255,255,255,0.04)",
                                  border: placement.style === "transparent" ? "1px solid #F59E0B" : "1px solid rgba(255,255,255,0.08)",
                                  color: placement.style === "transparent" ? "#FCD34D" : "#94A3B8",
                                  fontWeight: 600,
                                }}
                              >
                                🔲 Transparan
                              </button>
                            </div>
                            <p style={{ fontSize: "0.7rem", color: "#64748B", margin: "4px 0 0", lineHeight: 1.4 }}>
                              {placement.style === "white_box"
                                ? "Menutup & menimpa bersih area QR dummy pada kartu klien agar QR baru terlihat kontras & jelas."
                                : "QR code dicetak tanpa latar kotak (cocok jika desain klien sudah memiliki kotak latar sendiri)."}
                            </p>
                          </div>

                          {/* Pengaturan Kotak Penutup (Warna, Padding, Radius) */}
                          {placement.style === "white_box" && (
                            <>
                              <div className="slider-item" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                                <div className="slider-header">
                                  <span>Warna Kotak Penutup:</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: placement.boxColor || "#FFFFFF", border: "1px solid rgba(255,255,255,0.3)" }} />
                                    <strong style={{ color: "#E2E8F0" }}>{placement.boxColor || "#FFFFFF"}</strong>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                  {[
                                    { name: "Putih", hex: "#FFFFFF" },
                                    { name: "Krem", hex: "#F8FAFC" },
                                    { name: "Dark Slate", hex: "#0F172A" },
                                    { name: "Hitam", hex: "#000000" },
                                  ].map((c) => (
                                    <button
                                      key={c.hex}
                                      type="button"
                                      onClick={() => setPlacement((p) => ({ ...p, boxColor: c.hex }))}
                                      className={`color-swatch-btn ${(placement.boxColor || "#FFFFFF") === c.hex ? "active" : ""}`}
                                      style={{ background: c.hex, border: c.hex === "#FFFFFF" ? "1px solid rgba(255,255,255,0.3)" : undefined }}
                                      title={`${c.name} (${c.hex})`}
                                    />
                                  ))}
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "4px 8px",
                                      borderRadius: 8,
                                      background: "rgba(255, 255, 255, 0.05)",
                                      border: "1px solid rgba(255, 255, 255, 0.12)",
                                    }}
                                  >
                                    <span style={{ fontSize: "0.72rem", color: "#CBD5E1", fontWeight: 600 }}>🎨 Kustom:</span>
                                    <label
                                      style={{
                                        position: "relative",
                                        width: 22,
                                        height: 22,
                                        borderRadius: 6,
                                        background: placement.boxColor || "#FFFFFF",
                                        border: "1px solid rgba(255, 255, 255, 0.3)",
                                        cursor: "pointer",
                                        display: "inline-block",
                                        overflow: "hidden",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                                        flexShrink: 0,
                                      }}
                                      title="Pilih warna latar kotak bebas"
                                    >
                                      <input
                                        type="color"
                                        value={placement.boxColor || "#FFFFFF"}
                                        onChange={(e) => setPlacement((p) => ({ ...p, boxColor: e.target.value }))}
                                        style={{
                                          position: "absolute",
                                          top: -6,
                                          left: -6,
                                          width: 36,
                                          height: 36,
                                          opacity: 0,
                                          cursor: "pointer",
                                        }}
                                      />
                                    </label>
                                    <input
                                      type="text"
                                      value={placement.boxColor || "#FFFFFF"}
                                      onChange={(e) => setPlacement((p) => ({ ...p, boxColor: e.target.value }))}
                                      maxLength={7}
                                      placeholder="#FFFFFF"
                                      style={{
                                        width: 66,
                                        padding: "2px 4px",
                                        fontSize: "0.72rem",
                                        fontFamily: "monospace",
                                        fontWeight: 600,
                                        background: "rgba(0,0,0,0.3)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 4,
                                        color: "#93C5FD",
                                        outline: "none",
                                        textAlign: "center",
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 4 }}>
                                <div className="slider-item">
                                  <div className="slider-header">
                                    <span>Margin:</span>
                                    <strong style={{ color: "#E2E8F0" }}>{placement.padding ?? 18}px</strong>
                                  </div>
                                  <input
                                    type="range"
                                    className="slider-input"
                                    min={6}
                                    max={36}
                                    value={placement.padding ?? 18}
                                    onChange={(e) => setPlacement((p) => ({ ...p, padding: Number(e.target.value) }))}
                                  />
                                </div>
                                <div className="slider-item">
                                  <div className="slider-header">
                                    <span>Radius:</span>
                                    <strong style={{ color: "#E2E8F0" }}>{placement.radius ?? 16}px</strong>
                                  </div>
                                  <input
                                    type="range"
                                    className="slider-input"
                                    min={0}
                                    max={32}
                                    value={placement.radius ?? 16}
                                    onChange={(e) => setPlacement((p) => ({ ...p, radius: Number(e.target.value) }))}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ════ TAB 2: POSISI & UKURAN ════ */}
                  {inspectorTab === "position" && (
                    <>
                      {/* Sub-Card 1: Ukuran & Presets */}
                      <div className="inspector-card">
                        <div className="inspector-card-title">
                          <span>📏</span> Ukuran QR &amp; Deteksi Cerdas
                        </div>

                        <div className="slider-group-grid">
                          {templateMode === "custom" ? (
                            <button
                              type="button"
                              onClick={handleDetectAndReplaceQR}
                              className="print-btn"
                              style={{
                                width: "100%",
                                padding: "9px 14px",
                                fontSize: "0.78rem",
                                background: "linear-gradient(135deg, #4F46E5, #6366F1)",
                                border: "1px solid rgba(99,102,241,0.4)",
                                color: "#FFF",
                                boxShadow: "0 2px 10px rgba(99, 102, 241, 0.3)",
                                fontWeight: 700,
                                justifyContent: "center",
                                gap: 6,
                              }}
                              title="Deteksi QR Code dummy klien dan sesuaikan posisi & ukuran secara instan"
                            >
                              <span>🎯 Deteksi &amp; Timpa QR Desain Klien</span>
                            </button>
                          ) : (
                            <div style={{
                              padding: "10px 14px",
                              borderRadius: 8,
                              background: "rgba(99, 102, 241, 0.1)",
                              border: "1px solid rgba(99, 102, 241, 0.25)",
                              fontSize: "0.73rem",
                              color: "#C7D2FE",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}>
                              <span>📐</span>
                              <span>Posisi awal telah terkalibrasi presisi di kotak kartu Standar Hantic ({DEFAULT_BOX_SIZE}×{DEFAULT_BOX_SIZE} px). Anda bebas mengatur ulang ukuran atau posisi jika diinginkan.</span>
                            </div>
                          )}

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

                            {/* Presets Ukuran Cepat */}
                            <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
                              <span style={{ fontSize: "0.68rem", color: "#94A3B8" }}>Preset:</span>
                              {[0.28, 0.36, 0.44, 0.52].map((ratio) => {
                                const sz = Math.round(Math.min(cardW, cardH) * ratio);
                                const isActive = Math.abs(placement.size - sz) < 5;
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
                                      padding: "3px 7px",
                                      borderColor: isActive ? "rgba(99,102,241,0.6)" : undefined,
                                      background: isActive ? "rgba(99,102,241,0.2)" : undefined,
                                      color: isActive ? "#A5B4FC" : undefined,
                                    }}
                                  >
                                    {Math.round(ratio * 100)}%
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Card 2: Posisi X/Y & D-Pad */}
                      <div className="inspector-card">
                        <div className="inspector-card-title">
                          <span>🧭</span> Posisi Presisi &amp; Geser Halus
                        </div>

                        <div className="slider-group-grid">
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

                          {/* D-Pad Steppers: ±10px and ±2px */}
                          <div className="dpad-container">
                            <div className="nudge-ctrl-box">
                              <span style={{ fontSize: "0.74rem", color: "#94A3B8", fontWeight: 600 }}>Geser (±10px):</span>
                              <button type="button" onClick={() => handleNudge(-10, 0)} className="nudge-btn" title="Geser ke kiri 10px">⬅️ Kiri</button>
                              <button type="button" onClick={() => handleNudge(10, 0)} className="nudge-btn" title="Geser ke kanan 10px">➡️ Kanan</button>
                              <button type="button" onClick={() => handleNudge(0, -10)} className="nudge-btn" title="Geser ke atas 10px">⬆️ Atas</button>
                              <button type="button" onClick={() => handleNudge(0, 10)} className="nudge-btn" title="Geser ke bawah 10px">⬇️ Bawah</button>
                            </div>

                            <div className="nudge-ctrl-box">
                              <span style={{ fontSize: "0.74rem", color: "#94A3B8", fontWeight: 600 }}>Halus (±2px):</span>
                              <button type="button" onClick={() => handleNudge(-2, 0)} className="nudge-btn" title="Geser ke kiri 2px">◀ 2px</button>
                              <button type="button" onClick={() => handleNudge(2, 0)} className="nudge-btn" title="Geser ke kanan 2px">2px ▶</button>
                              <button type="button" onClick={() => handleNudge(0, -2)} className="nudge-btn" title="Geser ke atas 2px">▲ 2px</button>
                              <button type="button" onClick={() => handleNudge(0, 2)} className="nudge-btn" title="Geser ke bawah 2px">▼ 2px</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ════ TAB 3: TEKS AJAKAN (CTA) ════ */}
                  {inspectorTab === "labels" && (
                    <>
                      {/* Sub-Card 1: Call-to-Action (CTA) Text & Quick Presets */}
                      <div className="inspector-card">
                        <div className="inspector-card-title">
                          <span>💬</span> Kalimat &amp; Redaksi Ajakan
                        </div>

                        <div className="slider-group-grid">
                          <div className="studio-switch-row">
                            <div>
                              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#E2E8F0" }}>Teks di Bawah QR Code</div>
                              <div style={{ fontSize: "0.68rem", color: "#94A3B8" }}>Cetak kalimat ajakan ulasan presisi di bawah QR</div>
                            </div>
                            <input
                              type="checkbox"
                              checked={placement.showCtaText || false}
                              onChange={(e) => setPlacement((p) => ({ ...p, showCtaText: e.target.checked }))}
                              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#6366F1" }}
                            />
                          </div>

                          {placement.showCtaText ? (
                            <>
                              <div className="slider-item">
                                <span style={{ fontSize: "0.74rem", color: "#94A3B8", fontWeight: 600 }}>Pilih Kalimat Cepat:</span>
                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                  {[
                                    "Tap Kartu NFC / Scan QR",
                                    "Beri Ulasan Bintang 5 ⭐",
                                    "Scan Disini untuk Review ⭐⭐⭐⭐⭐",
                                    "Ulas Pengalaman Anda di Google",
                                  ].map((text) => (
                                    <button
                                      key={text}
                                      type="button"
                                      onClick={() => setPlacement((p) => ({ ...p, ctaText: text }))}
                                      className="nudge-btn"
                                      style={{
                                        textAlign: "left",
                                        padding: "7px 11px",
                                        borderColor: placement.ctaText === text ? "rgba(99,102,241,0.7)" : undefined,
                                        background: placement.ctaText === text ? "rgba(99,102,241,0.22)" : undefined,
                                        color: placement.ctaText === text ? "#C7D2FE" : undefined,
                                        fontWeight: placement.ctaText === text ? 700 : 500,
                                      }}
                                    >
                                      {text}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="slider-item">
                                <span style={{ fontSize: "0.74rem", color: "#CBD5E1", fontWeight: 600 }}>Kustom Teks Ulasan:</span>
                                <input
                                  type="text"
                                  value={placement.ctaText || ""}
                                  onChange={(e) => setPlacement((p) => ({ ...p, ctaText: e.target.value }))}
                                  placeholder="Ketik kalimat ajakan ulasan bebas..."
                                  style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "9px 12px",
                                    fontSize: "0.82rem",
                                    borderRadius: 8,
                                    background: "rgba(255, 255, 255, 0.06)",
                                    border: "1px solid rgba(255, 255, 255, 0.16)",
                                    color: "#FFFFFF",
                                    outline: "none",
                                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
                                  }}
                                />
                                <span style={{ fontSize: "0.68rem", color: "#64748B" }}>
                                  Teks ini akan dicetak otomatis di bawah QR Code dengan bayangan tajam agar mudah dibaca.
                                </span>
                              </div>
                            </>
                          ) : (
                            <div style={{
                              padding: "16px 14px",
                              borderRadius: 10,
                              background: "rgba(255, 255, 255, 0.02)",
                              border: "1px dashed rgba(255, 255, 255, 0.08)",
                              textAlign: "center",
                              fontSize: "0.75rem",
                              color: "#64748B",
                              lineHeight: 1.5,
                            }}>
                              Aktifkan opsi di atas jika Anda ingin mencetak teks ajakan ulasan (CTA) langsung pada fisik kartu.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sub-Card 2: Warna & Pratinjau Tampilan Teks */}
                      <div className="inspector-card">
                        <div className="inspector-card-title">
                          <span>🎨</span> Warna &amp; Pratinjau Teks
                        </div>

                        <div className="slider-group-grid">
                          {placement.showCtaText ? (
                            <>
                              <div className="slider-item">
                                <div className="slider-header">
                                  <span>Warna Teks CTA:</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: placement.ctaColor || "#FFFFFF", border: "1px solid rgba(255,255,255,0.3)" }} />
                                    <strong style={{ color: "#E2E8F0" }}>{placement.ctaColor || "#FFFFFF"}</strong>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                  {[
                                    { name: "Putih", hex: "#FFFFFF" },
                                    { name: "Emas", hex: "#FBBF24" },
                                    { name: "Biru", hex: "#60A5FA" },
                                    { name: "Hijau", hex: "#34D399" },
                                    { name: "Hitam", hex: "#000000" },
                                  ].map((c) => (
                                    <button
                                      key={c.hex}
                                      type="button"
                                      onClick={() => setPlacement((p) => ({ ...p, ctaColor: c.hex }))}
                                      className={`color-swatch-btn ${(placement.ctaColor || "#FFFFFF") === c.hex ? "active" : ""}`}
                                      style={{ background: c.hex, border: c.hex === "#FFFFFF" ? "1px solid rgba(255,255,255,0.3)" : undefined }}
                                      title={`${c.name} (${c.hex})`}
                                    />
                                  ))}
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "4px 8px",
                                      borderRadius: 8,
                                      background: "rgba(255, 255, 255, 0.05)",
                                      border: "1px solid rgba(255, 255, 255, 0.12)",
                                    }}
                                  >
                                    <span style={{ fontSize: "0.72rem", color: "#CBD5E1", fontWeight: 600 }}>🎨 Kustom:</span>
                                    <label
                                      style={{
                                        position: "relative",
                                        width: 22,
                                        height: 22,
                                        borderRadius: 6,
                                        background: placement.ctaColor || "#FFFFFF",
                                        border: "1px solid rgba(255, 255, 255, 0.3)",
                                        cursor: "pointer",
                                        display: "inline-block",
                                        overflow: "hidden",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                                        flexShrink: 0,
                                      }}
                                      title="Pilih warna teks bebas"
                                    >
                                      <input
                                        type="color"
                                        value={placement.ctaColor || "#FFFFFF"}
                                        onChange={(e) => setPlacement((p) => ({ ...p, ctaColor: e.target.value }))}
                                        style={{
                                          position: "absolute",
                                          top: -6,
                                          left: -6,
                                          width: 36,
                                          height: 36,
                                          opacity: 0,
                                          cursor: "pointer",
                                        }}
                                      />
                                    </label>
                                    <input
                                      type="text"
                                      value={placement.ctaColor || "#FFFFFF"}
                                      onChange={(e) => setPlacement((p) => ({ ...p, ctaColor: e.target.value }))}
                                      maxLength={7}
                                      placeholder="#FFFFFF"
                                      style={{
                                        width: 66,
                                        padding: "2px 4px",
                                        fontSize: "0.72rem",
                                        fontFamily: "monospace",
                                        fontWeight: 600,
                                        background: "rgba(0,0,0,0.3)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 4,
                                        color: "#93C5FD",
                                        outline: "none",
                                        textAlign: "center",
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Live Preview Box */}
                              <div style={{
                                marginTop: 6,
                                padding: "14px 16px",
                                borderRadius: 10,
                                background: "rgba(0, 0, 0, 0.45)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                              }}>
                                <span style={{ fontSize: "0.68rem", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                                  Pratinjau Teks Pada Kartu
                                </span>
                                <div style={{
                                  fontSize: "0.95rem",
                                  fontWeight: 700,
                                  color: placement.ctaColor || "#FFFFFF",
                                  textShadow: "0 2px 8px rgba(0,0,0,0.9)",
                                  textAlign: "center",
                                  wordBreak: "break-word",
                                }}>
                                  {placement.ctaText || "Tap Kartu NFC / Scan QR"}
                                </div>
                                <span style={{ fontSize: "0.66rem", color: "#94A3B8", textAlign: "center", marginTop: 2 }}>
                                  Otomatis diselaraskan tepat di bawah posisi QR Code
                                </span>
                              </div>
                            </>
                          ) : (
                            <div style={{
                              padding: "24px 16px",
                              borderRadius: 10,
                              background: "rgba(0, 0, 0, 0.25)",
                              border: "1px dashed rgba(255, 255, 255, 0.08)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                              textAlign: "center",
                            }}>
                              <span style={{ fontSize: "1.3rem" }}>✨</span>
                              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#94A3B8" }}>
                                Mode Bersih (Tanpa Teks Tambahan)
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "#64748B", maxWidth: 260 }}>
                                Kartu akan dicetak minimalis &amp; bersih hanya menampilkan QR Code dan desain latar belakang klien.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tombol Generator & Aksi (Desktop Command Center) ── */}
          <div className="print-controls">
            <div className="print-controls-left">
              <span className="print-ctrl-label">Jumlah Kartu:</span>

              <div className="print-number-input-wrap">
                <button type="button" className="print-num-btn" onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
                <input
                  type="number"
                  className="print-ctrl-input num-no-spin"
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value))))}
                  min={1} max={200}
                />
                <button type="button" className="print-num-btn" onClick={() => setCount((c) => Math.min(200, c + 1))}>+</button>
              </div>

              {/* Quick Presets */}
              <div style={{ display: "flex", gap: 5 }}>
                {[10, 25, 50, 100, 200].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className="print-btn print-btn-ghost"
                    style={{
                      padding: "6px 11px", fontSize: "0.75rem", borderRadius: 7,
                      background: count === n ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.03)",
                      color: count === n ? "#A5B4FC" : "#94A3B8",
                      borderColor: count === n ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)",
                      fontWeight: count === n ? 700 : 500,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <button type="button" className="print-btn print-btn-indigo" onClick={handleGenerate} disabled={!bgLoaded}>
                {bgLoaded ? "✨ Generate Kartu" : "⏳ Loading..."}
              </button>

              {/* Badge count real-time */}
              {codes.length > 0 && <span className="print-count-badge">🎯 {codes.length} Kartu Aktif</span>}
            </div>

            <div className="print-controls-right">
              {codes.length > 0 && (
                <button
                  type="button"
                  className="print-btn print-btn-ghost"
                  style={{ borderColor: "rgba(99,102,241,0.4)", color: "#A5B4FC" }}
                  onClick={() => document.getElementById("cards-grid-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  ⬇ Lihat Kartu
                </button>
              )}

              {codes.length > 0 && !isZipping && !isSaving && (
                <>
                  <button
                    type="button"
                    className="print-btn print-btn-amber"
                    onClick={handleSmartDownload}
                    title={
                      codes.length >= 10
                        ? `Download ${codes.length} kartu dalam 1 file ZIP (Otomatis simpan ke stok)`
                        : codes.length === 1
                        ? "Download 1 file PNG langsung (Otomatis simpan ke stok)"
                        : `Download ${codes.length} file PNG langsung satu per satu (Otomatis simpan ke stok)`
                    }
                  >
                    {codes.length >= 10 ? (
                      <>📦 Download ZIP ({codes.length})</>
                    ) : codes.length === 1 ? (
                      <>💾 Download PNG Kartu</>
                    ) : (
                      <>💾 Download {codes.length} PNG Langsung</>
                    )}
                  </button>

                  <button
                    type="button"
                    className="print-btn print-btn-ghost"
                    style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#FCA5A5" }}
                    onClick={handleClearAllCards}
                    title="Hapus semua kartu yang sudah di-generate"
                  >
                    🗑️ Hapus Semua
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
      <div className="print-grid-area" id="cards-grid-section">
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
            <div className="print-grid-action-bar" style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 18,
              padding: "12px 16px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12
            }}>
              <div>
                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#F8FAFC", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🎴</span> Hasil Cetak: {codes.length} Kartu Siap Pakai
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                  Klik kartu untuk melihat close-up detail ({cardW} × {cardH} px) • Tombol ✕ untuk hapus satuan
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="print-btn print-btn-ghost"
                  onClick={() => {
                    const allLinks = codes.map((c) => `${baseUrl}/c/${c}`).join("\n");
                    navigator.clipboard.writeText(allLinks);
                    setCopiedAll(true);
                    setTimeout(() => setCopiedAll(false), 2000);
                  }}
                  style={{
                    padding: "7px 12px",
                    fontSize: "0.78rem",
                    color: copiedAll ? "#34D399" : "#C7D2FE",
                    borderColor: copiedAll ? "rgba(16, 185, 129, 0.45)" : "rgba(99, 102, 241, 0.35)",
                    background: copiedAll ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.08)",
                  }}
                  title="Salin seluruh link URL NFC ke clipboard untuk dipaste ke NFC Tools"
                >
                  {copiedAll ? "✓ Semua Link Disalin!" : "📋 Salin Semua Link"}
                </button>
                
                {codes.length >= 10 ? (
                  <>
                    <button
                      type="button"
                      className="print-btn print-btn-amber"
                      onClick={handleDownloadZip}
                      disabled={isZipping}
                      style={{ padding: "7px 14px", fontSize: "0.78rem" }}
                      title="Download seluruh kartu dalam 1 file ZIP praktis (Otomatis simpan ke stok)"
                    >
                      📦 Download ZIP ({codes.length})
                    </button>
                    <button
                      type="button"
                      className="print-btn print-btn-ghost"
                      onClick={handleDownloadAllPngDirect}
                      style={{ padding: "7px 12px", fontSize: "0.78rem" }}
                      title="Download semua file PNG satu per satu tanpa kompresi ZIP"
                    >
                      ⬇ PNG Langsung
                    </button>
                  </>
                ) : codes.length === 1 ? (
                  <button
                    type="button"
                    className="print-btn print-btn-amber"
                    onClick={() => handleDownloadSingle(codes[0])}
                    style={{ padding: "8px 18px", fontSize: "0.82rem", fontWeight: 700 }}
                    title="Download langsung file PNG (Otomatis simpan ke stok)"
                  >
                    ⬇ Download PNG Langsung
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="print-btn print-btn-amber"
                      onClick={handleDownloadAllPngDirect}
                      style={{ padding: "8px 16px", fontSize: "0.8rem", fontWeight: 700 }}
                      title="Download langsung seluruh file PNG satu per satu (Otomatis simpan ke stok)"
                    >
                      ⬇ Download {codes.length} PNG Langsung
                    </button>
                    <button
                      type="button"
                      className="print-btn print-btn-ghost"
                      onClick={handleDownloadZip}
                      disabled={isZipping}
                      style={{ padding: "7px 12px", fontSize: "0.76rem" }}
                      title="Download sebagai file ZIP jika diinginkan"
                    >
                      📦 Jadikan ZIP
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="print-btn print-btn-ghost"
                  style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#FCA5A5", padding: "7px 12px", fontSize: "0.78rem" }}
                  onClick={handleClearAllCards}
                  title="Hapus seluruh kartu yang sudah di-generate"
                >
                  🗑️ Hapus Semua
                </button>
                <button
                  type="button"
                  className="print-btn print-btn-ghost"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  style={{ padding: "7px 12px", fontSize: "0.78rem" }}
                >
                  ⬆ Ke Atas
                </button>
              </div>
            </div>

            <div className="cards-grid">
              {codes.map((code) => (
                <div
                  key={code}
                  className="card-wrap"
                  onClick={() => handleOpenPreview(code)}
                  title="Klik kartu untuk melihat close-up resolusi tinggi"
                >
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSingle(code, e)}
                    className="card-delete-btn"
                    title={`Hapus kartu ${code}`}
                  >
                    ✕
                  </button>
                  <CardItem
                    code={code}
                    url={`${baseUrl}/c/${code}`}
                    bgImage={bgImage}
                    placement={effectivePlacement}
                    onCanvasReady={handleCanvasReady}
                  />
                  <div className="card-actions-row">
                    <button
                      type="button"
                      className="card-quick-btn card-preview-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPreview(code);
                      }}
                      title="Lihat close-up kartu resolusi penuh"
                    >
                      🔍 Close-Up
                    </button>
                    <button
                      type="button"
                      className="card-quick-btn card-download-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadSingle(code);
                      }}
                      title="Download file PNG kartu ini"
                    >
                      ⬇ PNG
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── MODAL POPUP CLOSE-UP PREVIEW RESOLUSI TINGGI ── */}
            {previewCode && previewDataUrl && (
              <div
                className="card-preview-modal-overlay"
                onClick={() => {
                  setPreviewCode(null);
                  setPreviewDataUrl(null);
                }}
              >
                <div
                  className="card-preview-modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="card-preview-modal-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: "1.25rem" }}>🔍</span>
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 700, color: "#F8FAFC" }}>
                          Close-Up Kartu: <span style={{ fontFamily: "monospace", color: "#A5B4FC" }}>{previewCode}</span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                          Dimensi Cetak Asli: {cardW} × {cardH} px • Format PNG High-Resolution
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="card-preview-modal-close"
                      onClick={() => {
                        setPreviewCode(null);
                        setPreviewDataUrl(null);
                      }}
                      aria-label="Tutup preview"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="card-preview-modal-body">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewDataUrl}
                      alt={`Close-up kartu ${previewCode}`}
                      className="card-preview-modal-img"
                    />
                  </div>

                  <div className="card-preview-modal-footer">
                    <div style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
                      💡 Kartu siap dicetak atau digunakan langsung ke percetakan.
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        className="print-btn print-btn-ghost"
                        onClick={() => {
                          setPreviewCode(null);
                          setPreviewDataUrl(null);
                        }}
                      >
                        Tutup
                      </button>
                      <button
                        type="button"
                        className="print-btn print-btn-amber"
                        style={{ fontWeight: 700, padding: "8px 20px", fontSize: "0.85rem" }}
                        onClick={() => handleDownloadSingle(previewCode)}
                      >
                        ⬇ Download File PNG Ini
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

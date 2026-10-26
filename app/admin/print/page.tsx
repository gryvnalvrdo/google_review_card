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
  x: DEFAULT_BOX_X,
  y: DEFAULT_BOX_Y,
  size: DEFAULT_BOX_SIZE,
  style: "white_box",
  padding: DEFAULT_QR_PAD,
  radius: 18,
  fgColor: "#000000",
  dotStyle: "dots",
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

  const boxX = placement.x;
  const boxY = placement.y;
  const boxSize = placement.size;

  // 2. Kotak putih rounded (jika dipilih opsi white_box)
  if (placement.style === "white_box") {
    const pad = Math.min(placement.padding ?? 18, Math.floor(boxSize * 0.3));
    const rad = placement.radius ?? 18;

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

    // Gambar QR di dalam kotak dengan padding
    const innerQrX = boxX + pad;
    const innerQrY = boxY + pad;
    const innerQrSize = Math.max(16, boxSize - pad * 2);
    ctx.drawImage(qrCanvas, innerQrX, innerQrY, innerQrSize, innerQrSize);
  } else {
    // 3. Gambar QR code langsung di atas kanvas (tanpa latar kotak)
    ctx.drawImage(qrCanvas, boxX, boxY, boxSize, boxSize);
  }

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
      "transparent"
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
  const [snapFeedback, setSnapFeedback] = useState<string | null>(null);

  const [isZipping, setIsZipping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const composedCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const liveQrCanvasRef = useRef<HTMLCanvasElement>(null);
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
  }, []);

  // Auto-save placement to localStorage HANYA saat di mode custom
  useEffect(() => {
    if (templateMode === "custom") {
      try {
        localStorage.setItem("custom_qr_placement", JSON.stringify({ placement }));
      } catch {}
    }
  }, [placement, templateMode]);

  // Handle Switch Mode Template
  function handleSelectMode(mode: "default" | "custom") {
    setTemplateMode(mode);
    composedCanvases.current.clear();
    if (mode === "default") {
      setShowPlacementEditor(false); // Tutup editor agar desain default standar tidak terganggu
      if (defaultImg) {
        setBgImage(defaultImg);
      }
      setPlacement(DEFAULT_PLACEMENT); // Selalu kunci ke setelan standar Hantic asli
    } else {
      if (customImg) {
        setBgImage(customImg);
        // Pulihkan custom placement yang pernah disimpan untuk desain kustom
        try {
          const savedConfig = localStorage.getItem("custom_qr_placement");
          if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            if (parsed.placement) {
              setPlacement({ ...parsed.placement, fgColor: "#000000" });
            }
          }
        } catch {}
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

        const result = detectBoxInImage(img);
        const newPlacement: QRPlacementConfig = {
          x: result.x,
          y: result.y,
          size: result.size,
          style: "white_box", // Default aman & kontras tinggi untuk semua desain
          fgColor: "#000000",
          dotStyle: "dots",
          padding: 18,
          radius: 16,
        };

        setPlacement(newPlacement);
        composedCanvases.current.clear();

        try {
          localStorage.setItem("custom_qr_placement", JSON.stringify({ placement: newPlacement }));
        } catch {}

        if (result.detected) {
          setSnapFeedback("✅ Area kotak desain kartu terdeteksi! Ukuran & posisi QR disesuaikan.");
          setTimeout(() => setSnapFeedback(null), 3500);
        }
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

  function handleDownloadSingle(code: string) {
    const canvas = composedCanvases.current.get(code);
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) saveAs(blob, `Kartu_${code}.png`);
    }, "image/png");
  }

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

  const effectivePlacement = templateMode === "default" ? DEFAULT_PLACEMENT : placement;

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

  // Render live preview QR pada kartu secara real-time dengan gaya dotStyle & fgColor aktif
  useEffect(() => {
    if (!liveQrCanvasRef.current) return;
    const innerSize = effectivePlacement.style === "white_box" ? Math.max(16, qrPrevSize - qrPrevPad * 2) : qrPrevSize;
    renderStyledQR(
      liveQrCanvasRef.current,
      "https://hantic.id/demo",
      innerSize,
      effectivePlacement.dotStyle || "dots",
      effectivePlacement.fgColor || "#000000",
      "transparent"
    );
  }, [effectivePlacement.dotStyle, effectivePlacement.fgColor, effectivePlacement.style, qrPrevSize, qrPrevPad]);

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

              {/* Tombol Ganti File hanya tampil saat mode custom aktif dan gambar sudah ada */}
              {templateMode === "custom" && customImg && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="print-btn print-btn-ghost"
                  style={{ fontSize: "0.74rem", padding: "5px 10px" }}
                  title="Ganti dengan file desain kartu lain"
                >
                  🔄 Ganti Gambar
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Toggle Editor Penyesuaian QR - HANYA TAMPIL DI MODE CUSTOM (Desain default tidak diganggu) */}
              {templateMode === "custom" ? (
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
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: "#94A3B8", background: "rgba(255,255,255,0.03)", padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span>🔒</span> Desain Standar Hantic (Presisi Terkalibrasi)
                </div>
              )}
            </div>
          </div>

          {/* ── QR Placement & Position Adjuster Panel (HANYA AKTIF DI MODE CUSTOM) ── */}
          {templateMode === "custom" && showPlacementEditor && (
            <div className="placement-editor">
              <div className="placement-editor-header">
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F8FAFC", display: "flex", alignItems: "center", gap: 7 }}>
                    <span>🎯</span> Studio Desain &amp; Posisi QR Code
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: 2 }}>
                    Tarik kotak QR pada kartu atau klik langsung ke posisi baru. Atur gaya titik, warna, dan ukuran secara instan.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handleResetPlacement}
                    className="print-btn print-btn-ghost"
                    style={{ fontSize: "0.72rem", padding: "5px 12px" }}
                    title="Kembalikan posisi & ukuran ke setelan bawaan"
                  >
                    ↺ Reset Posisi
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPlacementEditor(false)}
                    className="print-btn print-btn-ghost"
                    style={{ fontSize: "0.72rem", padding: "5px 10px" }}
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
                        background: placement.style === "white_box" ? "#FFFFFF" : "transparent",
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
                    <button
                      type="button"
                      onClick={handleAutoSnapBox}
                      className="print-btn"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        fontSize: "0.76rem",
                        background: "linear-gradient(135deg, #4F46E5, #6366F1)",
                        border: "1px solid rgba(99,102,241,0.4)",
                        color: "#FFF",
                        boxShadow: "0 2px 10px rgba(99, 102, 241, 0.3)",
                        fontWeight: 700,
                        justifyContent: "center",
                        gap: 6,
                      }}
                      title="Deteksi area kotak pada kartu secara otomatis dan letakkan QR di dalamnya tanpa mengubah gaya latar"
                    >
                      <span>🎯 Paskan ke Kotak Desain (Auto-Detect)</span>
                    </button>

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
                <div className="placement-controls-panel">
                  {/* Card 1: Latar Belakang & Pola QR */}
                  <div className="inspector-card">
                    <div className="inspector-card-title">
                      <span>🔲</span> Latar Belakang &amp; Pola QR
                    </div>

                    <div className="slider-group-grid">
                      {/* Gaya Latar QR */}
                      <div className="slider-item">
                        <div className="slider-header">
                          <span>Tipe Latar Belakang:</span>
                          <strong style={{ color: placement.style === "white_box" ? "#60A5FA" : "#FBBF24" }}>
                            {placement.style === "white_box" ? "⬜ Kotak Putih (Kontras Tinggi)" : "🔲 Transparan (Tanpa Latar)"}
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
                            ⬜ Kotak Putih
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
                            ? "Memberi bantalan putih agar QR code memiliki kontras jelas & 100% mudah discan kamera HP."
                            : "QR code dicetak langsung di atas kartu (cocok jika desain kartu Anda sudah memiliki kotak putih/terang sendiri)."}
                        </p>
                      </div>

                      {/* Sliders Khusus Kotak Putih: Margin & Radius */}
                      {placement.style === "white_box" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 4 }}>
                          <div className="slider-item">
                            <div className="slider-header">
                              <span>Jarak Tepi (Margin):</span>
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
                              <span>Lengkung Sudut (Radius):</span>
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
                      )}

                      {/* Gaya Pola Titik QR */}
                      <div className="slider-item" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                        <div className="slider-header">
                          <span>Gaya Pola Titik QR:</span>
                          <strong style={{ color: (!placement.dotStyle || placement.dotStyle === "dots") ? "#34D399" : placement.dotStyle === "rounded" ? "#A5B4FC" : "#FFF" }}>
                            {(!placement.dotStyle || placement.dotStyle === "dots")
                              ? "🔵 Titik Bulat (Modern)"
                              : placement.dotStyle === "rounded"
                              ? "✨ Halus (Rounded)"
                              : "⬛ Standar (Kotak)"}
                          </strong>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setPlacement((p) => ({ ...p, dotStyle: "dots" }))}
                            className="print-btn"
                            style={{
                              flex: 1, padding: "7px 6px", fontSize: "0.72rem", justifyContent: "center",
                              background: (!placement.dotStyle || placement.dotStyle === "dots") ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.04)",
                              border: (!placement.dotStyle || placement.dotStyle === "dots") ? "1px solid #10B981" : "1px solid rgba(255,255,255,0.08)",
                              color: (!placement.dotStyle || placement.dotStyle === "dots") ? "#34D399" : "#94A3B8",
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
                            }}
                          >
                            ✨ Halus
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlacement((p) => ({ ...p, dotStyle: "squares" }))}
                            className="print-btn"
                            style={{
                              flex: 1, padding: "7px 6px", fontSize: "0.72rem", justifyContent: "center",
                              background: placement.dotStyle === "squares" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                              border: placement.dotStyle === "squares" ? "1px solid #FFF" : "1px solid rgba(255,255,255,0.08)",
                              color: placement.dotStyle === "squares" ? "#FFF" : "#94A3B8",
                            }}
                          >
                            ⬛ Kotak
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Ukuran & Posisi Presisi */}
                  <div className="inspector-card">
                    <div className="inspector-card-title">
                      <span>📏</span> Ukuran &amp; Posisi Presisi
                    </div>

                    <div className="slider-group-grid">
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
                  <button type="button" className="print-btn print-btn-cyan" onClick={handleSaveToStok}>
                    💾 Simpan ke Stok
                  </button>

                  <button type="button" className="print-btn print-btn-amber" onClick={handleDownloadZip}>
                    📦 Download ZIP
                  </button>

                  <button type="button" className="print-btn print-btn-emerald" onClick={() => window.print()}>
                    🖨️ Print
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
            <div style={{
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
                  Klik kartu untuk download PNG ({cardW} × {cardH} px) • Tombol ✕ untuk hapus satuan
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="print-btn print-btn-amber"
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  style={{ padding: "7px 14px", fontSize: "0.78rem" }}
                >
                  📦 Download ZIP ({codes.length})
                </button>
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
                <div key={code} className="card-wrap" onClick={() => handleDownloadSingle(code)}>
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

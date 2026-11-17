"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import {
  ArrowUpRight,
  Crosshair,
  Monitor,
  Palette,
  RefreshCw,
  RotateCcw,
  Scan,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import CardPreviewGrid from "./_components/CardPreviewGrid";
import StudioInspector from "./_components/StudioInspector";
import {
  compositeCard,
  DEFAULT_BOX_SIZE,
  DEFAULT_BOX_X,
  DEFAULT_BOX_Y,
  DEFAULT_CARD_H,
  DEFAULT_CARD_W,
  DEFAULT_PLACEMENT,
  enhanceBackgroundImage,
  generateRandomCode,
  getQrRenderSize,
  processCustomDesign,
  QRPlacementConfig,
  renderStyledQR,
} from "./_lib/canvas-engine";

export default function PrintQRCodesPage() {
  const [count, setCount] = useState(10);
  const [codes, setCodes] = useState<string[]>([]);
  const [baseUrl, setBaseUrl] = useState("");

  const [templateMode, setTemplateMode] = useState<"default" | "custom">("default");
  const [customImageName, setCustomImageName] = useState("");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [defaultImg, setDefaultImg] = useState<HTMLImageElement | null>(null);
  const [customImg, setCustomImg] = useState<HTMLImageElement | null>(null);
  const [rawCustomImg, setRawCustomImg] = useState<HTMLImageElement | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);

  const [defaultPlacement, setDefaultPlacement] = useState<QRPlacementConfig>(DEFAULT_PLACEMENT);
  const [customPlacement, setCustomPlacement] = useState<QRPlacementConfig>(DEFAULT_PLACEMENT);
  const [showStudio, setShowStudio] = useState(false);
  const [snapFeedback, setSnapFeedback] = useState<string | null>(null);

  const [upscaleFactor, setUpscaleFactor] = useState<1 | 2 | 3 | 4>(2);
  const [sharpenLevel, setSharpenLevel] = useState<"off" | "medium" | "high">("medium");
  const [isScanningMock, setIsScanningMock] = useState(false);

  const [isZipping, setIsZipping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const composedCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const liveQrCanvasRef = useRef<HTMLCanvasElement>(null);

  const enhancedBgCanvas = useMemo(() => {
    if (!bgImage) return null;
    return enhanceBackgroundImage(bgImage, upscaleFactor, sharpenLevel);
  }, [bgImage, upscaleFactor, sharpenLevel]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "print_upscale_settings",
        JSON.stringify({ upscaleFactor, sharpenLevel })
      );
    } catch {}
    composedCanvases.current.clear();
  }, [upscaleFactor, sharpenLevel]);

  const placement = templateMode === "default" ? defaultPlacement : customPlacement;

  const setPlacement = useCallback(
    (updater: React.SetStateAction<QRPlacementConfig>) => {
      composedCanvases.current.clear();
      if (templateMode === "default") {
        setDefaultPlacement((prev) => {
          const next = typeof updater === "function" ? updater(prev) : updater;
          try {
            localStorage.setItem(
              "default_qr_style_v3",
              JSON.stringify({
                styleConfig: {
                  dotStyle: next.dotStyle,
                  logoType: next.logoType,
                  fgColor: next.fgColor,
                  boxColor: next.boxColor,
                },
              })
            );
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

  useEffect(() => {
    setBaseUrl(window.location.origin);
    const img = new Image();
    img.onload = () => {
      setDefaultImg(img);
      setBgImage(img);
      setBgLoaded(true);
    };
    img.crossOrigin = "anonymous";
    img.src = "/card-design.png";

    try {
      const savedStyle = localStorage.getItem("default_qr_style_v3");
      if (savedStyle) {
        const parsed = JSON.parse(savedStyle);
        if (parsed.styleConfig) {
          setDefaultPlacement((prev) => ({
            ...prev,
            ...parsed.styleConfig,
            x: DEFAULT_BOX_X,
            y: DEFAULT_BOX_Y,
            size: DEFAULT_BOX_SIZE,
            style: "white_box",
            boxColor: "#FFFFFF",
          }));
        }
      }
    } catch {}

    try {
      const savedQuality = localStorage.getItem("print_upscale_settings");
      if (savedQuality) {
        const q = JSON.parse(savedQuality);
        if ([1, 2, 3, 4].includes(q.upscaleFactor)) setUpscaleFactor(q.upscaleFactor);
        if (["off", "medium", "high"].includes(q.sharpenLevel)) setSharpenLevel(q.sharpenLevel);
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

  const updatePlacementFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (templateMode === "default" || !previewWrapRef.current) return;
      const rect = previewWrapRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const currentCardW = bgImage?.naturalWidth || DEFAULT_CARD_W;
      const currentCardH = bgImage?.naturalHeight || DEFAULT_CARD_H;

      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;

      const rawX = relX * currentCardW - placement.size / 2;
      const rawY = relY * currentCardH - placement.size / 2;

      const nextX = Math.max(0, Math.min(Math.max(0, currentCardW - placement.size), Math.round(rawX)));
      const nextY = Math.max(0, Math.min(Math.max(0, currentCardH - placement.size), Math.round(rawY)));

      setPlacement((prev) => ({ ...prev, x: nextX, y: nextY }));
    },
    [bgImage, placement.size, setPlacement, templateMode]
  );

  function handleNudge(dx: number, dy: number) {
    if (templateMode === "default") return;
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

  function handleSelectMode(mode: "default" | "custom") {
    if (mode === "default") {
      setTemplateMode("default");
      composedCanvases.current.clear();
      setCodes([]);
      setSaveResult(null);
      if (defaultImg) setBgImage(defaultImg);
      setDefaultPlacement((prev) => ({
        ...prev,
        x: DEFAULT_BOX_X,
        y: DEFAULT_BOX_Y,
        size: DEFAULT_BOX_SIZE,
        style: "white_box",
        boxColor: "#FFFFFF",
      }));
    } else if (customImg) {
      setTemplateMode("custom");
      composedCanvases.current.clear();
      setCodes([]);
      setSaveResult(null);
      setBgImage(customImg);
      setShowStudio(true);
    } else {
      fileInputRef.current?.click();
    }
  }

  function handleCloseAndResetCustom() {
    setShowStudio(false);
    setTemplateMode("default");
    if (defaultImg) setBgImage(defaultImg);
    setCustomImg(null);
    setRawCustomImg(null);
    setCustomImageName("");
    try {
      localStorage.removeItem("custom_qr_placement");
    } catch {}
    composedCanvases.current.clear();
    setCodes([]);
    setSaveResult(null);
  }

  function handleRestoreOriginalImage() {
    if (!rawCustomImg) return;
    setCustomImg(rawCustomImg);
    setBgImage(rawCustomImg);
    composedCanvases.current.clear();
    setSnapFeedback("Desain dikembalikan ke gambar asli.");
    setTimeout(() => setSnapFeedback(null), 3000);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        setRawCustomImg(img);
        setTemplateMode("custom");
        setShowStudio(true);
        composedCanvases.current.clear();
        setCodes([]);
        setSaveResult(null);

        setIsScanningMock(true);
        setSnapFeedback("Memindai dan membersihkan mockup QR pada desain...");
        const { result, activeImg, placement: finalPlacement } = await processCustomDesign(img);
        setCustomImg(activeImg);
        setBgImage(activeImg);
        setIsScanningMock(false);

        const newPlacement: QRPlacementConfig = {
          x: finalPlacement.x,
          y: finalPlacement.y,
          size: finalPlacement.size,
          style: "transparent",
          eraseBackground: false,
          boxColor: "#FFFFFF",
          fgColor: "#000000",
          dotStyle: "squares",
          logoType: "none",
          padding: 16,
          radius: 14,
        };
        setPlacement(newPlacement);

        if (result.qrFound) {
          setSnapFeedback("Mockup QR terdeteksi, dibersihkan, dan dipusatkan.");
        } else if (result.detected) {
          setSnapFeedback("Slot kotak terdeteksi dan posisi QR disesuaikan.");
        } else {
          setSnapFeedback("QR dummy tidak terdeteksi otomatis. Geser posisi QR secara manual.");
        }
        setTimeout(() => setSnapFeedback(null), 4500);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleDetectAndReplaceQR() {
    const sourceImg = rawCustomImg || customImg || bgImage;
    if (!sourceImg) return;
    setIsScanningMock(true);
    setSnapFeedback("Memindai ulang desain...");
    const { result, activeImg, placement: finalPlacement } = await processCustomDesign(sourceImg);
    setCustomImg(activeImg);
    setBgImage(activeImg);
    setIsScanningMock(false);

    setPlacement((prev) => ({
      ...prev,
      x: finalPlacement.x,
      y: finalPlacement.y,
      size: finalPlacement.size,
      style: "transparent",
      eraseBackground: false,
    }));
    setSnapFeedback(
      result.qrFound ? "Slot QR diperbarui dan dipusatkan." : "Posisi diratakan ke area tengah."
    );
    setTimeout(() => setSnapFeedback(null), 4000);
  }

  function handleResetPlacement() {
    if (templateMode === "default") {
      setPlacement(DEFAULT_PLACEMENT);
      try {
        localStorage.removeItem("default_qr_style_v3");
      } catch {}
    } else if (bgImage) {
      const w = bgImage.naturalWidth || DEFAULT_CARD_W;
      const h = bgImage.naturalHeight || DEFAULT_CARD_H;
      const sz = Math.round(Math.min(w, h) * 0.42);
      setPlacement((prev) => ({
        ...prev,
        x: Math.round((w - sz) / 2),
        y: Math.round((h - sz) / 2),
        size: sz,
        style: "white_box",
        padding: 16,
        radius: 14,
      }));
    }
    setSnapFeedback("Posisi dikembalikan ke default.");
    setTimeout(() => setSnapFeedback(null), 2500);
  }

  useEffect(() => {
    if (!bgLoaded || codes.length === 0) return;
    setCodes((prev) => {
      if (count === prev.length) return prev;
      if (count > prev.length) {
        const seen = new Set(prev);
        const extra: string[] = [];
        let guard = 0;
        while (prev.length + extra.length < count && guard < count * 10) {
          guard++;
          const c = generateRandomCode();
          if (!seen.has(c)) {
            seen.add(c);
            extra.push(c);
          }
        }
        return [...prev, ...extra];
      }
      prev.slice(count).forEach((c) => composedCanvases.current.delete(c));
      return prev.slice(0, count);
    });
  }, [count, bgLoaded, codes.length]);

  function handleGenerate() {
    composedCanvases.current.clear();
    setSaveResult(null);
    const seen = new Set<string>();
    const next: string[] = [];
    let guard = 0;
    while (next.length < count && guard < count * 10) {
      guard++;
      const c = generateRandomCode();
      if (!seen.has(c)) {
        seen.add(c);
        next.push(c);
      }
    }
    setCodes(next);
    setTimeout(() => {
      document.getElementById("cards-grid-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  const handleCanvasReady = useCallback((code: string, canvas: HTMLCanvasElement) => {
    composedCanvases.current.set(code, canvas);
  }, []);

  const getOrGenerateCardCanvas = useCallback(
    (code: string): HTMLCanvasElement | null => {
      let canvas = composedCanvases.current.get(code);
      if (!canvas) {
        const bg =
          enhancedBgCanvas ||
          (bgImage ? enhanceBackgroundImage(bgImage, upscaleFactor, sharpenLevel) : null);
        if (!bg) return null;

        const qrCanvas = document.createElement("canvas");
        const qrRes = getQrRenderSize(placement, upscaleFactor);
        renderStyledQR(
          qrCanvas,
          `${baseUrl}/c/${code}`,
          qrRes,
          placement.dotStyle || "squares",
          placement.fgColor || "#000000",
          "transparent",
          placement.logoType || "none"
        );
        canvas = compositeCard(bg, qrCanvas, placement, upscaleFactor);
        composedCanvases.current.set(code, canvas);
      }
      return canvas;
    },
    [enhancedBgCanvas, bgImage, upscaleFactor, sharpenLevel, placement, baseUrl]
  );

  const autoSaveToStock = useCallback(async (codesToSave: string[]) => {
    if (!codesToSave.length) return;
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: codesToSave }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveResult(
          `${data.saved ?? codesToSave.length} kode disimpan ke antrean siap assign (otomatis terhapus dalam 90 hari jika belum dipakai).`
        );
        window.dispatchEvent(new Event("stock-updated"));
      }
    } catch {}
  }, []);

  function handleDownloadSingle(code: string) {
    const canvas = getOrGenerateCardCanvas(code);
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
    setProgress("Mengunduh PNG...");
    for (const code of codes) {
      const canvas = getOrGenerateCardCanvas(code);
      if (canvas) {
        canvas.toBlob((blob) => {
          if (blob) saveAs(blob, `Kartu_${code}.png`);
        }, "image/png");
        await new Promise((r) => setTimeout(r, 220));
      }
    }
    await autoSaveToStock(codes);
    setIsSaving(false);
    setProgress("");
  }

  async function handleDownloadZip() {
    setIsZipping(true);
    const zip = new JSZip();
    let i = 0;
    for (const code of codes) {
      i++;
      setProgress(`Menyiapkan ${i}/${codes.length}`);
      const canvas = getOrGenerateCardCanvas(code);
      if (canvas) {
        const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
        zip.file(`Kartu_${code}.png`, await blob.arrayBuffer());
      }
    }
    setProgress("Membuat ZIP...");
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "NFC_Review_Cards.zip");
    await autoSaveToStock(codes);
    setIsZipping(false);
    setProgress("");
  }

  async function handleSmartDownload() {
    if (codes.length === 0) return;
    if (codes.length >= 10) await handleDownloadZip();
    else if (codes.length === 1) handleDownloadSingle(codes[0]);
    else await handleDownloadAllPngDirect();
  }

  function handleOpenPreview(code: string) {
    const canvas = getOrGenerateCardCanvas(code);
    if (!canvas) return;
    setPreviewDataUrl(canvas.toDataURL("image/png"));
    setPreviewCode(code);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewCode) {
        setPreviewCode(null);
        setPreviewDataUrl(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewCode]);

  const cardW = bgImage?.naturalWidth || DEFAULT_CARD_W;
  const cardH = bgImage?.naturalHeight || DEFAULT_CARD_H;

  const maxPrevW = 320;
  const maxPrevH = 460;
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

  useEffect(() => {
    if (!liveQrCanvasRef.current) return;
    const innerSize =
      placement.style === "white_box" ? Math.max(16, qrPrevSize - qrPrevPad * 2) : qrPrevSize;
    renderStyledQR(
      liveQrCanvasRef.current,
      "https://hantic.id/demo",
      innerSize,
      placement.dotStyle || "squares",
      placement.fgColor || "#000000",
      "transparent",
      placement.logoType || "none"
    );
  }, [
    placement.dotStyle,
    placement.fgColor,
    placement.style,
    placement.logoType,
    qrPrevSize,
    qrPrevPad,
  ]);

  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 md:hidden">
        <Monitor className="h-4 w-4 shrink-0 text-amber-400" />
        <span>Studio cetak &amp; ekspor ZIP direkomendasikan dibuka melalui desktop/laptop.</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
          Studio Cetak QR Kartu
        </h1>

        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
          <span className="rounded-lg border border-hairline bg-surface px-2.5 py-1 text-subtle">
            Asli: <strong className="text-ink">{cardW} x {cardH} px</strong>
          </span>
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
            Ekspor: <strong>{cardW * upscaleFactor} x {cardH * upscaleFactor} px ({upscaleFactor}x)</strong>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-subtle">Template:</span>
          <button
            type="button"
            onClick={() => handleSelectMode("default")}
            className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold transition-colors ${
              templateMode === "default"
                ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                : "border-hairline bg-elevated text-subtle hover:text-ink"
            }`}
          >
            Standar Hantic
          </button>

          {customImg ? (
            <div className="inline-flex overflow-hidden rounded-lg border border-hairline">
              <button
                type="button"
                onClick={() => handleSelectMode("custom")}
                className={`min-h-[36px] px-3 text-xs font-semibold transition-colors ${
                  templateMode === "custom"
                    ? "bg-indigo-500/20 text-indigo-200"
                    : "bg-elevated text-subtle hover:text-ink"
                }`}
              >
                {customImageName ? customImageName.slice(0, 20) : "Desain Klien"}
              </button>
              <button
                type="button"
                onClick={handleCloseAndResetCustom}
                className="border-l border-hairline bg-elevated px-2.5 text-rose-300 hover:bg-rose-500/15"
                title="Hapus desain klien"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-dashed border-hairline bg-elevated px-3 text-xs font-medium text-subtle hover:border-white/25 hover:text-ink"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Desain Klien</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowStudio((v) => !v)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3.5 text-xs font-semibold text-ink transition-colors hover:border-white/20"
        >
          <Palette className="h-3.5 w-3.5 text-indigo-400" />
          <span>{showStudio ? "Tutup Studio Desain" : "Buka Studio Desain"}</span>
        </button>
      </div>

      {showStudio && (
        <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
            <div className="text-sm font-semibold text-ink">
              Studio Desain &amp; Penempatan QR
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {templateMode === "custom" && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-subtle hover:text-ink"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Ganti Gambar</span>
                  </button>
                  {rawCustomImg && (
                    <button
                      type="button"
                      onClick={handleRestoreOriginalImage}
                      className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-amber-300"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Desain Asli</span>
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={handleResetPlacement}
                className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-subtle hover:text-ink"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="flex flex-col items-center gap-3 lg:col-span-5">
              <div
                ref={previewWrapRef}
                onClick={(e) => updatePlacementFromPointer(e.clientX, e.clientY)}
                className="relative overflow-hidden rounded-xl border border-hairline bg-black shadow-2xl"
                style={{ width: prevW, height: prevH }}
              >
                {bgImage ? (
                  <img
                    src={bgImage.src}
                    alt="Preview kartu"
                    className="pointer-events-none block select-none"
                    style={{ width: prevW, height: prevH }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    Memuat desain...
                  </div>
                )}

                <div
                  style={{
                    left: qrPrevLeft,
                    top: qrPrevTop,
                    width: qrPrevSize,
                    height: qrPrevSize,
                    borderRadius: placement.style === "white_box" ? qrPrevRad : 4,
                    background:
                      placement.style === "white_box" ? placement.boxColor || "#FFFFFF" : "transparent",
                    padding: placement.style === "white_box" ? qrPrevPad : 0,
                  }}
                  className="absolute box-border cursor-grab border border-dashed border-indigo-400 active:cursor-grabbing"
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
                >
                  <canvas
                    ref={liveQrCanvasRef}
                    width={
                      placement.style === "white_box"
                        ? Math.max(16, qrPrevSize - qrPrevPad * 2)
                        : qrPrevSize
                    }
                    height={
                      placement.style === "white_box"
                        ? Math.max(16, qrPrevSize - qrPrevPad * 2)
                        : qrPrevSize
                    }
                    className="pointer-events-none block h-full w-full"
                  />
                </div>
              </div>

              <div className="flex w-full max-w-xs justify-around rounded-lg border border-hairline bg-canvas px-3 py-1.5 font-mono text-[11px] tabular-nums text-subtle">
                <span>X: {placement.x}px</span>
                <span>Y: {placement.y}px</span>
                <span>Size: {placement.size}px</span>
              </div>

              {templateMode === "custom" && (
                <div className="flex w-full max-w-xs flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleDetectAndReplaceQR}
                    disabled={isScanningMock}
                    className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    <Scan className="h-3.5 w-3.5" />
                    <span>{isScanningMock ? "Memindai..." : "Pindai Ulang & Pusatkan"}</span>
                  </button>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const w = bgImage?.naturalWidth || DEFAULT_CARD_W;
                        const h = bgImage?.naturalHeight || DEFAULT_CARD_H;
                        setPlacement((p) => ({
                          ...p,
                          x: Math.round((w - p.size) / 2),
                          y: Math.round((h - p.size) / 2),
                        }));
                      }}
                      className="inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg border border-hairline bg-elevated text-[11px] text-emerald-300"
                    >
                      <Crosshair className="h-3 w-3" /> Center
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const w = bgImage?.naturalWidth || DEFAULT_CARD_W;
                        setPlacement((p) => ({ ...p, x: Math.round((w - p.size) / 2) }));
                      }}
                      className="min-h-[32px] rounded-lg border border-hairline bg-elevated text-[11px] text-subtle hover:text-ink"
                    >
                      Tengah X
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const h = bgImage?.naturalHeight || DEFAULT_CARD_H;
                        setPlacement((p) => ({ ...p, y: Math.round((h - p.size) / 2) }));
                      }}
                      className="min-h-[32px] rounded-lg border border-hairline bg-elevated text-[11px] text-subtle hover:text-ink"
                    >
                      Tengah Y
                    </button>
                  </div>
                </div>
              )}

              {snapFeedback && (
                <div className="w-full max-w-xs rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-center text-xs text-indigo-200">
                  {snapFeedback}
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
              <StudioInspector
                templateMode={templateMode}
                placement={placement}
                onChangePlacement={setPlacement}
                cardW={cardW}
                cardH={cardH}
                upscaleFactor={upscaleFactor}
                onChangeUpscale={setUpscaleFactor}
                sharpenLevel={sharpenLevel}
                onChangeSharpen={setSharpenLevel}
                onNudge={handleNudge}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-medium text-subtle">Jumlah Kartu:</span>
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-hairline bg-elevated">
            <button
              type="button"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              className="px-3 py-1.5 text-sm font-semibold text-subtle hover:text-ink"
            >
              -
            </button>
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value))))}
              className="num-no-spin w-12 bg-transparent text-center font-mono text-sm font-semibold text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => setCount((c) => Math.min(200, c + 1))}
              className="px-3 py-1.5 text-sm font-semibold text-subtle hover:text-ink"
            >
              +
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[10, 25, 50, 100, 200].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                  count === n
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                    : "border-hairline bg-elevated text-subtle hover:text-ink"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!bgLoaded}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{bgLoaded ? "Generate Kartu" : "Memuat desain..."}</span>
        </button>
      </div>

      {saveResult && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          <span>{saveResult}</span>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:text-emerald-200"
          >
            <span>Hubungkan di Dashboard</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <CardPreviewGrid
        codes={codes}
        baseUrl={baseUrl}
        enhancedBgCanvas={enhancedBgCanvas}
        placement={placement}
        upscaleFactor={upscaleFactor}
        cardW={cardW}
        cardH={cardH}
        isZipping={isZipping}
        isSaving={isSaving}
        progress={progress}
        onCanvasReady={handleCanvasReady}
        onOpenPreview={handleOpenPreview}
        onDownloadSingle={handleDownloadSingle}
        onDeleteSingle={(codeToDelete) => {
          composedCanvases.current.delete(codeToDelete);
          setCodes((prev) => {
            const next = prev.filter((c) => c !== codeToDelete);
            setCount(next.length);
            return next;
          });
        }}
        onDownloadZip={handleDownloadZip}
        onDownloadAllPngDirect={handleDownloadAllPngDirect}
        onSmartDownload={handleSmartDownload}
        onClearAll={() => {
          if (codes.length > 0 && window.confirm(`Hapus seluruh ${codes.length} kartu ini?`)) {
            composedCanvases.current.clear();
            setCodes([]);
            setSaveResult(null);
          }
        }}
        previewCode={previewCode}
        previewDataUrl={previewDataUrl}
        onClosePreview={() => {
          setPreviewCode(null);
          setPreviewDataUrl(null);
        }}
      />
    </div>
  );
}

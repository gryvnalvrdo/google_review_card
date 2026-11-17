"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Check, Copy, Download, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { QRPlacementConfig } from "../_lib/canvas-engine";
import {
  compositeCard,
  DEFAULT_CARD_H,
  DEFAULT_CARD_W,
  getQrRenderSize,
  renderStyledQR,
} from "../_lib/canvas-engine";

function CardThumb({
  code,
  url,
  enhancedBgCanvas,
  placement,
  upscaleFactor,
  onCanvasReady,
  onPreview,
}: {
  code: string;
  url: string;
  enhancedBgCanvas: HTMLCanvasElement | null;
  placement: QRPlacementConfig;
  upscaleFactor: number;
  onCanvasReady: (code: string, canvas: HTMLCanvasElement) => void;
  onPreview: () => void;
}) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enhancedBgCanvas) return;
    const qrCanvas = document.createElement("canvas");
    const qrRes = getQrRenderSize(placement, upscaleFactor);
    renderStyledQR(
      qrCanvas,
      url,
      qrRes,
      placement.dotStyle || "squares",
      placement.fgColor || "#000000",
      "transparent",
      placement.logoType || "none"
    );

    const composed = compositeCard(enhancedBgCanvas, qrCanvas, placement, upscaleFactor);
    if (previewRef.current) {
      const ctx = previewRef.current.getContext("2d")!;
      ctx.clearRect(0, 0, previewRef.current.width, previewRef.current.height);
      ctx.drawImage(composed, 0, 0, previewRef.current.width, previewRef.current.height);
    }
    onCanvasReady(code, composed);
    setReady(true);
  }, [enhancedBgCanvas, code, url, placement, upscaleFactor, onCanvasReady]);

  const targetW = enhancedBgCanvas?.width || DEFAULT_CARD_W * upscaleFactor;
  const targetH = enhancedBgCanvas?.height || DEFAULT_CARD_H * upscaleFactor;
  const previewW = 168;
  const previewH = Math.round(targetH * (previewW / targetW));

  return (
    <div
      className={`flex cursor-pointer flex-col items-center gap-2 transition-opacity ${
        ready ? "opacity-100" : "opacity-40"
      }`}
      onClick={onPreview}
    >
      <div className="overflow-hidden rounded-lg border border-hairline bg-black shadow-lg">
        <canvas
          ref={previewRef}
          width={previewW}
          height={previewH}
          className="block"
          style={{ width: previewW, height: previewH }}
        />
      </div>
      <code className="font-mono text-[11px] tracking-wider text-subtle">{code}</code>
    </div>
  );
}

interface CardPreviewGridProps {
  codes: string[];
  baseUrl: string;
  enhancedBgCanvas: HTMLCanvasElement | null;
  placement: QRPlacementConfig;
  upscaleFactor: 1 | 2 | 3 | 4;
  cardW: number;
  cardH: number;
  isZipping: boolean;
  isSaving: boolean;
  progress: string;
  onCanvasReady: (code: string, canvas: HTMLCanvasElement) => void;
  onOpenPreview: (code: string) => void;
  onDownloadSingle: (code: string) => void;
  onDeleteSingle: (code: string) => void;
  onDownloadZip: () => void;
  onDownloadAllPngDirect: () => void;
  onSmartDownload: () => void;
  onClearAll: () => void;
  previewCode: string | null;
  previewDataUrl: string | null;
  onClosePreview: () => void;
}

export default function CardPreviewGrid({
  codes,
  baseUrl,
  enhancedBgCanvas,
  placement,
  upscaleFactor,
  cardW,
  cardH,
  isZipping,
  isSaving,
  progress,
  onCanvasReady,
  onOpenPreview,
  onDownloadSingle,
  onDeleteSingle,
  onDownloadZip,
  onDownloadAllPngDirect,
  onSmartDownload,
  onClearAll,
  previewCode,
  previewDataUrl,
  onClosePreview,
}: CardPreviewGridProps) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setZoomed(false);
  }, [previewCode]);

  if (codes.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface px-6 py-14 text-center">
        <p className="text-sm font-semibold text-ink">Belum ada kartu di-generate</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-subtle">
          Atur jumlah kartu lalu klik Generate Kartu. Kode yang didownload akan otomatis tersimpan ke
          Stok Kartu Fisik.
        </p>
      </div>
    );
  }

  return (
    <div id="cards-grid-section" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3.5">
        <div>
          <div className="text-sm font-semibold text-ink tabular-nums">
            Hasil Cetak: {codes.length} Kartu
          </div>
          <div className="text-xs text-subtle tabular-nums">
            Klik kartu untuk inspeksi detail ({cardW * upscaleFactor} x {cardH * upscaleFactor} px)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(isZipping || isSaving) && (
            <span className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200">
              {isSaving ? "Menyimpan ke stok..." : progress}
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              const allLinks = codes.map((c) => `${baseUrl}/c/${c}`).join("\n");
              navigator.clipboard.writeText(allLinks).then(() => {
                setCopiedAll(true);
                setTimeout(() => setCopiedAll(false), 2000);
              });
            }}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-ink hover:border-white/20"
          >
            {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedAll ? "Semua Disalin" : "Salin Semua Link"}</span>
          </button>

          {codes.length >= 10 ? (
            <button
              type="button"
              onClick={onDownloadAllPngDirect}
              disabled={isZipping || isSaving}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-subtle hover:text-ink disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>PNG Satuan</span>
            </button>
          ) : codes.length > 1 ? (
            <button
              type="button"
              onClick={onDownloadZip}
              disabled={isZipping || isSaving}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-subtle hover:text-ink disabled:opacity-40"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Jadikan ZIP</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onSmartDownload}
            disabled={isZipping || isSaving}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-40"
          >
            {codes.length >= 10 ? (
              <>
                <Archive className="h-3.5 w-3.5" />
                <span>Download ZIP ({codes.length})</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>{codes.length === 1 ? "Download PNG" : `Download ${codes.length} PNG`}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClearAll}
            disabled={isZipping || isSaving}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus Semua</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {codes.map((code) => (
          <div
            key={code}
            className="group relative flex flex-col items-center gap-2.5 rounded-xl border border-hairline bg-surface p-3 transition-colors hover:border-white/20"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSingle(code);
              }}
              className="absolute right-2 top-2 z-10 rounded-md border border-hairline bg-canvas/90 p-1 text-muted opacity-90 hover:text-rose-300"
              title={`Hapus kartu ${code}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <CardThumb
              code={code}
              url={`${baseUrl}/c/${code}`}
              enhancedBgCanvas={enhancedBgCanvas}
              placement={placement}
              upscaleFactor={upscaleFactor}
              onCanvasReady={onCanvasReady}
              onPreview={() => onOpenPreview(code)}
            />

            <div className="grid w-full grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onOpenPreview(code)}
                className="inline-flex min-h-[30px] items-center justify-center gap-1 rounded-md border border-hairline bg-elevated text-[11px] font-medium text-subtle hover:text-ink"
              >
                <ZoomIn className="h-3 w-3" />
                <span>Detail</span>
              </button>
              <button
                type="button"
                onClick={() => onDownloadSingle(code)}
                className="inline-flex min-h-[30px] items-center justify-center gap-1 rounded-md border border-hairline bg-elevated text-[11px] font-medium text-emerald-300 hover:border-emerald-500/40"
              >
                <Download className="h-3 w-3" />
                <span>PNG</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {previewCode && previewDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={onClosePreview}
        >
          <div
            className={`flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl ${
              zoomed ? "max-w-[95vw]" : "max-w-2xl"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
              <div>
                <div className="text-sm font-semibold text-ink">
                  Close-Up Kartu:{" "}
                  <span className="font-mono text-indigo-300">{previewCode}</span>
                </div>
                <div className="text-xs text-subtle tabular-nums">
                  {cardW * upscaleFactor} x {cardH * upscaleFactor} px ({upscaleFactor}x HD)
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomed((v) => !v)}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-ink"
                >
                  {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
                  <span>{zoomed ? "Fit Layar" : "Zoom 100%"}</span>
                </button>
                <button
                  type="button"
                  onClick={onClosePreview}
                  className="rounded-lg border border-hairline bg-elevated p-1.5 text-subtle hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className="flex max-h-[65vh] justify-center overflow-auto bg-canvas/70 p-6"
              onClick={() => setZoomed((v) => !v)}
            >
              <img
                src={previewDataUrl}
                alt={`Preview kartu ${previewCode}`}
                className={zoomed ? "max-w-none cursor-zoom-out" : "max-h-[55vh] cursor-zoom-in object-contain"}
                style={zoomed ? { width: `${cardW * upscaleFactor}px` } : undefined}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3.5">
              <span className="text-xs text-subtle">Siap cetak PNG resolusi tinggi.</span>
              <button
                type="button"
                onClick={() => onDownloadSingle(previewCode)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-500"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

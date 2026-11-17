"use client";

import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Move, Palette, Sparkles } from "lucide-react";
import type { QRDotStyle, QRLogoType, QRPlacementConfig } from "../_lib/canvas-engine";
import { DEFAULT_BOX_SIZE, DEFAULT_BOX_X, DEFAULT_BOX_Y } from "../_lib/canvas-engine";

interface StudioInspectorProps {
  templateMode: "default" | "custom";
  placement: QRPlacementConfig;
  onChangePlacement: React.Dispatch<React.SetStateAction<QRPlacementConfig>>;
  cardW: number;
  cardH: number;
  upscaleFactor: 1 | 2 | 3 | 4;
  onChangeUpscale: (val: 1 | 2 | 3 | 4) => void;
  sharpenLevel: "off" | "medium" | "high";
  onChangeSharpen: (val: "off" | "medium" | "high") => void;
  onNudge: (dx: number, dy: number) => void;
}

function ColorSwatchRow({
  label,
  value,
  fallback,
  presets,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  presets: { name: string; hex: string }[];
  onChange: (hex: string) => void;
}) {
  const activeHex = (value || fallback).toLowerCase();
  return (
    <div className="space-y-2 border-t border-hairline pt-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-subtle">{label}</span>
        <span className="font-mono text-[11px] font-semibold text-ink">{value || fallback}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            title={`${c.name} (${c.hex})`}
            className={`h-7 w-7 rounded-lg border transition-transform ${
              activeHex === c.hex.toLowerCase()
                ? "scale-110 border-indigo-400 ring-2 ring-indigo-500/40"
                : "border-white/20 hover:scale-105"
            }`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
        <label
          title="Pilih warna kustom"
          className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-lg border border-white/25"
          style={{
            background: "conic-gradient(#f43f5e, #f59e0b, #10b981, #3b82f6, #a855f7, #f43f5e)",
          }}
        >
          <input
            type="color"
            value={value || fallback}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

export default function StudioInspector({
  templateMode,
  placement,
  onChangePlacement,
  cardW,
  cardH,
  upscaleFactor,
  onChangeUpscale,
  sharpenLevel,
  onChangeSharpen,
  onNudge,
}: StudioInspectorProps) {
  const [tab, setTab] = useState<"qr" | "position" | "resolution">("qr");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-hairline bg-canvas p-1">
        {(
          [
            { id: "qr", label: "Gaya & Logo", Icon: Palette },
            { id: "position", label: "Posisi & Ukuran", Icon: Move },
            { id: "resolution", label: "Kualitas HD", Icon: Sparkles },
          ] as const
        ).map((item) => {
          const Icon = item.Icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors ${
                active ? "bg-elevated text-ink ring-1 ring-white/10" : "text-subtle hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "qr" && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-hairline bg-canvas/50 p-4">
            <div className="text-xs font-semibold text-ink">Logo Tengah &amp; Pola Titik</div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { id: "none", label: "Polos" },
                  { id: "google", label: "Google G" },
                  { id: "star", label: "Bintang 5" },
                  { id: "nfc", label: "Ikon NFC" },
                ] as { id: QRLogoType; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangePlacement((p) => ({ ...p, logoType: item.id }))}
                  className={`min-h-[36px] rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                    (placement.logoType || "none") === item.id
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                      : "border-hairline bg-surface text-subtle hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 border-t border-hairline pt-3">
              <span className="block text-xs text-subtle">Pola Titik QR</span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "squares", label: "Kotak" },
                    { id: "dots", label: "Bulat" },
                    { id: "rounded", label: "Halus" },
                  ] as { id: QRDotStyle; label: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangePlacement((p) => ({ ...p, dotStyle: item.id }))}
                    className={`min-h-[36px] rounded-lg border text-xs font-medium transition-colors ${
                      (placement.dotStyle || "squares") === item.id
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                        : "border-hairline bg-surface text-subtle hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <ColorSwatchRow
              label="Warna QR Code"
              value={placement.fgColor || "#000000"}
              fallback="#000000"
              presets={[
                { name: "Hitam", hex: "#000000" },
                { name: "Navy", hex: "#1E3A8A" },
                { name: "Emerald", hex: "#065F46" },
                { name: "Indigo", hex: "#4338CA" },
                { name: "Bronze", hex: "#78350F" },
              ]}
              onChange={(hex) => onChangePlacement((p) => ({ ...p, fgColor: hex }))}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-hairline bg-canvas/50 p-4">
            <div className="text-xs font-semibold text-ink">Latar Belakang QR</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangePlacement((p) => ({ ...p, style: "white_box" }))}
                className={`min-h-[38px] rounded-lg border text-xs font-medium transition-colors ${
                  placement.style === "white_box"
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                    : "border-hairline bg-surface text-subtle hover:text-ink"
                }`}
              >
                Kotak Penutup
              </button>
              <button
                type="button"
                onClick={() => onChangePlacement((p) => ({ ...p, style: "transparent" }))}
                className={`min-h-[38px] rounded-lg border text-xs font-medium transition-colors ${
                  placement.style === "transparent"
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                    : "border-hairline bg-surface text-subtle hover:text-ink"
                }`}
              >
                Transparan
              </button>
            </div>

            {placement.style === "white_box" && (
              <>
                <ColorSwatchRow
                  label="Warna Kotak"
                  value={placement.boxColor || "#FFFFFF"}
                  fallback="#FFFFFF"
                  presets={[
                    { name: "Putih", hex: "#FFFFFF" },
                    { name: "Krem", hex: "#F8FAFC" },
                    { name: "Slate", hex: "#0F172A" },
                    { name: "Hitam", hex: "#000000" },
                  ]}
                  onChange={(hex) => onChangePlacement((p) => ({ ...p, boxColor: hex }))}
                />

                <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-subtle">Margin</span>
                      <span className="font-mono font-semibold tabular-nums text-ink">
                        {placement.padding ?? 18}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={6}
                      max={36}
                      value={placement.padding ?? 18}
                      onChange={(e) =>
                        onChangePlacement((p) => ({ ...p, padding: Number(e.target.value) }))
                      }
                      className="w-full accent-indigo-500"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-subtle">Radius</span>
                      <span className="font-mono font-semibold tabular-nums text-ink">
                        {placement.radius ?? 16}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={32}
                      value={placement.radius ?? 16}
                      onChange={(e) =>
                        onChangePlacement((p) => ({ ...p, radius: Number(e.target.value) }))
                      }
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "position" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3 text-xs leading-relaxed text-indigo-200">
            {templateMode === "custom"
              ? "Tarik kotak QR pada preview atau atur koordinat secara presisi di bawah ini."
              : `Template Standar terkunci di slot tengah (${DEFAULT_BOX_SIZE}x${DEFAULT_BOX_SIZE} px, X=${DEFAULT_BOX_X}, Y=${DEFAULT_BOX_Y}).`}
          </div>

          <div className="space-y-4 rounded-xl border border-hairline bg-canvas/50 p-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-subtle">Ukuran QR Code</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={60}
                    max={Math.min(cardW, cardH)}
                    value={placement.size}
                    onChange={(e) => {
                      const val = Math.max(
                        60,
                        Math.min(Math.min(cardW, cardH), Number(e.target.value))
                      );
                      onChangePlacement((p) => ({
                        ...p,
                        size: val,
                        x: Math.min(p.x, cardW - val),
                        y: Math.min(p.y, cardH - val),
                      }));
                    }}
                    className="w-16 rounded border border-hairline bg-elevated px-2 py-1 text-right font-mono text-xs text-ink"
                  />
                  <span className="text-muted">px</span>
                </div>
              </div>
              <input
                type="range"
                min={60}
                max={Math.min(cardW, cardH)}
                value={placement.size}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChangePlacement((p) => ({
                    ...p,
                    size: val,
                    x: Math.min(p.x, cardW - val),
                    y: Math.min(p.y, cardH - val),
                  }));
                }}
                className="w-full accent-indigo-500"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[0.28, 0.36, 0.44, 0.52].map((ratio) => {
                  const sz = Math.round(Math.min(cardW, cardH) * ratio);
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() =>
                        onChangePlacement((p) => ({
                          ...p,
                          size: sz,
                          x: Math.min(p.x, cardW - sz),
                          y: Math.min(p.y, cardH - sz),
                        }))
                      }
                      className="rounded border border-hairline bg-surface px-2.5 py-1 text-[11px] font-medium tabular-nums text-subtle hover:text-ink"
                    >
                      {Math.round(ratio * 100)}%
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-hairline pt-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-subtle">Posisi X</span>
                  <span className="font-mono tabular-nums text-ink">{placement.x}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(cardW - placement.size, 100)}
                  value={placement.x}
                  onChange={(e) =>
                    onChangePlacement((p) => ({ ...p, x: Number(e.target.value) }))
                  }
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-subtle">Posisi Y</span>
                  <span className="font-mono tabular-nums text-ink">{placement.y}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(cardH - placement.size, 100)}
                  value={placement.y}
                  onChange={(e) =>
                    onChangePlacement((p) => ({ ...p, y: Number(e.target.value) }))
                  }
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-hairline pt-3">
              <div className="text-xs text-subtle">Geser Halus</div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => onNudge(-10, 0)}
                  className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg border border-hairline bg-surface text-xs text-ink hover:border-white/20"
                >
                  <ArrowLeft className="h-3 w-3" /> 10
                </button>
                <button
                  type="button"
                  onClick={() => onNudge(10, 0)}
                  className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg border border-hairline bg-surface text-xs text-ink hover:border-white/20"
                >
                  10 <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onNudge(0, -10)}
                  className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg border border-hairline bg-surface text-xs text-ink hover:border-white/20"
                >
                  <ArrowUp className="h-3 w-3" /> 10
                </button>
                <button
                  type="button"
                  onClick={() => onNudge(0, 10)}
                  className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg border border-hairline bg-surface text-xs text-ink hover:border-white/20"
                >
                  <ArrowDown className="h-3 w-3" /> 10
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => onNudge(-2, 0)}
                  className="inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg border border-hairline bg-surface text-[11px] text-subtle hover:text-ink"
                >
                  <ArrowLeft className="h-3 w-3" /> 2px
                </button>
                <button
                  type="button"
                  onClick={() => onNudge(2, 0)}
                  className="inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg border border-hairline bg-surface text-[11px] text-subtle hover:text-ink"
                >
                  2px <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onNudge(0, -2)}
                  className="inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg border border-hairline bg-surface text-[11px] text-subtle hover:text-ink"
                >
                  <ArrowUp className="h-3 w-3" /> 2px
                </button>
                <button
                  type="button"
                  onClick={() => onNudge(0, 2)}
                  className="inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg border border-hairline bg-surface text-[11px] text-subtle hover:text-ink"
                >
                  <ArrowDown className="h-3 w-3" /> 2px
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "resolution" && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-hairline bg-canvas/50 p-4">
            <div className="text-xs font-semibold text-ink">Resolusi Ekspor Cetak</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([1, 2, 3, 4] as const).map((factor) => (
                <button
                  key={factor}
                  type="button"
                  onClick={() => onChangeUpscale(factor)}
                  className={`flex flex-col items-center justify-center rounded-lg border py-2.5 text-xs transition-colors ${
                    upscaleFactor === factor
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                      : "border-hairline bg-surface text-subtle hover:text-ink"
                  }`}
                >
                  <span className="font-semibold">
                    {factor}x {factor === 2 ? "HD" : factor >= 3 ? "Ultra" : "Normal"}
                  </span>
                  <span className="mt-0.5 font-mono text-[10px] opacity-80">
                    {cardW * factor}x{cardH * factor}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-hairline bg-canvas/50 p-4">
            <div className="text-xs font-semibold text-ink">Filter Ketajaman Teks (Anti-Blur)</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "off", label: "Mati" },
                  { id: "medium", label: "Sedang" },
                  { id: "high", label: "Tinggi" },
                ] as const
              ).map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => onChangeSharpen(lvl.id)}
                  className={`min-h-[36px] rounded-lg border text-xs font-medium transition-colors ${
                    sharpenLevel === lvl.id
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                      : "border-hairline bg-surface text-subtle hover:text-ink"
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

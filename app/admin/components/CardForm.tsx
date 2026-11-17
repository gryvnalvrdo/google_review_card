"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  MapPin,
  Package,
  RefreshCw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { InstagramIcon } from "./BrandIcons";
import type { CardRecord } from "../../../lib/types";
import { formatRupiah } from "../../../lib/format";
import {
  extractInstagramUsername,
  formatInstagramUrl,
  isInstagramUrl,
  parseGoogleMapsOrPlaceId,
} from "../../../lib/redirect";
import { PriceStepperInput } from "./PriceStepperInput";

interface CardFormProps {
  initialCard?: CardRecord | null;
  initialCode?: string;
  stockCodes?: string[];
  onSaved: (savedCode: string, isEdit: boolean) => Promise<void> | void;
  onStockChanged?: () => Promise<void> | void;
  onCancel?: () => void;
  onOpenScanner?: () => void;
  onCloseAfterSave?: () => void;
}

export default function CardForm({
  initialCard,
  initialCode = "",
  stockCodes = [],
  onSaved,
  onStockChanged,
  onCancel,
  onOpenScanner,
  onCloseAfterSave,
}: CardFormProps) {
  const isEditing = Boolean(initialCard);

  const [code, setCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [targetType, setTargetType] = useState<"google" | "instagram">("google");
  const [googleInput, setGoogleInput] = useState("");
  const [resolvedGoogleUrl, setResolvedGoogleUrl] = useState("");
  const [resolvedPlaceId, setResolvedPlaceId] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");
  const [price, setPrice] = useState<number>(50000);
  const [cost, setCost] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedCardUrl, setSavedCardUrl] = useState<string | null>(null);
  const [copiedNfc, setCopiedNfc] = useState(false);
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [deletingStockCode, setDeletingStockCode] = useState<string | null>(null);
  const [confirmClearStock, setConfirmClearStock] = useState(false);
  const [clearingStock, setClearingStock] = useState(false);

  async function handleRemoveStockCode(sc: string) {
    setDeletingStockCode(sc);
    try {
      const res = await fetch(`/api/admin/stock?code=${encodeURIComponent(sc)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (code === sc) setCode("");
        if (onStockChanged) await onStockChanged();
      }
    } finally {
      setDeletingStockCode(null);
    }
  }

  async function handleClearAllStock() {
    setClearingStock(true);
    try {
      const res = await fetch("/api/admin/stock?all=1", { method: "DELETE" });
      if (res.ok) {
        setConfirmClearStock(false);
        setShowStockPicker(false);
        if (onStockChanged) await onStockChanged();
      }
    } finally {
      setClearingStock(false);
    }
  }

  useEffect(() => {
    setError(null);
    setMessage(null);
    setSavedCardUrl(null);
    setCopiedNfc(false);

    if (initialCard) {
      setCode(initialCard.code);
      setStoreName(initialCard.storeName);
      setPrice(initialCard.price ?? 50000);
      setCost(initialCard.cost ?? 0);

      const rawUrl = initialCard.googleReviewUrl || "";
      if (isInstagramUrl(rawUrl)) {
        setTargetType("instagram");
        setInstagramUsername(extractInstagramUsername(rawUrl));
        setGoogleInput("");
        setResolvedGoogleUrl("");
        setResolvedPlaceId("");
      } else {
        setTargetType("google");
        setInstagramUsername("");
        const parsed = parseGoogleMapsOrPlaceId(rawUrl);
        if (parsed.kind === "placeid" && parsed.placeId) {
          setGoogleInput(parsed.placeId);
          setResolvedPlaceId(parsed.placeId);
          setResolvedGoogleUrl(parsed.reviewUrl);
        } else {
          setGoogleInput(rawUrl);
          setResolvedPlaceId("");
          setResolvedGoogleUrl(rawUrl);
        }
      }
    } else {
      setCode(initialCode);
      setStoreName("");
      setTargetType("google");
      setGoogleInput("");
      setResolvedGoogleUrl("");
      setResolvedPlaceId("");
      setInstagramUsername("");
      setPrice(50000);
      setCost(0);
    }
  }, [initialCard, initialCode]);

  function handleGoogleInputChange(val: string) {
    setGoogleInput(val);
    const parsed = parseGoogleMapsOrPlaceId(val);
    if (parsed.kind === "placeid") {
      setResolvedPlaceId(parsed.placeId || "");
      setResolvedGoogleUrl(parsed.reviewUrl);
      if (!storeName.trim() && parsed.suggestedStoreName) {
        setStoreName(parsed.suggestedStoreName);
      }
    } else if (parsed.kind === "url") {
      setResolvedPlaceId("");
      setResolvedGoogleUrl(parsed.reviewUrl);
      if (!storeName.trim() && parsed.suggestedStoreName) {
        setStoreName(parsed.suggestedStoreName);
      }
    } else {
      setResolvedPlaceId("");
      setResolvedGoogleUrl("");
    }
  }

  const currentTargetUrl =
    targetType === "instagram"
      ? formatInstagramUrl(instagramUsername)
      : resolvedGoogleUrl;

  const isTargetChanged = Boolean(
    isEditing &&
      initialCard &&
      currentTargetUrl &&
      initialCard.googleReviewUrl.trim() !== currentTargetUrl.trim()
  );

  const isStoreNameChanged = Boolean(
    isEditing &&
      initialCard &&
      initialCard.storeName.trim().toLowerCase() !== storeName.trim().toLowerCase()
  );

  const netProfit = price - cost;
  const oldTaps = initialCard?.tapCount ?? 0;

  const mapsSearchUrl = storeName.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeName.trim())}`
    : "https://www.google.com/maps";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    let finalUrl = "";
    if (targetType === "instagram") {
      finalUrl = formatInstagramUrl(instagramUsername);
      if (!finalUrl) {
        setError("Username atau tautan Instagram wajib diisi.");
        return;
      }
    } else {
      const parsed = parseGoogleMapsOrPlaceId(googleInput);
      if (parsed.kind === "empty") {
        setError("Google Place ID atau tautan Google Maps wajib diisi.");
        return;
      }
      if (parsed.kind === "invalid") {
        setError(parsed.error || "Format Place ID atau link Google Maps tidak valid.");
        return;
      }
      finalUrl = parsed.reviewUrl;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          storeName: storeName.trim(),
          googleReviewUrl: finalUrl,
          price,
          cost,
          resetTaps: isTargetChanged,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Gagal menyimpan data kartu.");
        return;
      }

      const cardUrl = `${window.location.origin}/c/${code.trim()}`;
      setSavedCardUrl(cardUrl);
      const resetNote = isTargetChanged ? " (Riwayat tap di-reset ke 0)" : "";
      setMessage(
        `"${storeName.trim()}" berhasil ${isEditing ? "diperbarui" : "dihubungkan"}${resetNote}.`
      );
      window.dispatchEvent(new Event("stock-updated"));
      await onSaved(code.trim(), isEditing);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-subtle" htmlFor="card-code">
            Kode Kartu (NFC / QR)
          </label>
          {!isEditing && (
            <div className="flex items-center gap-1.5">
              {stockCodes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowStockPicker((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-hairline bg-elevated px-2 py-1 text-[11px] font-medium text-subtle transition-colors hover:border-white/20 hover:text-ink"
                >
                  <Package className="h-3 w-3 text-amber-400" />
                  <span>Kode Cetak ({stockCodes.length})</span>
                </button>
              )}
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-300 transition-colors hover:bg-indigo-500/20"
                >
                  <Camera className="h-3 w-3" />
                  <span>Scan QR</span>
                </button>
              )}
            </div>
          )}
        </div>

        <input
          id="card-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="cth: a8f3k2"
          maxLength={20}
          required
          autoCapitalize="none"
          autoCorrect="off"
          readOnly={isEditing}
          className={`w-full rounded-lg border border-hairline bg-elevated/70 px-3.5 py-2.5 font-mono text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 ${
            isEditing ? "cursor-not-allowed opacity-60" : ""
          }`}
        />

        {!isEditing && showStockPicker && stockCodes.length > 0 && (
          <div className="mt-2 rounded-lg border border-hairline bg-canvas p-2.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-subtle">
              <span>Pilih kode cetak siap pakai:</span>
              <div className="flex items-center gap-2">
                {confirmClearStock ? (
                  <>
                    <button
                      type="button"
                      disabled={clearingStock}
                      onClick={handleClearAllStock}
                      className="rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"
                    >
                      {clearingStock ? "Menghapus..." : "Ya, Hapus Semua"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearStock(false)}
                      className="text-muted hover:text-ink"
                    >
                      Batal
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearStock(true)}
                    className="inline-flex items-center gap-1 text-rose-300/90 hover:text-rose-200"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Hapus Semua</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClearStock(false);
                    setShowStockPicker(false);
                  }}
                  className="text-muted hover:text-ink"
                >
                  Tutup
                </button>
              </div>
            </div>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {stockCodes.map((sc) => (
                <div
                  key={sc}
                  className={`inline-flex items-center overflow-hidden rounded-md border font-mono text-xs transition-colors ${
                    code === sc
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                      : "border-hairline bg-surface text-subtle"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCode(sc);
                      setShowStockPicker(false);
                    }}
                    className="px-2 py-1 hover:text-ink"
                  >
                    {sc}
                  </button>
                  <button
                    type="button"
                    disabled={deletingStockCode === sc}
                    onClick={() => handleRemoveStockCode(sc)}
                    title={`Hapus kode ${sc}`}
                    aria-label={`Hapus kode ${sc}`}
                    className="border-l border-hairline px-1.5 py-1 text-muted transition-colors hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-subtle"
          htmlFor="store-name"
        >
          Nama Toko / Resto
        </label>
        <input
          id="store-name"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="cth: Cafe Kopi Senja"
          maxLength={100}
          required
          className="w-full rounded-lg border border-hairline bg-elevated/70 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div>
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-subtle">
          Tipe Tujuan Kartu
        </span>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-hairline bg-canvas p-1">
          <button
            type="button"
            onClick={() => setTargetType("google")}
            className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${
              targetType === "google"
                ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/35"
                : "text-subtle hover:text-ink"
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            <span>Google Review</span>
          </button>

          <button
            type="button"
            onClick={() => setTargetType("instagram")}
            className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${
              targetType === "instagram"
                ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/35"
                : "text-subtle hover:text-ink"
            }`}
          >
            <InstagramIcon className="h-3.5 w-3.5" />
            <span>Instagram</span>
          </button>
        </div>
      </div>

      {targetType === "google" ? (
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label
              className="text-[11px] font-semibold uppercase tracking-wider text-subtle"
              htmlFor="google-target"
            >
              Place ID / Link Google Maps
            </label>
            <div className="flex items-center gap-3 text-[11px]">
              <a
                href={mapsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-subtle hover:text-ink"
              >
                <MapPin className="h-3 w-3" />
                <span>Cari di Maps</span>
              </a>
              <a
                href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-indigo-300 hover:text-indigo-200"
              >
                <span>Place ID Finder</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <input
            id="google-target"
            value={googleInput}
            onChange={(e) => handleGoogleInputChange(e.target.value)}
            placeholder="Tempel Place ID (ChIJ...) atau tautan Google Maps"
            maxLength={500}
            required={targetType === "google"}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-lg border border-hairline bg-elevated/70 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20"
          />

          {resolvedGoogleUrl && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>{resolvedPlaceId ? "Place ID terdeteksi" : "Link Google valid"}</span>
              </span>
              {resolvedPlaceId && (
                <span className="max-w-[150px] truncate rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] text-emerald-200">
                  {resolvedPlaceId}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label
              className="text-[11px] font-semibold uppercase tracking-wider text-subtle"
              htmlFor="ig-username"
            >
              Username / Link Instagram
            </label>
            {instagramUsername && (
              <a
                href={formatInstagramUrl(instagramUsername)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-300 hover:text-rose-200"
              >
                <span>Buka Profil</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <input
            id="ig-username"
            value={instagramUsername}
            onChange={(e) => setInstagramUsername(e.target.value.trim())}
            placeholder="cth: @kopisenja atau https://instagram.com/..."
            maxLength={150}
            required={targetType === "instagram"}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-lg border border-hairline bg-elevated/70 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20"
          />

          {instagramUsername && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-rose-200">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                <span>Target Instagram siap</span>
              </span>
              <span className="font-mono text-[11px] font-semibold text-rose-300">
                @{extractInstagramUsername(instagramUsername)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-subtle"
            htmlFor="price"
          >
            Harga Jual
          </label>
          <PriceStepperInput id="price" value={price} onChange={setPrice} step={5000} min={0} />
        </div>
        <div>
          <label
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-subtle"
            htmlFor="cost"
          >
            Modal Awal (HPP)
          </label>
          <PriceStepperInput
            id="cost"
            value={cost}
            onChange={setCost}
            placeholder="0"
            step={5000}
            min={0}
            required={false}
          />
        </div>
      </div>

      <div
        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
          netProfit >= 0
            ? "border-emerald-500/20 bg-emerald-500/[0.07]"
            : "border-rose-500/25 bg-rose-500/[0.08]"
        }`}
      >
        <span className="text-subtle">Untung bersih / kartu</span>
        <span
          className={`font-semibold tabular-nums ${
            netProfit >= 0 ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {formatRupiah(netProfit)}
        </span>
      </div>

      {isTargetChanged && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between gap-2 font-semibold text-amber-300">
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Lokasi Baru: Reset Tap</span>
            </span>
            <span className="tabular-nums text-[11px]">
              {oldTaps} tap menjadi 0 tap
            </span>
          </div>
          <p className="leading-relaxed text-amber-100/80">
            Tujuan kartu berubah. Riwayat {oldTaps} tap sebelumnya akan otomatis di-reset ke 0 saat disimpan.
          </p>
        </div>
      )}

      {!isTargetChanged && isStoreNameChanged && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          Nama toko diperbarui. Seluruh riwayat {oldTaps} tap tetap dipertahankan.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {savedCardUrl ? (
        <div className="space-y-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3.5">
          <div className="text-xs font-semibold text-emerald-300">URL untuk Chip NFC (NFC Tools)</div>
          <div className="select-all break-all rounded-lg border border-hairline bg-canvas px-3 py-2 font-mono text-xs text-ink">
            {savedCardUrl}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(savedCardUrl).then(() => {
                  setCopiedNfc(true);
                  setTimeout(() => setCopiedNfc(false), 2500);
                });
              }}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              {copiedNfc ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedNfc ? "Tersalin" : "Salin URL"}</span>
            </button>

            <a
              href={`${savedCardUrl}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-ink transition-colors hover:border-white/20"
              title="Tes redirect tanpa menambah statistik tap"
            >
              <ExternalLink className="h-3.5 w-3.5 text-indigo-300" />
              <span>Tes Redirect</span>
            </a>
          </div>
          {onCloseAfterSave && (
            <button
              type="button"
              onClick={onCloseAfterSave}
              className="w-full rounded-lg border border-hairline py-2 text-xs font-medium text-subtle transition-colors hover:text-ink"
            >
              Selesai
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2 pt-1">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] flex-1 rounded-lg border border-hairline bg-elevated px-4 text-xs font-medium text-subtle transition-colors hover:text-ink"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{loading ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan & Hubungkan"}</span>
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      )}
    </form>
  );
}

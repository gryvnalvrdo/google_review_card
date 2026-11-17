"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Pencil,
  RotateCcw,
  Search,
  Star,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { InstagramIcon } from "../../components/BrandIcons";
import type { CardRecord } from "../../../../lib/types";
import { formatDateShortIndo, formatRupiah } from "../../../../lib/format";
import { getPublicGoogleReviewUrl, isInstagramUrl } from "../../../../lib/redirect";
import CardForm from "../../components/CardForm";
import ConfirmModal from "../../components/ConfirmModal";
import { PriceStepperInput } from "../../components/PriceStepperInput";

const QR_EXPORT_SIZE = 1000;

type SortOption = "date" | "tap" | "name" | "price" | "profit" | "missing_cost";
type PlatformFilter = "all" | "google" | "instagram" | "missing_cost";

export default function CardsPage() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CardRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [resetTarget, setResetTarget] = useState<CardRecord | null>(null);
  const [resetting, setResetting] = useState(false);

  const [editingCard, setEditingCard] = useState<CardRecord | null>(null);
  const [quickCostCard, setQuickCostCard] = useState<CardRecord | null>(null);
  const [quickCostValue, setQuickCostValue] = useState<number>(25000);
  const [savingQuickCost, setSavingQuickCost] = useState(false);

  const [downloadingQrCode, setDownloadingQrCode] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    const sortParam = params.get("sort");
    if (
      sortParam === "missing_cost" ||
      sortParam === "tap" ||
      sortParam === "name" ||
      sortParam === "price" ||
      sortParam === "profit"
    ) {
      setSortBy(sortParam);
    }
  }, []);

  useEffect(() => {
    const locked = Boolean(editingCard || quickCostCard);
    document.documentElement.style.overflow = locked ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [editingCard, quickCostCard]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchCards = useCallback(async () => {
    try {
      const rand = Math.random().toString(36).slice(2, 8);
      const res = await fetch(`/api/admin/codes?_t=${Date.now()}&_r=${rand}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/codes/${deleteTarget.code}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (res.ok) {
        setCards((prev) => prev.filter((c) => c.code !== deleteTarget.code));
        showToast(`Kartu "${deleteTarget.storeName}" dihapus`);
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleResetTaps() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/codes/${resetTarget.code}`, {
        method: "POST",
        cache: "no-store",
      });
      if (res.ok) {
        setCards((prev) =>
          prev.map((c) => (c.code === resetTarget.code ? { ...c, tapCount: 0 } : c))
        );
        showToast(`Tap kartu "${resetTarget.storeName}" di-reset ke 0`);
        setResetTarget(null);
      }
    } finally {
      setResetting(false);
    }
  }

  async function handleQuickCostSave(e: React.FormEvent) {
    e.preventDefault();
    if (!quickCostCard) return;
    setSavingQuickCost(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: quickCostCard.code,
          storeName: quickCostCard.storeName,
          googleReviewUrl: quickCostCard.googleReviewUrl,
          price: quickCostCard.price ?? 50000,
          cost: quickCostValue,
          resetTaps: false,
        }),
      });
      if (res.ok) {
        setCards((prev) =>
          prev.map((c) => (c.code === quickCostCard.code ? { ...c, cost: quickCostValue } : c))
        );
        showToast(`Modal awal "${quickCostCard.storeName}" disimpan`);
        setQuickCostCard(null);
      }
    } finally {
      setSavingQuickCost(false);
    }
  }

  async function downloadQrOnly(card: CardRecord) {
    if (!baseUrl) return;
    setDownloadingQrCode(card.code);
    try {
      const qr = QRCode.create(`${baseUrl}/c/${card.code}`, { errorCorrectionLevel: "H" });
      const count = qr.modules.size;
      const cellSize = Math.max(1, Math.floor(QR_EXPORT_SIZE / count));
      const qrDrawSize = cellSize * count;
      const margin = 40;
      const offset = margin + Math.floor((QR_EXPORT_SIZE - qrDrawSize) / 2);

      const out = document.createElement("canvas");
      out.width = QR_EXPORT_SIZE + margin * 2;
      out.height = QR_EXPORT_SIZE + margin * 2;
      const ctx = out.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.fillStyle = "#000000";
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.modules.get(r, c)) {
            ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
          }
        }
      }

      out.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `QR_${card.storeName.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_")}_${card.code}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setDownloadingQrCode(null);
      }, "image/png");
    } catch {
      setDownloadingQrCode(null);
    }
  }

  function copyWithFeedback(text: string, id: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      showToast(label);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return cards
      .filter((c) => {
        const matchesQuery =
          !q || c.storeName.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
        if (!matchesQuery) return false;
        if (platformFilter === "instagram") return isInstagramUrl(c.googleReviewUrl);
        if (platformFilter === "google") return !isInstagramUrl(c.googleReviewUrl);
        if (platformFilter === "missing_cost") return !c.cost || c.cost <= 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "missing_cost") {
          const missingA = !a.cost || a.cost <= 0 ? 1 : 0;
          const missingB = !b.cost || b.cost <= 0 ? 1 : 0;
          if (missingA !== missingB) return missingB - missingA;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "tap") return (b.tapCount || 0) - (a.tapCount || 0);
        if (sortBy === "name") return a.storeName.localeCompare(b.storeName);
        if (sortBy === "profit") {
          const hasCostA = typeof a.cost === "number" && a.cost > 0;
          const hasCostB = typeof b.cost === "number" && b.cost > 0;
          if (hasCostA !== hasCostB) return hasCostA ? -1 : 1;
          return (b.price ?? 50000) - (b.cost ?? 0) - ((a.price ?? 50000) - (a.cost ?? 0));
        }
        if (sortBy === "price") return (b.price ?? 50000) - (a.price ?? 50000);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [cards, searchTerm, sortBy, platformFilter]);

  const googleCount = useMemo(
    () => cards.filter((c) => !isInstagramUrl(c.googleReviewUrl)).length,
    [cards]
  );
  const instagramCount = useMemo(
    () => cards.filter((c) => isInstagramUrl(c.googleReviewUrl)).length,
    [cards]
  );

  const cardsWithCost = useMemo(
    () => cards.filter((c) => typeof c.cost === "number" && c.cost > 0),
    [cards]
  );
  const totalRevenue = useMemo(() => cards.reduce((s, c) => s + (c.price ?? 50000), 0), [cards]);
  const totalCost = useMemo(
    () => cardsWithCost.reduce((s, c) => s + (c.cost ?? 0), 0),
    [cardsWithCost]
  );
  const totalProfit = useMemo(
    () => cardsWithCost.reduce((s, c) => s + ((c.price ?? 50000) - (c.cost ?? 0)), 0),
    [cardsWithCost]
  );
  const missingCostCount = cards.length - cardsWithCost.length;

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-hairline bg-elevated px-4 py-2 text-xs font-medium text-ink shadow-xl md:bottom-6">
          {toast}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Hapus Kartu Toko?"
        subtitle={deleteTarget?.storeName}
        description="Kartu akan dinonaktifkan permanen dan seluruh riwayat tap untuk kode ini akan dihapus."
        confirmLabel="Hapus Permanen"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-xs">
            <div>
              <div className="font-semibold text-ink">{deleteTarget.storeName}</div>
              <div className="mt-0.5 font-mono text-[11px] text-indigo-300">
                #{deleteTarget.code}
              </div>
            </div>
            <span className="rounded-md border border-hairline bg-elevated px-2 py-1 font-semibold tabular-nums text-amber-300">
              {deleteTarget.tapCount ?? 0} tap
            </span>
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(resetTarget)}
        title="Reset Tap ke 0?"
        subtitle={resetTarget ? `${resetTarget.storeName} (${resetTarget.code})` : undefined}
        description={`Hitungan ${resetTarget?.tapCount ?? 0} tap dan riwayat kunjungan kartu ini akan dikembalikan ke 0.`}
        confirmLabel="Ya, Reset"
        variant="warning"
        loading={resetting}
        onConfirm={handleResetTaps}
        onClose={() => setResetTarget(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
          Daftar Kartu Toko
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-hairline bg-surface p-3.5">
          <div className="flex items-center justify-between text-[11px] text-subtle">
            <span>Kartu Aktif</span>
            <CreditCard className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div className="mt-1.5 text-xl font-semibold tabular-nums text-ink">{cards.length}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-surface p-3.5">
          <div className="flex items-center justify-between text-[11px] text-emerald-300/90">
            <span>Keuntungan Bersih</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="mt-1.5 text-lg font-semibold tabular-nums text-emerald-300 sm:text-xl">
            {formatRupiah(totalProfit)}
          </div>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-3.5">
          <div className="text-[11px] text-subtle">Total Omzet</div>
          <div className="mt-1.5 text-lg font-semibold tabular-nums text-ink sm:text-xl">
            {formatRupiah(totalRevenue)}
          </div>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-3.5">
          <div className="text-[11px] text-subtle">Total Modal (HPP)</div>
          <div className="mt-1.5 text-lg font-semibold tabular-nums text-ink sm:text-xl">
            {formatRupiah(totalCost)}
          </div>
        </div>
      </div>

      {missingCostCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong className="tabular-nums text-amber-300">{missingCostCount} kartu</strong> belum
              memiliki modal awal (HPP) sehingga belum masuk kalkulasi keuntungan.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSortBy((p) => (p === "missing_cost" ? "date" : "missing_cost"))}
            className={`rounded-lg border px-3 py-1.5 font-semibold transition-colors ${
              sortBy === "missing_cost"
                ? "border-amber-400 bg-amber-500/25 text-amber-100"
                : "border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
            }`}
          >
            {sortBy === "missing_cost" ? "Tampilkan Terbaru" : "Urutkan Belum Ada Modal"}
          </button>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari toko atau kode..."
              className="h-[42px] w-full rounded-xl border border-hairline bg-surface pl-9 pr-8 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500/70"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-[42px] w-[140px] shrink-0 rounded-xl border border-hairline bg-surface px-3 text-xs font-medium text-ink outline-none focus:border-indigo-500/70 sm:w-[190px]"
          >
            <option value="date">Terbaru</option>
            {missingCostCount > 0 && (
              <option value="missing_cost">Belum Modal ({missingCostCount})</option>
            )}
            <option value="profit">Profit Tertinggi</option>
            <option value="price">Harga Tertinggi</option>
            <option value="tap">Tap Terbanyak</option>
            <option value="name">Abjad A s/d Z</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(
            [
              { id: "all", label: "Semua", count: cards.length },
              { id: "google", label: "Google", count: googleCount },
              { id: "instagram", label: "Instagram", count: instagramCount },
              ...(missingCostCount > 0
                ? [{ id: "missing_cost" as const, label: "Perlu HPP", count: missingCostCount }]
                : []),
            ] as const
          ).map((chip) => {
            const active = platformFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setPlatformFilter(chip.id)}
                className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                  active
                    ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                    : "border-hairline bg-surface text-subtle hover:border-white/20 hover:text-ink"
                }`}
              >
                {chip.id === "google" && <Star className="h-3 w-3 text-amber-400" />}
                {chip.id === "instagram" && <InstagramIcon className="h-3 w-3 text-rose-400" />}
                <span>{chip.label}</span>
                <span className="tabular-nums opacity-75">{chip.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-hairline bg-surface" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface px-6 py-12 text-center">
          <CreditCard className="mx-auto mb-3 h-8 w-8 text-muted" />
          <h3 className="text-sm font-semibold text-ink">Tidak Ada Kartu</h3>
          <p className="mt-1 text-xs text-subtle">
            {searchTerm
              ? `Tidak ditemukan kartu dengan kata kunci "${searchTerm}".`
              : "Belum ada kartu toko yang terhubung."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-hairline bg-surface lg:block">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-hairline bg-canvas/50 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                      <th className="px-4 py-3">Toko &amp; Kode</th>
                      <th className="px-4 py-3">Tujuan</th>
                      <th className="px-4 py-3 text-right">Tap</th>
                      <th className="px-4 py-3 text-right">Harga / HPP / Profit</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {filtered.map((card) => {
                      const hasCost = typeof card.cost === "number" && card.cost > 0;
                      const cardPrice = card.price ?? 50000;
                      const cardCost = card.cost ?? 0;
                      const cardProfit = cardPrice - cardCost;
                      const isIg = isInstagramUrl(card.googleReviewUrl);
                      const targetUrl = getPublicGoogleReviewUrl(
                        card.googleReviewUrl,
                        card.storeName
                      );
                      const fullCardUrl = `${baseUrl}/c/${card.code}`;

                      return (
                        <tr
                          key={card.code}
                          className={`transition-colors hover:bg-white/[0.02] ${
                            !hasCost ? "bg-amber-500/[0.03]" : ""
                          }`}
                        >
                          <td className="px-4 py-3.5 align-middle">
                            <div className="font-semibold text-ink">{card.storeName}</div>
                            <div className="mt-1 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  copyWithFeedback(card.code, `code:${card.code}`, "Kode disalin")
                                }
                                className="inline-flex items-center gap-1 rounded border border-hairline bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-indigo-300 hover:border-white/20"
                              >
                                <span>{card.code}</span>
                                {copiedId === `code:${card.code}` ? (
                                  <Check className="h-2.5 w-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-2.5 w-2.5 text-muted" />
                                )}
                              </button>
                              <span className="text-[11px] text-muted">
                                {formatDateShortIndo(card.createdAt)}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 align-middle">
                            <div className="flex items-center gap-2">
                              <a
                                href={targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                                  isIg
                                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                }`}
                              >
                                {isIg ? (
                                  <InstagramIcon className="h-3 w-3" />
                                ) : (
                                  <Star className="h-3 w-3" />
                                )}
                                <span>{isIg ? "Instagram" : "Google"}</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                              <a
                                href={`/c/${card.code}?preview=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() =>
                                  showToast(
                                    `Tes redirect ${card.storeName} (tidak dihitung ke statistik)`
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-hairline bg-elevated px-2 py-1 text-[11px] font-medium text-subtle hover:text-ink"
                                title="Tes redirect kartu tanpa mengotori statistik tap"
                              >
                                <span>Tes</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right align-middle">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/admin/taps?search=${encodeURIComponent(card.storeName)}&period=all`}
                                className="inline-flex items-center gap-1 rounded-md border border-hairline bg-elevated px-2 py-1 font-semibold tabular-nums text-ink hover:border-white/20"
                              >
                                <span>{card.tapCount ?? 0}</span>
                                <BarChart3 className="h-3 w-3 text-subtle" />
                              </Link>
                              {(card.tapCount ?? 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setResetTarget(card)}
                                  className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                                  title="Reset tap ke 0"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Reset</span>
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right align-middle tabular-nums">
                            <div className="font-medium text-ink">{formatRupiah(cardPrice)}</div>
                            <div className="mt-0.5 flex items-center justify-end gap-2 text-[11px]">
                              {hasCost ? (
                                <>
                                  <span className="text-muted">HPP {formatRupiah(cardCost)}</span>
                                  <span
                                    className={`font-semibold ${
                                      cardProfit >= 0 ? "text-emerald-300" : "text-rose-300"
                                    }`}
                                  >
                                    +{formatRupiah(cardProfit)}
                                  </span>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickCostCard(card);
                                    setQuickCostValue(25000);
                                  }}
                                  className="rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-300 hover:bg-amber-500/25"
                                >
                                  Isi Modal
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right align-middle">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  copyWithFeedback(
                                    fullCardUrl,
                                    `url:${card.code}`,
                                    "Link NFC disalin"
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[11px] font-medium text-ink hover:border-white/20"
                                title="Salin Link NFC"
                              >
                                {copiedId === `url:${card.code}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 text-indigo-300" />
                                )}
                                <span>NFC</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => downloadQrOnly(card)}
                                disabled={downloadingQrCode === card.code || !baseUrl}
                                className="rounded-lg border border-hairline bg-elevated p-1.5 text-subtle hover:text-ink disabled:opacity-40"
                                title="Unduh QR PNG 1000px"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditingCard(card)}
                                className="rounded-lg border border-hairline bg-elevated p-1.5 text-subtle hover:text-ink"
                                title="Edit Kartu"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeleteTarget(card)}
                                className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                                title="Hapus Kartu"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          <div className="space-y-3 lg:hidden">
            {filtered.map((card) => {
              const fullCardUrl = `${baseUrl}/c/${card.code}`;
              const hasCost = typeof card.cost === "number" && card.cost > 0;
              const isIg = isInstagramUrl(card.googleReviewUrl);
              const targetUrl = getPublicGoogleReviewUrl(card.googleReviewUrl, card.storeName);
              const cardPrice = card.price ?? 50000;
              const cardCost = card.cost ?? 0;
              const cardProfit = cardPrice - cardCost;
              const isExpanded = expandedCode === card.code;

              return (
                <div
                  key={card.code}
                  className={`overflow-hidden rounded-2xl border bg-surface transition-colors ${
                    !hasCost ? "border-amber-500/35" : "border-hairline"
                  }`}
                >
                  <div className="p-4">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedCode((prev) => (prev === card.code ? null : card.code))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedCode((prev) => (prev === card.code ? null : card.code));
                        }
                      }}
                      className="flex cursor-pointer items-start justify-between gap-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                            isIg
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {isIg ? (
                            <InstagramIcon className="h-5 w-5" />
                          ) : (
                            <Star className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[15px] font-semibold leading-snug text-ink">
                            {card.storeName}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyWithFeedback(card.code, `code:${card.code}`, "Kode disalin");
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-elevated px-2 py-0.5 font-mono text-xs font-medium text-indigo-300"
                            >
                              <span>{card.code}</span>
                              {copiedId === `code:${card.code}` ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3 text-muted" />
                              )}
                            </button>
                            {!hasCost && (
                              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                                Perlu HPP
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1 tabular-nums">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            (card.tapCount ?? 0) > 0
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-elevated text-subtle"
                          }`}
                        >
                          {card.tapCount ?? 0} tap
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            hasCost
                              ? cardProfit >= 0
                                ? "text-emerald-300"
                                : "text-rose-300"
                              : "text-subtle"
                          }`}
                        >
                          {hasCost ? `+${formatRupiah(cardProfit)}` : formatRupiah(cardPrice)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setResetTarget(card)}
                        disabled={(card.tapCount ?? 0) === 0}
                        title={(card.tapCount ?? 0) === 0 ? "Tap kartu masih 0" : "Reset jumlah tap ke 0"}
                        className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-hairline bg-elevated px-3 text-xs font-medium text-ink transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-hairline"
                      >
                        <RotateCcw className="h-4 w-4 shrink-0 text-indigo-400" />
                        <span>Reset Tap</span>
                      </button>

                      <a
                        href={`/c/${card.code}?preview=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          showToast(`Tes redirect ${card.storeName} (tidak dihitung ke statistik)`)
                        }
                        className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-hairline bg-elevated px-3.5 text-xs font-medium text-ink"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-indigo-300" />
                        <span>Tes</span>
                      </a>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCode((prev) => (prev === card.code ? null : card.code))
                        }
                        aria-expanded={isExpanded}
                        className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-hairline bg-elevated px-3 text-xs font-medium text-subtle hover:text-ink"
                      >
                        <span>Kelola</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-150 ${
                            isExpanded ? "rotate-180 text-indigo-300" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-hairline bg-canvas/45 px-4 py-3.5">
                      <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                        <div>
                          <div className="text-[11px] text-muted">Harga Jual</div>
                          <div className="mt-0.5 text-xs font-semibold text-ink">
                            {formatRupiah(cardPrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted">Modal HPP</div>
                          {hasCost ? (
                            <div className="mt-0.5 text-xs font-semibold text-subtle">
                              {formatRupiah(cardCost)}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setQuickCostCard(card);
                                setQuickCostValue(25000);
                              }}
                              className="mt-0.5 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
                            >
                              Isi Modal
                            </button>
                          )}
                        </div>
                        <div>
                          <div className="text-[11px] text-muted">Dibuat</div>
                          <div className="mt-0.5 text-xs font-medium text-subtle">
                            {formatDateShortIndo(card.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => downloadQrOnly(card)}
                          disabled={downloadingQrCode === card.code || !baseUrl}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-hairline bg-elevated px-3 text-xs font-medium text-ink disabled:opacity-40"
                        >
                          <Download className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Unduh QR</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingCard(card)}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-hairline bg-elevated px-3 text-xs font-medium text-ink"
                        >
                          <Pencil className="h-3.5 w-3.5 text-indigo-300" />
                          <span>Edit Kartu</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            copyWithFeedback(fullCardUrl, `url:${card.code}`, "Link NFC disalin")
                          }
                          className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                            copiedId === `url:${card.code}`
                              ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                              : "border-hairline bg-elevated text-ink hover:border-white/20"
                          }`}
                        >
                          {copiedId === `url:${card.code}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-indigo-300" />
                          )}
                          <span>{copiedId === `url:${card.code}` ? "Tersalin" : "Salin Link NFC"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(card)}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-medium text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t border-hairline pt-2.5 text-xs">
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center gap-1 font-medium ${
                            isIg ? "text-rose-300" : "text-amber-300"
                          }`}
                        >
                          {isIg ? <InstagramIcon className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
                          <span>{isIg ? "Profil Instagram" : "Halaman Google Review"}</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>

                        <Link
                          href={`/admin/taps?search=${encodeURIComponent(card.storeName)}&period=all`}
                          className="inline-flex items-center gap-1 font-medium text-subtle hover:text-ink"
                        >
                          <span>Riwayat Tap</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </>
      )}

      {quickCostCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setQuickCostCard(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">Isi Modal Awal (HPP)</h3>
                <p className="text-xs text-subtle">{quickCostCard.storeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickCostCard(null)}
                className="rounded-lg p-1.5 text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleQuickCostSave} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-subtle">
                  Modal Pembuatan Kartu
                </label>
                <PriceStepperInput
                  value={quickCostValue}
                  onChange={setQuickCostValue}
                  step={5000}
                  min={0}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-hairline bg-canvas px-3 py-2 text-xs tabular-nums">
                <span className="text-subtle">Estimasi untung bersih</span>
                <span className="font-semibold text-emerald-300">
                  {formatRupiah((quickCostCard.price ?? 50000) - quickCostValue)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuickCostCard(null)}
                  className="min-h-[40px] flex-1 rounded-lg border border-hairline bg-elevated text-xs font-medium text-subtle hover:text-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingQuickCost}
                  className="min-h-[40px] flex-1 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {savingQuickCost ? "Menyimpan..." : "Simpan Modal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setEditingCard(null)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Edit Kartu Toko</h2>
                <p className="font-mono text-xs text-subtle">{editingCard.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="rounded-lg border border-hairline bg-elevated p-1.5 text-subtle hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <CardForm
                initialCard={editingCard}
                onSaved={async () => {
                  await fetchCards();
                  setEditingCard(null);
                  showToast("Perubahan kartu disimpan");
                }}
                onCancel={() => setEditingCard(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

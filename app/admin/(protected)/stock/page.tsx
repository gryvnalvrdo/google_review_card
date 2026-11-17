"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  Copy,
  Download,
  Package,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { CardRecord } from "../../../../lib/types";
import ConfirmModal from "../../components/ConfirmModal";
import QRScanner from "../../components/QRScanner";

function generateRandomCode(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    out += chars[arr[i] % chars.length];
  }
  return out;
}

export default function StockPage() {
  const router = useRouter();
  const [stockCodes, setStockCodes] = useState<string[]>([]);
  const [activeCards, setActiveCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [generateCount, setGenerateCount] = useState(20);
  const [manualInput, setManualInput] = useState("");
  const [savingStock, setSavingStock] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const [showScanner, setShowScanner] = useState(false);
  const [scanCheckResult, setScanCheckResult] = useState<{
    code: string;
    status: "stock" | "active" | "unregistered";
    storeName?: string;
  } | null>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const fetchStock = useCallback(async () => {
    try {
      const ts = Date.now();
      const [resStock, resCards] = await Promise.all([
        fetch(`/api/admin/stock?_t=${ts}`, { cache: "no-store" }),
        fetch(`/api/admin/codes?_t=${ts}`, { cache: "no-store" }),
      ]);
      if (resStock.ok) {
        const d = await resStock.json();
        setStockCodes(d.codes ?? []);
      }
      if (resCards.ok) {
        const d = await resCards.json();
        setActiveCards(d.cards ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const activeMap = useMemo(
    () => new Map(activeCards.map((c) => [c.code.toLowerCase(), c])),
    [activeCards]
  );

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? stockCodes.filter((c) => c.toLowerCase().includes(q)) : stockCodes;
    return [...list].sort((a, b) => a.localeCompare(b));
  }, [stockCodes, search]);

  async function handleGenerateStock(count: number) {
    setSavingStock(true);
    setFeedback(null);
    const existing = new Set([
      ...stockCodes.map((c) => c.toLowerCase()),
      ...activeCards.map((c) => c.code.toLowerCase()),
    ]);
    const batch: string[] = [];
    let guard = 0;
    while (batch.length < count && guard < count * 10) {
      guard++;
      const c = generateRandomCode();
      if (!existing.has(c.toLowerCase())) {
        existing.add(c.toLowerCase());
        batch.push(c);
      }
    }

    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: batch }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback(`${data.saved ?? batch.length} kode baru ditambahkan ke stok.`);
        setShowAddPanel(false);
        await fetchStock();
        window.dispatchEvent(new Event("stock-updated"));
      }
    } finally {
      setSavingStock(false);
    }
  }

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    const parsed = manualInput
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 20);
    if (parsed.length === 0) return;

    setSavingStock(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: parsed.slice(0, 200) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback(`${data.saved ?? parsed.length} kode ditambahkan ke stok.`);
        setManualInput("");
        setShowAddPanel(false);
        await fetchStock();
        window.dispatchEvent(new Event("stock-updated"));
      }
    } finally {
      setSavingStock(false);
    }
  }

  async function handleRemoveCode(code: string) {
    setDeletingCode(code);
    try {
      const res = await fetch(`/api/admin/stock/${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setStockCodes((prev) => prev.filter((c) => c !== code));
        window.dispatchEvent(new Event("stock-updated"));
      }
    } finally {
      setDeletingCode(null);
    }
  }

  async function handleClearStock() {
    setClearing(true);
    try {
      const res = await fetch("/api/admin/stock/clear", { method: "DELETE" });
      if (res.ok) {
        setStockCodes([]);
        setConfirmClear(false);
        window.dispatchEvent(new Event("stock-updated"));
      }
    } finally {
      setClearing(false);
    }
  }

  async function downloadQrPng(code: string) {
    if (!baseUrl) return;
    const size = 1000;
    const qr = QRCode.create(`${baseUrl}/c/${code}`, { errorCorrectionLevel: "H" });
    const count = qr.modules.size;
    const cellSize = Math.max(1, Math.floor(size / count));
    const drawSize = cellSize * count;
    const margin = 40;
    const offset = margin + Math.floor((size - drawSize) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = size + margin * 2;
    canvas.height = size + margin * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
        }
      }
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QR_Stok_${code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function handleScanCheck(scannedCode: string) {
    setShowScanner(false);
    const lower = scannedCode.trim().toLowerCase();
    const active = activeMap.get(lower);
    if (active) {
      setScanCheckResult({ code: scannedCode, status: "active", storeName: active.storeName });
      return;
    }
    const inStock = stockCodes.some((c) => c.toLowerCase() === lower);
    if (inStock) {
      setScanCheckResult({ code: scannedCode, status: "stock" });
      return;
    }
    setScanCheckResult({ code: scannedCode, status: "unregistered" });
  }

  const isLowStock = stockCodes.length <= 10;

  return (
    <div className="space-y-5">
      {showScanner && (
        <QRScanner onScan={handleScanCheck} onClose={() => setShowScanner(false)} />
      )}

      <ConfirmModal
        open={confirmClear}
        title="Bersihkan Semua Stok?"
        subtitle={`${stockCodes.length} kode stok akan dihapus`}
        description="Daftar stok akan dikosongkan. Kartu toko yang sudah aktif tidak akan terpengaruh."
        confirmLabel="Kosongkan Stok"
        loading={clearing}
        onConfirm={handleClearStock}
        onClose={() => setConfirmClear(false)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
          Stok Kartu Fisik
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-xs font-medium text-ink transition-colors hover:border-white/20"
          >
            <Camera className="h-3.5 w-3.5 text-indigo-400" />
            <span>Cek QR</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddPanel((v) => !v)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Stok</span>
          </button>
          <Link
            href="/admin/print"
            className="hidden min-h-[40px] items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-xs font-medium text-subtle transition-colors hover:text-ink md:inline-flex"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Cetak QR</span>
          </Link>
        </div>
      </div>

      {scanCheckResult && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-semibold text-ink">
              Hasil Scan:{" "}
              <span className="font-mono text-indigo-300">{scanCheckResult.code}</span>
            </div>
            <div className="text-subtle">
              {scanCheckResult.status === "active"
                ? `Sudah terhubung ke toko "${scanCheckResult.storeName}".`
                : scanCheckResult.status === "stock"
                ? "Tersedia di stok siap pakai."
                : "Belum ada di stok maupun kartu aktif."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {scanCheckResult.status !== "active" && (
              <Link
                href={`/admin?code=${encodeURIComponent(scanCheckResult.code)}`}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500"
              >
                <span>Assign ke Toko</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setScanCheckResult(null)}
              className="rounded-lg p-1.5 text-subtle hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showAddPanel && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-hairline bg-surface p-5 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">Generate Kode Acak ke Stok</h2>
            <div className="flex flex-wrap items-center gap-2">
              {[10, 20, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGenerateCount(n)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                    generateCount === n
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                      : "border-hairline bg-elevated text-subtle hover:text-ink"
                  }`}
                >
                  {n} kode
                </button>
              ))}
              <button
                type="button"
                disabled={savingStock}
                onClick={() => handleGenerateStock(generateCount)}
                className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                <span>{savingStock ? "Menyimpan..." : `Buat ${generateCount} Kode`}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleAddManual} className="space-y-3 border-t border-hairline pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <h2 className="text-sm font-semibold text-ink">Input Kode Manual</h2>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              rows={2}
              placeholder="Masukkan kode dipisah koma atau baris baru (cth: a8f3k2, b9x4m1)"
              className="w-full rounded-lg border border-hairline bg-elevated/70 px-3 py-2 font-mono text-xs text-ink outline-none placeholder:text-muted focus:border-indigo-500/70"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingStock || !manualInput.trim()}
                className="inline-flex min-h-[36px] items-center rounded-lg border border-hairline bg-elevated px-4 text-xs font-semibold text-ink transition-colors hover:border-white/20 disabled:opacity-40"
              >
                Simpan Kode Manual
              </button>
            </div>
          </form>
        </div>
      )}

      {feedback && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          className={`rounded-xl border p-4 ${
            isLowStock ? "border-amber-500/35 bg-amber-500/[0.06]" : "border-hairline bg-surface"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>Total Stok Tersedia</span>
            <Package className={`h-4 w-4 ${isLowStock ? "text-amber-400" : "text-indigo-400"}`} />
          </div>
          <div
            className={`mt-1.5 text-2xl font-semibold tabular-nums ${
              isLowStock ? "text-amber-300" : "text-ink"
            }`}
          >
            {stockCodes.length}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
            {isLowStock && <AlertTriangle className="h-3 w-3 text-amber-400" />}
            <span>{isLowStock ? "Stok rendah, pertimbangkan cetak ulang" : "Siap di-assign"}</span>
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-4">
          <div className="text-xs text-subtle">Kartu Sudah Terpasang</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
            {activeCards.length}
          </div>
          <div className="mt-1 text-[11px] text-muted">Sudah terhubung ke toko</div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-hairline bg-surface p-4">
          <div className="text-xs text-subtle">Aksi Batch</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={filteredCodes.length === 0 || !baseUrl}
              onClick={() => {
                const text = filteredCodes.map((c) => `${baseUrl}/c/${c}`).join("\n");
                navigator.clipboard.writeText(text).then(() => {
                  setCopiedAll(true);
                  setTimeout(() => setCopiedAll(false), 2000);
                });
              }}
              className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-ink transition-colors hover:border-white/20 disabled:opacity-40"
            >
              {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedAll ? "Tersalin" : "Salin Link"}</span>
            </button>
            <button
              type="button"
              disabled={stockCodes.length === 0}
              onClick={() => setConfirmClear(true)}
              className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Kosongkan</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode kartu di stok..."
          className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-10 pr-10 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-indigo-500/70"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-hairline bg-surface" />
          ))}
        </div>
      ) : filteredCodes.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface px-6 py-12 text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-muted" />
          <h3 className="text-sm font-semibold text-ink">
            {search ? "Kode stok tidak ditemukan" : "Stok kartu masih kosong"}
          </h3>
          <p className="mt-1 text-xs text-subtle">
            {search
              ? `Tidak ada kode stok yang cocok dengan "${search}".`
              : "Cetak kartu di Studio Cetak QR atau klik Tambah Stok untuk mengisi stok kode."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredCodes.map((code) => {
            const fullUrl = `${baseUrl}/c/${code}`;
            const isCopied = copiedCode === code;
            return (
              <div
                key={code}
                className="flex flex-col justify-between gap-3 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-white/15"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-base font-semibold tracking-tight text-ink">
                      {code}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-muted">
                      /c/{code}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCode(code)}
                    disabled={deletingCode === code}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                    title="Hapus dari stok"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => router.push(`/admin?code=${encodeURIComponent(code)}`)}
                    className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
                  >
                    <span>Assign</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!baseUrl) return;
                      navigator.clipboard.writeText(fullUrl).then(() => {
                        setCopiedCode(code);
                        setTimeout(() => setCopiedCode(null), 1800);
                      });
                    }}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-hairline bg-elevated px-2.5 text-subtle transition-colors hover:text-ink"
                    title="Salin URL NFC"
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadQrPng(code)}
                    disabled={!baseUrl}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-hairline bg-elevated px-2.5 text-subtle transition-colors hover:text-ink disabled:opacity-40"
                    title="Unduh QR PNG 1000px"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

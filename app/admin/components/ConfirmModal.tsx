"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function ConfirmModal({
  open,
  title,
  subtitle,
  description,
  confirmLabel,
  cancelLabel = "Batal",
  variant = "danger",
  loading = false,
  onConfirm,
  onClose,
  children,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                isDanger
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              }`}
            >
              {isDanger ? (
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              ) : (
                <RotateCcw className="h-4 w-4" strokeWidth={2} />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">{title}</h3>
              {subtitle && <p className="mt-0.5 text-xs text-subtle">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-ink disabled:opacity-40"
            aria-label="Tutup dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {children}
          <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>{description}</span>
          </p>
        </div>

        <div className="flex gap-2.5 border-t border-hairline bg-canvas/40 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-[40px] flex-1 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-subtle transition-colors hover:text-ink disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-500"
                : "bg-amber-600 hover:bg-amber-500"
            }`}
          >
            {loading ? "Memproses..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

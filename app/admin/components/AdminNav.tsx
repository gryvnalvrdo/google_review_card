"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  Printer,
  QrCode,
} from "lucide-react";

interface AdminNavProps {
  active?: "dashboard" | "cards" | "stock" | "taps" | "print";
}

export default function AdminNav({ active }: AdminNavProps) {
  const pathname = usePathname();
  const [stockCount, setStockCount] = useState<number | null>(null);

  const currentTab =
    active ||
    (pathname === "/admin"
      ? "dashboard"
      : pathname.startsWith("/admin/cards")
      ? "cards"
      : pathname.startsWith("/admin/stock")
      ? "stock"
      : pathname.startsWith("/admin/taps")
      ? "taps"
      : pathname.startsWith("/admin/print")
      ? "print"
      : "dashboard");

  useEffect(() => {
    let mounted = true;
    async function fetchStockCount() {
      try {
        const res = await fetch(`/api/admin/stock?_t=${Date.now()}`, { cache: "no-store" });
        if (res.ok && mounted) {
          const data = await res.json();
          setStockCount(typeof data.count === "number" ? data.count : 0);
        }
      } catch {}
    }

    fetchStockCount();
    const onStockUpdated = () => fetchStockCount();
    window.addEventListener("stock-updated", onStockUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("stock-updated", onStockUpdated);
    };
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const isLowStock = stockCount !== null && stockCount <= 10;

  const navItems = [
    { id: "dashboard", label: "Dashboard", shortLabel: "Dashboard", href: "/admin", Icon: LayoutDashboard },
    { id: "cards", label: "Kartu Toko", shortLabel: "Kartu", href: "/admin/cards", Icon: CreditCard },
    { id: "stock", label: "Stok Kartu", shortLabel: "Stok", href: "/admin/stock", Icon: Package },
    { id: "taps", label: "Riwayat Tap", shortLabel: "Analitik", href: "/admin/taps", Icon: BarChart3 },
    { id: "print", label: "Cetak QR", shortLabel: "Cetak", href: "/admin/print", Icon: Printer, desktopOnly: true },
  ] as const;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2.5 text-ink">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-elevated text-indigo-400">
              <QrCode className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight text-ink">Review Card</span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Hantic Studio
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-xl border border-hairline bg-surface p-1 md:flex">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              const Icon = item.Icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-elevated text-ink shadow-sm ring-1 ring-white/10"
                      : "text-subtle hover:bg-white/[0.04] hover:text-ink"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-indigo-400" : "text-muted"}`} strokeWidth={2} />
                  <span>{item.label}</span>
                  {item.id === "stock" && stockCount !== null && (
                    <span
                      className={`tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                        isLowStock
                          ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                          : "bg-white/[0.06] text-subtle"
                      }`}
                    >
                      {stockCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-subtle transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
              title="Keluar dari Admin Panel"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden"
        aria-label="Navigasi Utama"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1 px-2 py-1.5">
          {navItems
            .filter((item) => !("desktopOnly" in item && item.desktopOnly))
            .map((item) => {
              const isActive = currentTab === item.id;
              const Icon = item.Icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`relative flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-500/15 text-indigo-300"
                      : "text-subtle active:bg-white/[0.05]"
                  }`}
                >
                  <div className="relative">
                    <Icon className="h-4 w-4" strokeWidth={isActive ? 2.2 : 1.75} />
                    {item.id === "stock" && isLowStock && (
                      <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-surface" />
                    )}
                  </div>
                  <span className="leading-none">{item.shortLabel}</span>
                </Link>
              );
            })}
        </div>
      </nav>
    </>
  );
}

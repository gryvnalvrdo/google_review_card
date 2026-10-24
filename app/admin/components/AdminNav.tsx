"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminNavProps {
  active?: "dashboard" | "cards" | "taps" | "print";
}

export default function AdminNav({ active }: AdminNavProps) {
  const pathname = usePathname();

  const currentTab = active || (
    pathname === "/admin" ? "dashboard" :
    pathname.startsWith("/admin/cards") ? "cards" :
    pathname.startsWith("/admin/taps") ? "taps" :
    pathname.startsWith("/admin/print") ? "print" : "dashboard"
  );

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", href: "/admin", icon: "📊" },
    { id: "cards", label: "Kartu Toko", href: "/admin/cards", icon: "💳" },
    { id: "taps", label: "Riwayat Tap", href: "/admin/taps", icon: "📈" },
    { id: "print", label: "Mesin Cetak QR", href: "/admin/print", icon: "🖨️" },
  ];

  return (
    <>
      <header className="admin-nav-header">
        <div className="admin-nav-container">
          {/* Brand */}
          <Link href="/admin" className="admin-nav-brand">
            <div className="brand-icon-box">⭐</div>
            <div className="brand-text-box">
              <span className="brand-title">Review Card</span>
              <span className="brand-badge">Hantic Pro</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="admin-desktop-tabs">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`admin-nav-tab ${isActive ? "active" : ""}`}
                >
                  <span className="nav-tab-icon">{item.icon}</span>
                  <span className="nav-tab-label">{item.label}</span>
                  {isActive && <span className="nav-active-glow" />}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="admin-nav-actions">
            <div className="live-status-pill">
              <span className="live-dot" />
              <span className="live-text">Online</span>
            </div>

            <button
              onClick={handleLogout}
              className="logout-btn"
              title="Keluar dari Admin Panel"
            >
              <span>Keluar</span>
              <span className="logout-icon">🚪</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Floating Bottom Bar */}
      <nav className="admin-mobile-dock" aria-label="Navigasi Bawah">
        <div className="dock-container">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`dock-item ${isActive ? "dock-active" : ""}`}
              >
                <span className="dock-icon">{item.icon}</span>
                <span className="dock-label">{item.label.split(" ")[0]}</span>
                {isActive && <span className="dock-dot" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

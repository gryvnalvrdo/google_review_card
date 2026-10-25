import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Google Review Card — Hantic",
  description: "Sistem redirect kartu NFC/QR ke halaman Google Review toko. Tap kartu → langsung ke halaman review Google.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

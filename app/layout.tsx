export const metadata = {
  title: "Google Review Card",
  description: "Sistem redirect kartu NFC/QR ke halaman Google Review toko",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f7f7f8",
          color: "#1a1a1a",
        }}
      >
        {children}
      </body>
    </html>
  );
}

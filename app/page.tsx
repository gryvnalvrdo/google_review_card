export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: 24, textAlign: "center" }}>
      <h1 style={{ fontSize: "1.3rem" }}>Google Review Card</h1>
      <p style={{ color: "#666" }}>
        Sistem redirect untuk kartu NFC/QR tap-to-review. Lihat{" "}
        <a href="/admin">halaman admin</a> untuk mengelola kartu.
      </p>
    </main>
  );
}

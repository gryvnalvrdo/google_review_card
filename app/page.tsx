export default function Home() {
  return (
    <>
      <div className="gradient-bg">
        <div className="gradient-blob blob-1" />
        <div className="gradient-blob blob-2" />
      </div>

      <main style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          {/* Icon */}
          <div style={{
            width: 72,
            height: 72,
            background: "linear-gradient(135deg, #4F46E5, #8B5CF6)",
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 28px",
            fontSize: "2rem",
            boxShadow: "0 0 40px rgba(79,70,229,0.4)",
          }}>
            ⭐
          </div>

          <h1 style={{
            fontSize: "2rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, #F0F0FF, #A5B4FC)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 16,
            lineHeight: 1.2,
          }}>
            Google Review Card
          </h1>

          <p style={{
            color: "var(--text-secondary)",
            fontSize: "1rem",
            lineHeight: 1.7,
            marginBottom: 36,
          }}>
            Sistem redirect kartu NFC &amp; QR Code untuk{" "}
            <em style={{ color: "var(--text-primary)" }}>Tap to Review</em>.
            Customer cukup tap kartu — langsung diarahkan ke halaman Google Review toko.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/admin" className="btn btn-primary" style={{ fontSize: "0.9rem", padding: "12px 28px" }}>
              🔑 Masuk ke Admin
            </a>
          </div>

          <div style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}>
            {[
              { icon: "📶", label: "NFC & QR", desc: "Satu kartu, dua cara tap" },
              { icon: "🔗", label: "Link Fleksibel", desc: "Ubah tujuan kapan saja" },
              { icon: "⚡", label: "Redirect Cepat", desc: "302 redirect instan" },
            ].map((item) => (
              <div key={item.label} className="card" style={{ padding: "16px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";

type CardRecord = {
  code: string;
  storeName: string;
  googleReviewUrl: string;
  createdAt: string;
  updatedAt?: string;
};

export default function AdminDashboard() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [code, setCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function loadCards() {
    const res = await fetch("/api/admin/codes");
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards ?? []);
    }
  }

  useEffect(() => { loadCards(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), storeName: storeName.trim(), googleReviewUrl: googleReviewUrl.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setMessage(`Kode "${code.trim()}" berhasil disimpan untuk toko "${storeName.trim()}".`);
      setCode("");
      setStoreName("");
      setGoogleReviewUrl("");
      loadCards();
    } else {
      setError(data?.error ?? "Gagal menyimpan. Cek kembali datanya.");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  const filtered = cards.filter(c =>
    c.storeName.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <div className="gradient-bg">
        <div className="gradient-blob blob-1" />
        <div className="gradient-blob blob-2" />
      </div>

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
        {/* Header */}
        <header style={{
          borderBottom: "1px solid var(--border)",
          background: "rgba(10,10,15,0.8)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36,
                background: "linear-gradient(135deg, #4F46E5, #8B5CF6)",
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1rem",
              }}>⭐</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                  Review Card Admin
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Hantic</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="badge badge-green">● Online</span>
              <button onClick={handleLogout} className="btn btn-ghost" style={{ padding: "7px 14px" }}>
                Logout
              </button>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 32 }}>
            {[
              { label: "Total Kartu Aktif", value: cards.length, icon: "💳", color: "#4F46E5" },
              { label: "Siap Redirect", value: cards.length, icon: "⚡", color: "#10B981" },
            ].map((s) => (
              <div key={s.label} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 44, height: 44,
                  background: `${s.color}22`,
                  border: `1px solid ${s.color}44`,
                  borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.2rem", flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20, alignItems: "start" }}>

            {/* === FORM ASSIGN === */}
            <div className="card">
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                Assign Kartu ke Toko
              </h2>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 20 }}>
                Isi kode kartu, nama toko, dan link Google Review-nya.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="label" htmlFor="card-code">Kode Kartu (NFC/QR)</label>
                  <input
                    id="card-code"
                    className="input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="cth: a8f3k2"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label" htmlFor="store-name">Nama Toko</label>
                  <input
                    id="store-name"
                    className="input"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="cth: Kedai Kopi Sudirman"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label" htmlFor="review-url">Link Google Review</label>
                  <input
                    id="review-url"
                    className="input"
                    type="url"
                    value={googleReviewUrl}
                    onChange={(e) => setGoogleReviewUrl(e.target.value)}
                    placeholder="https://search.google.com/local/writereview?placeid=..."
                    required
                  />
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Harus berawalan search.google.com atau www.google.com
                  </p>
                </div>

                {error && <div className="alert alert-error">⚠️ {error}</div>}
                {message && <div className="alert alert-success">✅ {message}</div>}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
                >
                  {loading ? <><div className="spinner" /> Menyimpan...</> : "Simpan Kartu →"}
                </button>
              </form>
            </div>

            {/* === DAFTAR KARTU === */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Kartu Aktif
                    <span className="badge badge-purple" style={{ marginLeft: 10 }}>{cards.length}</span>
                  </h2>
                </div>
                <input
                  className="input"
                  placeholder="🔍 Cari toko atau kode kartu..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ marginBottom: 14 }}
                />

                {filtered.length === 0 && (
                  <div style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--text-muted)",
                    fontSize: "0.875rem",
                  }}>
                    {cards.length === 0
                      ? "💳 Belum ada kartu yang di-assign.\nGunakan form di samping untuk menambahkan."
                      : "Tidak ada hasil pencarian."}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
                  {filtered.map((c) => {
                    const cardUrl = `${baseUrl}/c/${c.code}`;
                    return (
                      <div key={c.code} style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "14px 16px",
                        transition: "border-color 0.2s, background 0.2s",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                      >
                        {/* Store name + badge */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                            {c.storeName}
                          </div>
                          <span className="badge badge-green" style={{ fontSize: "0.65rem" }}>Aktif</span>
                        </div>

                        {/* Code + copy */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <span style={{
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            background: "rgba(99,102,241,0.15)",
                            color: "#A5B4FC",
                            padding: "2px 8px",
                            borderRadius: 4,
                          }}>
                            {c.code}
                          </span>
                          <button
                            className="copy-btn"
                            title="Salin URL kartu"
                            onClick={() => copyToClipboard(cardUrl, c.code + "-url")}
                          >
                            {copiedCode === c.code + "-url" ? "✅ Disalin!" : "📋 Salin URL"}
                          </button>
                        </div>

                        {/* Google Review URL */}
                        <a
                          href={c.googleReviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: "0.73rem",
                            color: "var(--text-muted)",
                            wordBreak: "break-all",
                            textDecoration: "none",
                            display: "block",
                            lineHeight: 1.4,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#A5B4FC")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                        >
                          🔗 {c.googleReviewUrl.length > 55 ? c.googleReviewUrl.slice(0, 55) + "..." : c.googleReviewUrl}
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

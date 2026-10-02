"use client";

import { useEffect, useState } from "react";

type CardRecord = {
  code: string;
  storeName: string;
  googleReviewUrl: string;
  createdAt: string;
  updatedAt: string;
};

export default function AdminDashboard() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [code, setCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCards() {
    const res = await fetch("/api/admin/codes");
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards ?? []);
    }
  }

  useEffect(() => {
    loadCards();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, storeName, googleReviewUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(`Kode "${code}" berhasil disimpan untuk toko "${storeName}".`);
      setCode("");
      setStoreName("");
      setGoogleReviewUrl("");
      loadCards();
    } else {
      setError(data?.error ?? "Gagal menyimpan.");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.3rem" }}>Admin — Kartu Review</h1>
        <button onClick={handleLogout} style={{ cursor: "pointer" }}>
          Logout
        </button>
      </div>

      <section
        style={{
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 10,
          padding: 20,
          marginTop: 20,
        }}
      >
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Assign / Update Kode Kartu</h2>
        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>
            Kode kartu (sesuai yang tertulis di NFC/QR)
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="contoh: a8f3k2"
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            Nama toko
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="contoh: Kedai Kopi Sudirman"
              style={inputStyle}
              required
            />
          </label>
          <label style={labelStyle}>
            Link Google Review toko
            <input
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              style={inputStyle}
              required
            />
          </label>
          {error && <p style={{ color: "crimson", fontSize: "0.9rem" }}>{error}</p>}
          {message && <p style={{ color: "green", fontSize: "0.9rem" }}>{message}</p>}
          <button type="submit" style={buttonStyle}>
            Simpan
          </button>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: "1rem" }}>Kartu yang sudah aktif ({cards.length})</h2>
        {cards.length === 0 && <p style={{ color: "#777" }}>Belum ada kartu yang di-assign.</p>}
        <div style={{ display: "grid", gap: 10 }}>
          {cards.map((c) => (
            <div
              key={c.code}
              style={{
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 600 }}>{c.storeName}</div>
              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                Kode: <code>{c.code}</code>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#999", wordBreak: "break-all" }}>
                {c.googleReviewUrl}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  color: "#444",
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 9,
  marginTop: 4,
  boxSizing: "border-box",
  border: "1px solid #ccc",
  borderRadius: 6,
};

const buttonStyle: React.CSSProperties = {
  padding: "9px 16px",
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

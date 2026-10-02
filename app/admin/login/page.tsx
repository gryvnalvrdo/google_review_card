"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Password salah. Coba lagi.");
    }
  }

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
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 56,
              height: 56,
              background: "linear-gradient(135deg, #4F46E5, #8B5CF6)",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "1.5rem",
              boxShadow: "0 0 30px rgba(79,70,229,0.4)",
            }}>
              ⭐
            </div>
            <h1 style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 6,
            }}>
              Admin Panel
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              Google Review Card — Hantic
            </p>
          </div>

          {/* Form Card */}
          <div className="card" style={{ padding: 28 }}>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor="password">Password Admin</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  placeholder="Masukkan password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="alert alert-error">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}
              >
                {loading ? (
                  <>
                    <div className="spinner" />
                    Memeriksa...
                  </>
                ) : (
                  "Masuk →"
                )}
              </button>
            </form>
          </div>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            <a href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              ← Kembali ke beranda
            </a>
          </p>
        </div>
      </main>
    </>
  );
}

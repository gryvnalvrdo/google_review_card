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
      setError(data?.error ?? "Gagal login.");
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "100px auto", padding: 24 }}>
      <h1 style={{ fontSize: "1.2rem" }}>Login Admin</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Password admin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            marginTop: 12,
            marginBottom: 12,
            boxSizing: "border-box",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />
        {error && <p style={{ color: "crimson", fontSize: "0.9rem" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 10,
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {loading ? "Memeriksa..." : "Login"}
        </button>
      </form>
    </main>
  );
}

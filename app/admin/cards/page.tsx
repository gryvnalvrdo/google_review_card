"use client";

import { useEffect, useState } from "react";

interface CardData {
  code: string;
  storeName: string;
  placeId: string;
  tapCount: number;
  createdAt: string;
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCard, setEditingCard] = useState<CardData | null>(null);

  async function fetchCards() {
    try {
      const res = await fetch("/api/admin/cards");
      if (res.ok) {
        const data = await res.json();
        setCards(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCards();
  }, []);

  async function handleDelete(code: string) {
    if (!confirm("Yakin ingin menghapus kartu ini?")) return;
    const res = await fetch(`/api/admin/codes/${code}`, { method: "DELETE" });
    if (res.ok) {
      setCards(cards.filter(c => c.code !== code));
    } else {
      alert("Gagal menghapus kartu.");
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCard) return;

    try {
      const res = await fetch("/api/admin/cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editingCard.code,
          storeName: editingCard.storeName,
          placeId: editingCard.placeId,
        }),
      });
      if (res.ok) {
        setEditingCard(null);
        fetchCards();
      } else {
        alert("Gagal menyimpan perubahan.");
      }
    } catch (e) {
      console.error(e);
      alert("Terjadi kesalahan sistem.");
    }
  }

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  const filteredCards = cards.filter(c => 
    c.storeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "white", margin: 0 }}>📋 Daftar Semua Kartu</h1>
          <p style={{ color: "#A5B4FC", margin: "5px 0 0 0" }}>Kelola semua klien dan kartu aktifmu di sini.</p>
        </div>
        <a 
          href="/admin" 
          style={{ 
            background: "#2A2A35", color: "white", padding: "10px 16px", 
            borderRadius: "8px", textDecoration: "none", fontSize: "0.9rem" 
          }}
        >
          ← Kembali ke Dashboard
        </a>
      </div>

      <div style={{ background: "#16161F", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
        <input 
          type="text" 
          placeholder="🔍 Cari nama toko atau kode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            width: "100%", padding: 16, borderRadius: 8, border: "none", 
            background: "#0F0F16", color: "white", fontSize: "1rem", marginBottom: 20 
          }}
        />

        {loading ? (
          <p style={{ color: "white" }}>Memuat data...</p>
        ) : filteredCards.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", padding: 40 }}>Belum ada kartu atau tidak ditemukan.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredCards.map((card) => {
              const url = `https://search.google.com/local/writereview?placeid=${card.placeId}`;
              return (
                <div key={card.code} style={{ 
                  background: "#1E1E28", padding: 16, borderRadius: 12, 
                  border: "1px solid rgba(255,255,255,0.05)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: "0 0 10px 0", color: "white", fontSize: "1.1rem" }}>{card.storeName}</h3>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ 
                          background: "#2A2A35", color: "#A5B4FC", padding: "4px 8px", 
                          borderRadius: 6, fontSize: "0.8rem", fontFamily: "monospace" 
                        }}>
                          {card.code}
                        </span>
                        <span style={{ 
                          background: "rgba(16, 185, 129, 0.2)", color: "#10B981", 
                          padding: "4px 8px", borderRadius: 6, fontSize: "0.8rem", fontWeight: "bold" 
                        }}>
                          Aktif
                        </span>
                        <span style={{ 
                          background: "rgba(245, 158, 11, 0.2)", color: "#F59E0B", 
                          padding: "4px 8px", borderRadius: 6, fontSize: "0.8rem", fontWeight: "bold" 
                        }}>
                          👆 {card.tapCount}x
                        </span>
                      </div>
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                        <a href={url} target="_blank" rel="noreferrer" style={{ 
                          color: "#A5B4FC", fontSize: "0.85rem", textDecoration: "none", 
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px", display: "inline-block"
                        }}>
                          🔗 {url}
                        </a>
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", gap: 8 }}>
                      <button 
                        onClick={() => setEditingCard(card)}
                        style={{ 
                          background: "rgba(255,255,255,0.1)", color: "white", border: "none", 
                          padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" 
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(card.code)}
                        style={{ 
                          background: "rgba(239, 68, 68, 0.2)", color: "#EF4444", border: "none", 
                          padding: "8px 12px", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" 
                        }}
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 16, fontSize: "0.75rem", color: "#666" }}>
                    Dibuat: {formatDate(card.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL EDIT */}
      {editingCard && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{ background: "#16161F", padding: 24, borderRadius: 16, width: "100%", maxWidth: 400, border: "1px solid rgba(255,255,255,0.1)" }}>
            <h2 style={{ color: "white", marginTop: 0 }}>Edit Kartu</h2>
            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", color: "#A5B4FC", fontSize: "0.85rem", marginBottom: 5 }}>Kode Kartu</label>
                <input 
                  type="text" 
                  value={editingCard.code} 
                  disabled
                  style={{ width: "100%", padding: 12, borderRadius: 8, background: "#0F0F16", border: "1px solid #333", color: "#888", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: "block", color: "#A5B4FC", fontSize: "0.85rem", marginBottom: 5 }}>Nama Toko</label>
                <input 
                  type="text" 
                  value={editingCard.storeName} 
                  onChange={e => setEditingCard({...editingCard, storeName: e.target.value})}
                  required
                  style={{ width: "100%", padding: 12, borderRadius: 8, background: "#1E1E28", border: "1px solid #4F46E5", color: "white", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", color: "#A5B4FC", fontSize: "0.85rem", marginBottom: 5 }}>Google Place ID</label>
                <input 
                  type="text" 
                  value={editingCard.placeId} 
                  onChange={e => setEditingCard({...editingCard, placeId: e.target.value})}
                  required
                  style={{ width: "100%", padding: 12, borderRadius: 8, background: "#1E1E28", border: "1px solid #4F46E5", color: "white", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setEditingCard(null)} style={{ flex: 1, padding: 12, background: "transparent", color: "white", border: "1px solid #444", borderRadius: 8, cursor: "pointer" }}>Batal</button>
                <button type="submit" style={{ flex: 1, padding: 12, background: "#4F46E5", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" }}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

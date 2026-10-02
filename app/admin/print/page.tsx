"use client";

import { useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

function generateRandomCode(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

export default function PrintQRCodes() {
  const [count, setCount] = useState(10);
  const [codes, setCodes] = useState<string[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  function handleGenerate() {
    const newCodes = [];
    for (let i = 0; i < count; i++) {
      newCodes.push(generateRandomCode());
    }
    setCodes(newCodes);
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownloadZip() {
    setIsZipping(true);
    const zip = new JSZip();
    
    // Cari semua canvas QR code yang ada di layar
    const canvases = document.querySelectorAll("canvas");
    
    canvases.forEach((canvas) => {
      // Ambil kode dari ID (misal: "qr-a8f3k2" -> "a8f3k2")
      const code = canvas.id.replace("qr-", "");
      // Ambil data gambar (base64)
      const dataUrl = canvas.toDataURL("image/png");
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      // Masukkan ke dalam file zip
      zip.file(`QRCode_${code}.png`, base64Data, { base64: true });
    });

    // Generate dan download file zip
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "QR_Codes_NFC_Cards.zip");
    setIsZipping(false);
  }

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Bagian Kontrol (Tidak akan ikut terprint) */}
      <div className="no-print" style={{ 
        background: "#16161F", padding: "24px", borderRadius: "16px", marginBottom: "30px",
        border: "1px solid rgba(255,255,255,0.1)", color: "white" 
      }}>
        <h1 style={{ marginTop: 0 }}>🖨️ Mesin Cetak QR Code Massal</h1>
        <p style={{ color: "#A5B4FC" }}>Generate puluhan QR Code untuk diprint atau didownload sebagai gambar PNG.</p>
        
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", alignItems: "center", flexWrap: "wrap" }}>
          <label>Jumlah yang mau dicetak/didownload:</label>
          <input 
            type="number" 
            value={count} 
            onChange={(e) => setCount(Number(e.target.value))}
            min={1} 
            max={100}
            style={{ 
              padding: "10px", borderRadius: "8px", border: "none", 
              background: "#2A2A35", color: "white", width: "100px" 
            }} 
          />
          <button 
            onClick={handleGenerate}
            style={{ 
              padding: "10px 20px", borderRadius: "8px", border: "none", 
              background: "#4F46E5", color: "white", cursor: "pointer", fontWeight: "bold"
            }}
          >
            Generate QR
          </button>
          
          {codes.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
              <button 
                onClick={handleDownloadZip}
                disabled={isZipping}
                style={{ 
                  padding: "10px 20px", borderRadius: "8px", border: "none", 
                  background: "#F59E0B", color: "white", cursor: "pointer", fontWeight: "bold"
                }}
              >
                {isZipping ? "⏳ Memproses ZIP..." : "📁 Download sbg PNG (ZIP)"}
              </button>
              
              <button 
                onClick={handlePrint}
                style={{ 
                  padding: "10px 20px", borderRadius: "8px", border: "none", 
                  background: "#10B981", color: "white", cursor: "pointer", fontWeight: "bold"
                }}
              >
                🖨️ Print Langsung (CTRL+P)
              </button>
            </div>
          )}
        </div>
        
        <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "15px" }}>
          <a href="/admin" style={{ color: "#A5B4FC" }}>← Kembali ke Dashboard</a>
        </p>
      </div>

      {/* Area Print (Hanya ini yang akan tercetak di kertas) */}
      {codes.length > 0 && (
        <div className="print-area" style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", 
          gap: "20px",
          background: "white",
          padding: "20px",
          borderRadius: "8px"
        }}>
          {codes.map(c => {
            const url = `${baseUrl}/c/${c}`;
            return (
              <div key={c} style={{ 
                display: "flex", flexDirection: "column", alignItems: "center", 
                border: "1px dashed #ccc", padding: "10px", borderRadius: "8px"
              }}>
                <QRCodeCanvas id={`qr-${c}`} value={url} size={200} level="H" />
                <div style={{ marginTop: "8px", fontFamily: "monospace", fontSize: "0.9rem", color: "black", fontWeight: "bold" }}>
                  {c}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Style khusus untuk saat menekan tombol Print di browser */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { border: none !important; padding: 0 !important; }
        }
      `}} />
    </div>
  );
}

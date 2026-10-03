"use client";

import { useEffect, useRef, useState } from "react";

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let stopped = false;

    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (stopped || !result) return;
            const text = result.getText();
            // If the QR contains a full URL like https://domain/c/abc123, extract code segment
            const match = text.match(/\/c\/([a-z0-9]+)$/i);
            const code = match ? match[1] : text;
            setScanning(false);
            stopped = true;
            controls.stop();
            onScan(code);
          }
        );
        controlsRef.current = controls;
      } catch (e: unknown) {
        if (stopped) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Permission") || msg.includes("NotAllowed")) {
          setError("Izin kamera ditolak. Aktifkan akses kamera di pengaturan browser.");
        } else if (msg.includes("NotFound") || msg.includes("Devices")) {
          setError("Kamera tidak ditemukan di perangkat ini.");
        } else {
          setError("Gagal membuka kamera. Pastikan tidak ada aplikasi lain yang menggunakan kamera.");
        }
      }
    }

    startScanner();
    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
  }, [onScan]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.92)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 380,
        background: "#111118",
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#F0F0FF" }}>
              Scan QR Kartu
            </div>
            <div style={{ fontSize: "0.72rem", color: "#9A9AB0", marginTop: 2 }}>
              Arahkan kamera ke QR code pada kartu
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "#C0C0D8",
              width: 32, height: 32, cursor: "pointer",
              fontSize: "0.85rem", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontFamily: "inherit",
            }}
          >
            Tutup
          </button>
        </div>

        {/* Camera viewport */}
        <div style={{ position: "relative", background: "#000", aspectRatio: "1" }}>
          {error ? (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: 24, textAlign: "center", gap: 12,
            }}>
              <div style={{ fontSize: "2.5rem" }}>📵</div>
              <div style={{ color: "#FCA5A5", fontSize: "0.85rem", lineHeight: 1.5 }}>{error}</div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                muted
                playsInline
              />
              {/* Overlay & scan frame */}
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <div style={{
                  width: 200, height: 200,
                  border: "2px solid rgba(99,102,241,0.8)",
                  borderRadius: 16,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  position: "relative",
                }}>
                  {/* Corner accents */}
                  {[
                    { top: -2, left: -2, borderTop: "3px solid #6366F1", borderLeft: "3px solid #6366F1", borderTopLeftRadius: 14 },
                    { top: -2, right: -2, borderTop: "3px solid #6366F1", borderRight: "3px solid #6366F1", borderTopRightRadius: 14 },
                    { bottom: -2, left: -2, borderBottom: "3px solid #6366F1", borderLeft: "3px solid #6366F1", borderBottomLeftRadius: 14 },
                    { bottom: -2, right: -2, borderBottom: "3px solid #6366F1", borderRight: "3px solid #6366F1", borderBottomRightRadius: 14 },
                  ].map((s, i) => (
                    <div key={i} style={{ position: "absolute", width: 26, height: 26, ...s }} />
                  ))}
                  {/* Animated scan line */}
                  {scanning && (
                    <div style={{
                      position: "absolute", left: 6, right: 6, height: 2,
                      background: "linear-gradient(90deg, transparent, #6366F1, transparent)",
                      borderRadius: 999,
                      animation: "qrscanline 1.8s ease-in-out infinite",
                    }} />
                  )}
                </div>
              </div>
              <style>{`
                @keyframes qrscanline {
                  0%   { top: 10px;  opacity: 0; }
                  10%  { opacity: 1; }
                  90%  { opacity: 1; }
                  100% { top: 182px; opacity: 0; }
                }
              `}</style>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", textAlign: "center" }}>
          {!error ? (
            <p style={{ color: "#5A5A72", fontSize: "0.75rem" }}>
              Kode unik akan otomatis terisi setelah scan berhasil
            </p>
          ) : (
            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "10px 16px", background: "#4F46E5",
                border: "none", borderRadius: 8, color: "white",
                fontWeight: 600, cursor: "pointer", fontSize: "0.875rem",
                fontFamily: "inherit",
              }}
            >
              Tutup &amp; Isi Manual
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

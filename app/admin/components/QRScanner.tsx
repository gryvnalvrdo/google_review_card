"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

function extractCode(text: string): string {
  const trimmed = text.trim();
  // Check /c/<code > pattern
  const cMatch = trimmed.match(/\/c\/([a-zA-Z0-9_-]+)/i);
  if (cMatch) return cMatch[1];

  // Check code= parameter
  const codeParam = trimmed.match(/[?&]code=([a-zA-Z0-9_-]+)/i);
  if (codeParam) return codeParam[1];

  // If it's a URL ending with a slug
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  } catch {}

  return trimmed;
}

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Audio context might fail if user hasn't interacted
  }
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [scannedSuccess, setScannedSuccess] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isStoppedRef = useRef(false);

  // Stop all camera streams
  const stopStream = useCallback(() => {
    isStoppedRef.current = true;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    activeTrackRef.current = null;
  }, []);

  const handleFoundCode = useCallback((rawText: string) => {
    if (isStoppedRef.current) return;
    isStoppedRef.current = true;
    const code = extractCode(rawText);

    playBeep();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(60); } catch {}
    }

    setScannedSuccess(true);
    stopStream();

    setTimeout(() => {
      onScan(code);
    }, 400);
  }, [onScan, stopStream]);

  // Decode a canvas using ZXing or BarcodeDetector
  const decodeCanvas = useCallback(async (canvas: HTMLCanvasElement): Promise<string | null> => {
    // 1. Try Native BarcodeDetector
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: HTMLCanvasElement | HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({ formats: ["qr_code"] });
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue;
        }
      } catch {
        // Fallback to ZXing
      }
    }

    // 2. Fallback to @zxing/library
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeFromCanvas(canvas);
      if (result) return result.getText();
    } catch {
      // Not found in this frame
    }

    return null;
  }, []);

  // Continuous scanning loop from video
  const startScanningLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let isProcessing = false;

    const scanFrame = async () => {
      if (isStoppedRef.current) return;

      if (video.readyState >= video.HAVE_CURRENT_DATA && !isProcessing) {
        isProcessing = true;

        try {
          // Keep canvas dimensions matched to video for sharp pixel data
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 480;

          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }

          ctx.drawImage(video, 0, 0, w, h);

          // Fast native detection directly from video element if supported
          if (typeof window !== "undefined" && "BarcodeDetector" in window) {
            try {
              const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({ formats: ["qr_code"] });
              const barcodes = await detector.detect(video);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                handleFoundCode(barcodes[0].rawValue);
                return;
              }
            } catch {}
          }

          // Fallback detection from canvas
          const decoded = await decodeCanvas(canvas);
          if (decoded) {
            handleFoundCode(decoded);
            return;
          }
        } catch {
          // ignore frame decode error
        } finally {
          isProcessing = false;
        }
      }

      if (!isStoppedRef.current) {
        // Run scan every ~80ms (approx 12 fps) to keep CPU low while remaining responsive
        setTimeout(() => {
          if (!isStoppedRef.current) {
            animFrameRef.current = requestAnimationFrame(scanFrame);
          }
        }, 80);
      }
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [decodeCanvas, handleFoundCode]);

  // Start Camera Stream with HD constraints & Continuous Autofocus
  const startCamera = useCallback(async (deviceId?: string) => {
    stopStream();
    isStoppedRef.current = false;
    setLoading(true);
    setError(null);
    setScannedSuccess(false);

    try {
      // 1. High Resolution & Autofocus Constraints
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? {
              deviceId: { exact: deviceId },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
            }
          : {
              facingMode: { ideal: "environment" }, // Prefer back / macro camera
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        activeTrackRef.current = track;

        // Try applying continuous autofocus if available in device capabilities
        try {
          const caps = (track as unknown as { getCapabilities?: () => Record<string, unknown> }).getCapabilities?.() || {};
          if ("torch" in caps) {
            setHasTorch(true);
          }
          if ("focusMode" in caps && Array.isArray((caps as { focusMode: unknown[] }).focusMode)) {
            const fm = (caps as { focusMode: string[] }).focusMode;
            if (fm.includes("continuous")) {
              await (track as unknown as { applyConstraints: (c: Record<string, unknown>) => Promise<void> }).applyConstraints({
                advanced: [{ focusMode: "continuous" }],
              });
            }
          }
        } catch {
          // Non-critical capability check
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }

      // Enumerate available cameras
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);
        if (!selectedDeviceId && track) {
          const currentId = track.getSettings().deviceId;
          if (currentId) setSelectedDeviceId(currentId);
        }
      } catch {}

      setLoading(false);
      startScanningLoop();
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setError("Izin akses kamera ditolak. Berikan izin kamera di browser untuk memindai QR code.");
      } else if (msg.includes("NotFound") || msg.includes("Devices")) {
        setError("Tidak ditemukan kamera pada perangkat ini.");
      } else {
        setError("Gagal membuka kamera beresolusi tinggi. Anda juga dapat memilih foto QR dari galeri.");
      }
    }
  }, [selectedDeviceId, startScanningLoop, stopStream]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!activeTrackRef.current) return;
    try {
      const nextState = !torchOn;
      await (activeTrackRef.current as unknown as { applyConstraints: (c: Record<string, unknown>) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      // Torch failed
    }
  };

  // Handle Image File Upload (From Gallery or Native Camera Photo)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const decoded = await decodeCanvas(canvas);
          if (decoded) {
            handleFoundCode(decoded);
            return;
          }
        }
        alert("QR Code tidak terdeteksi pada gambar tersebut. Pastikan foto QR jelas dan cukup cahaya.");
      } catch {
        alert("Gagal membaca gambar QR.");
      } finally {
        URL.revokeObjectURL(objectUrl);
        setLoading(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setLoading(false);
      alert("Format gambar tidak valid.");
    };

    img.src = objectUrl;
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(0,0,0,0.94)",
      backdropFilter: "blur(12px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      {/* Hidden processing canvas & file input */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      <div style={{
        width: "100%", maxWidth: 420,
        background: "#12121C",
        borderRadius: 22,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Modal Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#F0F0FF", display: "flex", alignItems: "center", gap: 8 }}>
              <span>📷</span> Scan QR Kartu Fisik
            </div>
            <div style={{ fontSize: "0.72rem", color: "#9A9AB0", marginTop: 2 }}>
              Kamera HD otomatis fokus &amp; mendeteksi kode kartu
            </div>
          </div>
          <button
            onClick={() => { stopStream(); onClose(); }}
            className="btn btn-ghost"
            style={{ padding: "6px 12px", fontSize: "0.8rem", borderRadius: 8 }}
          >
            ✕ Tutup
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div style={{ position: "relative", background: "#050508", aspectRatio: "1", overflow: "hidden" }}>
          {error ? (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: 24, textAlign: "center", gap: 14,
            }}>
              <div style={{ fontSize: "2.8rem" }}>📵</div>
              <div style={{ color: "#FCA5A5", fontSize: "0.85rem", lineHeight: 1.6, maxWidth: 320 }}>
                {error}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary"
                style={{ fontSize: "0.85rem", padding: "10px 18px" }}
              >
                📁 Pilih Foto QR dari Galeri
              </button>
            </div>
          ) : (
            <>
              {/* Live Video Feed */}
              <video
                ref={videoRef}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                muted
                playsInline
              />

              {/* Scanning Target Box & Animated Reticle */}
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                <div style={{
                  width: "66%", height: "66%",
                  maxWidth: 240, maxHeight: 240,
                  border: scannedSuccess ? "3px solid #10B981" : "2px solid rgba(99,102,241,0.7)",
                  borderRadius: 20,
                  boxShadow: scannedSuccess
                    ? "0 0 40px rgba(16,185,129,0.7), 0 0 0 9999px rgba(0,0,0,0.55)"
                    : "0 0 0 9999px rgba(0,0,0,0.5)",
                  position: "relative",
                  transition: "all 0.25s ease",
                }}>
                  {/* Glowing Corner Brackets */}
                  {[
                    { top: -2, left: -2, borderTop: "4px solid #6366F1", borderLeft: "4px solid #6366F1", borderTopLeftRadius: 18 },
                    { top: -2, right: -2, borderTop: "4px solid #6366F1", borderRight: "4px solid #6366F1", borderTopRightRadius: 18 },
                    { bottom: -2, left: -2, borderBottom: "4px solid #6366F1", borderLeft: "4px solid #6366F1", borderBottomLeftRadius: 18 },
                    { bottom: -2, right: -2, borderBottom: "4px solid #6366F1", borderRight: "4px solid #6366F1", borderBottomRightRadius: 18 },
                  ].map((s, i) => (
                    <div key={i} style={{ position: "absolute", width: 30, height: 30, ...s }} />
                  ))}

                  {/* Laser Scan Line */}
                  {!scannedSuccess && !loading && (
                    <div style={{
                      position: "absolute", left: 10, right: 10, height: 3,
                      background: "linear-gradient(90deg, transparent, #818CF8, #6366F1, #818CF8, transparent)",
                      borderRadius: 999,
                      boxShadow: "0 0 14px #6366F1",
                      animation: "qrscanline 1.6s ease-in-out infinite",
                    }} />
                  )}

                  {/* Success Flash Overlay */}
                  {scannedSuccess && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: 18,
                      background: "rgba(16,185,129,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "3rem",
                    }}>
                      ✅
                    </div>
                  )}
                </div>
              </div>

              {/* In-camera Controls Toolbar (Torch, Camera Switch) */}
              <div style={{
                position: "absolute", top: 12, right: 12,
                display: "flex", gap: 8, zIndex: 10,
              }}>
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: torchOn ? "rgba(245,158,11,0.3)" : "rgba(0,0,0,0.6)",
                      border: torchOn ? "1px solid #F59E0B" : "1px solid rgba(255,255,255,0.2)",
                      color: torchOn ? "#FCD34D" : "#FFF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", fontSize: "1.1rem",
                      backdropFilter: "blur(8px)",
                    }}
                    title={torchOn ? "Matikan Lampu Senter" : "Nyalakan Lampu Senter"}
                  >
                    💡
                  </button>
                )}

                {devices.length > 1 && (
                  <button
                    onClick={() => {
                      const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
                      const nextDevice = devices[(currentIndex + 1) % devices.length];
                      if (nextDevice) {
                        setSelectedDeviceId(nextDevice.deviceId);
                        startCamera(nextDevice.deviceId);
                      }
                    }}
                    style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: "rgba(0,0,0,0.6)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#FFF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", fontSize: "1.1rem",
                      backdropFilter: "blur(8px)",
                    }}
                    title="Ganti Lensa Kamera"
                  >
                    🔄
                  </button>
                )}
              </div>

              {/* Loading Spinner */}
              {loading && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.7)", gap: 10,
                }}>
                  <div className="spinner" style={{ width: 28, height: 28 }} />
                  <span style={{ fontSize: "0.8rem", color: "#A5B4FC" }}>Membuka kamera fokus tinggi...</span>
                </div>
              )}

              <style>{`
                @keyframes qrscanline {
                  0%   { top: 12px; opacity: 0; }
                  15%  { opacity: 1; }
                  85%  { opacity: 1; }
                  100% { top: calc(100% - 15px); opacity: 0; }
                }
              `}</style>
            </>
          )}
        </div>

        {/* Modal Footer & Alternatives */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {scannedSuccess ? "✅ QR Berhasil Terbaca!" : "Arahkan kamera 10–25 cm dari QR code kartu"}
            </span>

            {/* Upload image button as foolproof fallback */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-ghost"
              style={{
                padding: "6px 12px", fontSize: "0.75rem",
                color: "#A5B4FC", borderColor: "rgba(99,102,241,0.3)",
                background: "rgba(99,102,241,0.08)",
              }}
            >
              📁 Unggah Foto QR
            </button>
          </div>

          <div style={{ fontSize: "0.68rem", color: "#7A7A95", textAlign: "center", lineHeight: 1.4 }}>
            Didukung oleh hardware autofocus kamera HD &amp; barcode engine pintar.
          </div>
        </div>

      </div>
    </div>
  );
}

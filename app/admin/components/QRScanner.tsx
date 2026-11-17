"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, SwitchCamera, Upload, X, Zap } from "lucide-react";

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

function extractCode(text: string): string {
  const trimmed = text.trim();
  const cMatch = trimmed.match(/\/c\/([a-zA-Z0-9_-]+)/i);
  if (cMatch) return cMatch[1];

  const codeParam = trimmed.match(/[?&]code=([a-zA-Z0-9_-]+)/i);
  if (codeParam) return codeParam[1];

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
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

const LS_CAMERA_ID = "grc_preferred_camera_id";
const LS_CAMERA_INDEX = "grc_preferred_camera_index";

function getCameraDisplayName(device: MediaDeviceInfo, index: number): string {
  const l = (device.label || "").toLowerCase();
  if (l.includes("front") || l.includes("depan") || l.includes("selfie")) {
    return "Kamera Depan";
  }
  if (l.includes("1") || l.includes("main") || l.includes("wide")) {
    return `Lensa ${index + 1} (Fokus Utama)`;
  }
  return `Lensa Kamera ${index + 1}`;
}

function selectBestCamera(videoDevices: MediaDeviceInfo[]): MediaDeviceInfo | null {
  if (videoDevices.length === 0) return null;
  if (videoDevices.length === 1) return videoDevices[0];

  try {
    const savedId = localStorage.getItem(LS_CAMERA_ID);
    if (savedId) {
      const match = videoDevices.find((d) => d.deviceId === savedId);
      if (match) return match;
    }
    const savedIdx = localStorage.getItem(LS_CAMERA_INDEX);
    if (savedIdx !== null) {
      const idx = parseInt(savedIdx, 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < videoDevices.length) {
        return videoDevices[idx];
      }
    }
  } catch {}

  const rearCameras = videoDevices.filter((d) => {
    const l = (d.label || "").toLowerCase();
    return (
      !l.includes("front") &&
      !l.includes("selfie") &&
      !l.includes("user") &&
      !l.includes("depan")
    );
  });

  const candidates = rearCameras.length > 0 ? rearCameras : videoDevices;
  if (candidates.length === 1) return candidates[0];
  if (candidates.length >= 2) return candidates[1];
  return candidates[0];
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isStoppedRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2800);
  }, []);

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
    setTorchOn(false);
  }, []);

  const handleFoundCode = useCallback(
    (rawText: string) => {
      if (isStoppedRef.current) return;
      isStoppedRef.current = true;
      const code = extractCode(rawText);

      playBeep();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(60);
        } catch {}
      }

      setScannedSuccess(true);
      stopStream();

      setTimeout(() => {
        onScan(code);
      }, 360);
    },
    [onScan, stopStream]
  );

  const decodeCanvas = useCallback(async (canvas: HTMLCanvasElement): Promise<string | null> => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        const detector = new (window as unknown as {
          BarcodeDetector: new (opts: { formats: string[] }) => {
            detect: (src: HTMLCanvasElement | HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
          };
        }).BarcodeDetector({ formats: ["qr_code"] });
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue;
        }
      } catch {}
    }

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeFromCanvas(canvas);
      if (result) return result.getText();
    } catch {}

    return null;
  }, []);

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
          const w = video.videoWidth || 640;
          const h = video.videoHeight || 480;

          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }

          ctx.drawImage(video, 0, 0, w, h);

          if (typeof window !== "undefined" && "BarcodeDetector" in window) {
            try {
              const detector = new (window as unknown as {
                BarcodeDetector: new (opts: { formats: string[] }) => {
                  detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
                };
              }).BarcodeDetector({ formats: ["qr_code"] });
              const barcodes = await detector.detect(video);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                handleFoundCode(barcodes[0].rawValue);
                return;
              }
            } catch {}
          }

          const decoded = await decodeCanvas(canvas);
          if (decoded) {
            handleFoundCode(decoded);
            return;
          }
        } catch {
        } finally {
          isProcessing = false;
        }
      }

      if (!isStoppedRef.current) {
        setTimeout(() => {
          if (!isStoppedRef.current) {
            animFrameRef.current = requestAnimationFrame(scanFrame);
          }
        }, 80);
      }
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [decodeCanvas, handleFoundCode]);

  const startCamera = useCallback(
    async (preferredId?: string) => {
      stopStream();
      isStoppedRef.current = false;
      setLoading(true);
      setError(null);
      setScannedSuccess(false);

      try {
        let targetId = preferredId;

        if (!targetId && typeof window !== "undefined") {
          try {
            const savedId = localStorage.getItem(LS_CAMERA_ID);
            if (savedId) targetId = savedId;
          } catch {}
        }

        if (!targetId && typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
          try {
            const all = await navigator.mediaDevices.enumerateDevices();
            const vInputs = all.filter((d) => d.kind === "videoinput");
            if (vInputs.length > 0) {
              setDevices(vInputs);
              const best = selectBestCamera(vInputs);
              if (best && best.deviceId) {
                targetId = best.deviceId;
                try {
                  localStorage.setItem(LS_CAMERA_ID, best.deviceId);
                } catch {}
              }
            }
          } catch {}
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: targetId
              ? {
                  deviceId: { exact: targetId },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                }
              : {
                  facingMode: { ideal: "environment" },
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                },
          });
        } catch (firstErr) {
          if (targetId) {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                deviceId: { ideal: targetId },
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
            });
          } else {
            throw firstErr;
          }
        }

        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        if (track) {
          activeTrackRef.current = track;

          try {
            const caps =
              (track as unknown as { getCapabilities?: () => Record<string, unknown> }).getCapabilities?.() ||
              {};
            setHasTorch("torch" in caps);
            if ("focusMode" in caps && Array.isArray((caps as { focusMode: unknown[] }).focusMode)) {
              const fm = (caps as { focusMode: string[] }).focusMode;
              if (fm.includes("continuous")) {
                await (track as unknown as {
                  applyConstraints: (c: Record<string, unknown>) => Promise<void>;
                }).applyConstraints({
                  advanced: [{ focusMode: "continuous" }],
                });
              }
            }
          } catch {}
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
        }

        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
          setDevices(videoInputs);
          const actualId = track ? track.getSettings().deviceId : targetId;
          if (actualId) {
            setSelectedDeviceId(actualId);
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
          setError("Gagal membuka kamera. Anda juga dapat memilih foto QR dari galeri.");
        }
      }
    },
    [startScanningLoop, stopStream]
  );

  const toggleTorch = async () => {
    if (!activeTrackRef.current) return;
    try {
      const nextState = !torchOn;
      await (activeTrackRef.current as unknown as {
        applyConstraints: (c: Record<string, unknown>) => Promise<void>;
      }).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {}
  };

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
        setError("QR Code tidak terdeteksi pada gambar tersebut. Pastikan foto jelas dan cukup cahaya.");
      } catch {
        setError("Gagal membaca gambar QR.");
      } finally {
        URL.revokeObjectURL(objectUrl);
        setLoading(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setLoading(false);
      setError("Format gambar tidak valid.");
    };

    img.src = objectUrl;
  };

  const switchCamera = useCallback(() => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];
    if (nextDevice) {
      setSelectedDeviceId(nextDevice.deviceId);
      try {
        localStorage.setItem(LS_CAMERA_ID, nextDevice.deviceId);
        localStorage.setItem(LS_CAMERA_INDEX, String(nextIndex));
      } catch {}

      const displayName = getCameraDisplayName(nextDevice, nextIndex);
      showToast(`${displayName} disimpan sebagai default`);
      startCamera(nextDevice.deviceId);
    }
  }, [devices, selectedDeviceId, showToast, startCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [startCamera, stopStream]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-elevated text-indigo-400">
              <Camera className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Scan QR Kartu Fisik</h3>
              <p className="text-xs text-subtle">Arahkan kamera ke QR pada kartu</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-subtle transition-colors hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
            <span>Tutup</span>
          </button>
        </div>

        <div className="relative aspect-square overflow-hidden bg-black">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
                <CameraOff className="h-6 w-6" />
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-rose-300">{error}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                <Upload className="h-4 w-4" />
                <span>Pilih Foto QR dari Galeri</span>
              </button>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="block h-full w-full object-cover" muted playsInline />

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className={`relative h-2/3 w-2/3 max-h-60 max-w-60 rounded-2xl border-2 transition-colors ${
                    scannedSuccess
                      ? "border-emerald-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                      : "border-indigo-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.52)]"
                  }`}
                >
                  <div className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-2xl border-l-4 border-t-4 border-indigo-400" />
                  <div className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-2xl border-r-4 border-t-4 border-indigo-400" />
                  <div className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-2xl border-b-4 border-l-4 border-indigo-400" />
                  <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-2xl border-b-4 border-r-4 border-indigo-400" />

                  {!scannedSuccess && !loading && (
                    <div className="animate-qr-scanline absolute inset-x-3 h-0.5 rounded-full bg-indigo-400" />
                  )}

                  {scannedSuccess && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                      <CheckCircle2 className="h-12 w-12" strokeWidth={2} />
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute right-3 top-3 z-10 flex gap-2">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border backdrop-blur-md transition-colors ${
                      torchOn
                        ? "border-amber-400 bg-amber-500/25 text-amber-300"
                        : "border-white/20 bg-black/60 text-white"
                    }`}
                    title={torchOn ? "Matikan Lampu" : "Nyalakan Lampu"}
                  >
                    <Zap className="h-4 w-4" />
                  </button>
                )}

                {devices.length > 1 && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                    title="Ganti Lensa & Simpan sebagai Default"
                  >
                    <SwitchCamera className="h-4 w-4" />
                  </button>
                )}
              </div>

              {toastMsg && (
                <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-500/30 bg-surface/95 px-3.5 py-1.5 text-xs font-medium text-emerald-300 shadow-lg">
                  {toastMsg}
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/75">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
                  <span className="text-xs text-subtle">Membuka kamera...</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-hairline px-5 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-subtle">
              {scannedSuccess ? "QR berhasil terbaca" : "Jarak ideal 10 sampai 25 cm dari kartu"}
            </span>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 text-xs font-medium text-ink transition-colors hover:border-white/20"
            >
              <Upload className="h-3.5 w-3.5 text-indigo-400" />
              <span>Unggah Foto</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

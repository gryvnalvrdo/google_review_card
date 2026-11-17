import QRCode from "qrcode";
import {
  BinaryBitmap,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  QRCodeReader,
} from "@zxing/library";

export const DEFAULT_CARD_W = 638;
export const DEFAULT_CARD_H = 1004;
export const DEFAULT_QR_SIZE = 280;
export const DEFAULT_QR_PAD = 22;
export const DEFAULT_BOX_SIZE = DEFAULT_QR_SIZE + DEFAULT_QR_PAD * 2;
export const DEFAULT_BOX_X = Math.round((DEFAULT_CARD_W - DEFAULT_BOX_SIZE) / 2);
export const DEFAULT_BOX_Y = 448;

export type QRDotStyle = "dots" | "rounded" | "squares";
export type QRLogoType = "none" | "google" | "star" | "nfc";

export interface QRPlacementConfig {
  x: number;
  y: number;
  size: number;
  style: "transparent" | "white_box";
  padding: number;
  radius: number;
  fgColor?: string;
  boxColor?: string;
  dotStyle?: QRDotStyle;
  logoType?: QRLogoType;
  eraseBackground?: boolean;
}

export const DEFAULT_PLACEMENT: QRPlacementConfig = {
  x: DEFAULT_BOX_X,
  y: DEFAULT_BOX_Y,
  size: DEFAULT_BOX_SIZE,
  style: "white_box",
  padding: DEFAULT_QR_PAD,
  radius: 18,
  fgColor: "#000000",
  boxColor: "#FFFFFF",
  dotStyle: "squares",
  logoType: "none",
};

export function getQrRenderSize(p: QRPlacementConfig, scale: number): number {
  const boxSize = Math.round(p.size * scale);
  if (p.style === "white_box") {
    const pad = Math.min(Math.round((p.padding ?? 18) * scale), Math.floor(boxSize * 0.3));
    return Math.max(16, boxSize - pad * 2);
  }
  return Math.max(16, boxSize);
}

export function applySharpenFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount = 0.28
) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const src = imgData.data;
    const output = new Uint8ClampedArray(src.length);
    output.set(src);

    const rowBytes = width * 4;
    for (let y = 1; y < height - 1; y++) {
      const yOffset = y * rowBytes;
      for (let x = 1; x < width - 1; x++) {
        const idx = yOffset + x * 4;
        for (let c = 0; c < 3; c++) {
          const val = src[idx + c];
          const neighbors =
            (src[idx - 4 + c] +
              src[idx + 4 + c] +
              src[idx - rowBytes + c] +
              src[idx + rowBytes + c]) *
            0.25;
          const sharp = val + (val - neighbors) * amount;
          output[idx + c] = sharp < 0 ? 0 : sharp > 255 ? 255 : sharp;
        }
      }
    }
    imgData.data.set(output);
    ctx.putImageData(imgData, 0, 0);
  } catch {}
}

export function enhanceBackgroundImage(
  img: HTMLImageElement,
  upscaleFactor: number,
  sharpenLevel: "off" | "medium" | "high"
): HTMLCanvasElement {
  const cardW = img.naturalWidth || DEFAULT_CARD_W;
  const cardH = img.naturalHeight || DEFAULT_CARD_H;
  const outW = Math.round(cardW * upscaleFactor);
  const outH = Math.round(cardH * upscaleFactor);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, outW, outH);

  if (sharpenLevel !== "off") {
    const strength = sharpenLevel === "high" ? 0.42 : 0.24;
    applySharpenFilter(ctx, outW, outH, strength);
  }

  return canvas;
}

export function detectBoxInImage(img: HTMLImageElement): {
  x: number;
  y: number;
  size: number;
  detected: boolean;
} {
  const cardW = img.naturalWidth || DEFAULT_CARD_W;
  const cardH = img.naturalHeight || DEFAULT_CARD_H;
  if (!cardW || !cardH) return { x: 100, y: 100, size: 200, detected: false };

  try {
    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No 2d context");
    ctx.drawImage(img, 0, 0, cardW, cardH);

    const imgData = ctx.getImageData(0, 0, cardW, cardH).data;
    const cornerPix = ctx.getImageData(Math.floor(cardW * 0.05), Math.floor(cardH * 0.05), 1, 1).data;

    const candidateXs = [0.25, 0.5, 0.75, 0.85].map((r) => Math.floor(cardW * r));
    const candidateYs = [0.6, 0.5, 0.4, 0.7].map((r) => Math.floor(cardH * r));

    let bestResult: { x: number; y: number; size: number; detected: boolean } | null = null;
    let bestBoxArea = 0;

    for (const testX of candidateXs) {
      for (const testY of candidateYs) {
        const pix = ctx.getImageData(testX, testY, 1, 1).data;
        const tr = pix[0];
        const tg = pix[1];
        const tb = pix[2];

        const cornerDiff =
          Math.abs(tr - cornerPix[0]) + Math.abs(tg - cornerPix[1]) + Math.abs(tb - cornerPix[2]);
        const brightness = (tr + tg + tb) / 3;
        if (cornerDiff < 35 || brightness < 160) continue;

        const step = Math.max(1, Math.floor(Math.min(cardW, cardH) / 380));
        const startX = Math.max(0, Math.floor(testX - cardW * 0.35));
        const endX = Math.min(cardW, Math.floor(testX + cardW * 0.35));
        const startY = Math.max(0, Math.floor(testY - cardH * 0.3));
        const endY = Math.min(cardH, Math.floor(testY + cardH * 0.3));

        let minX = cardW;
        let maxX = 0;
        let minY = cardH;
        let maxY = 0;
        let matches = 0;

        for (let y = startY; y < endY; y += step) {
          for (let x = startX; x < endX; x += step) {
            const idx = (y * cardW + x) * 4;
            const diff =
              Math.abs(imgData[idx] - tr) +
              Math.abs(imgData[idx + 1] - tg) +
              Math.abs(imgData[idx + 2] - tb);
            if (diff < 45) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              matches++;
            }
          }
        }

        const boxW = maxX - minX;
        const boxH = maxY - minY;
        const boxArea = boxW * boxH;
        if (matches > 20 && boxW > cardW * 0.14 && boxH > cardH * 0.14 && boxArea > bestBoxArea) {
          const rawSize = Math.min(boxW, boxH);
          const safeMargin = Math.round(rawSize * 0.04);
          const finalSize = Math.round(rawSize - safeMargin * 2);
          const cX = minX + boxW / 2;
          const cY = minY + boxH / 2;
          bestBoxArea = boxArea;
          bestResult = {
            x: Math.round(cX - finalSize / 2),
            y: Math.round(cY - finalSize / 2),
            size: finalSize,
            detected: true,
          };
        }
      }
    }

    if (bestResult) return bestResult;
  } catch {}

  const fallbackSize = Math.round(Math.min(cardW, cardH) * 0.42);
  return {
    x: Math.round((cardW - fallbackSize) / 2),
    y: Math.round(cardH * 0.48),
    size: fallbackSize,
    detected: false,
  };
}

function findInnerQROrDarkContent(
  img: HTMLImageElement,
  box: { x: number; y: number; size: number }
): { x: number; y: number; size: number; bgColor: string } | null {
  try {
    const cardW = img.naturalWidth || DEFAULT_CARD_W;
    const cardH = img.naturalHeight || DEFAULT_CARD_H;
    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, cardW, cardH);

    const marginH = Math.floor(box.size * 0.1);
    const marginTop = Math.floor(box.size * 0.12);
    const marginBottom = Math.floor(box.size * 0.1);

    const startX = Math.max(0, box.x + marginH);
    const endX = Math.min(cardW, box.x + box.size - marginH);
    const startY = Math.max(0, box.y + marginTop);
    const endY = Math.min(cardH, box.y + box.size - marginBottom);

    const p1 = ctx.getImageData(startX + 4, startY + 4, 1, 1).data;
    const p2 = ctx.getImageData(endX - 4, startY + 4, 1, 1).data;
    const p3 = ctx.getImageData(startX + 4, endY - 4, 1, 1).data;
    const p4 = ctx.getImageData(endX - 4, endY - 4, 1, 1).data;

    const bgR = Math.round((p1[0] + p2[0] + p3[0] + p4[0]) / 4);
    const bgG = Math.round((p1[1] + p2[1] + p3[1] + p4[1]) / 4);
    const bgB = Math.round((p1[2] + p2[2] + p3[2] + p4[2]) / 4);
    const containerBg = `rgb(${bgR},${bgG},${bgB})`;

    const step = Math.max(1, Math.floor(box.size / 280));
    let minX = cardW;
    let maxX = 0;
    let minY = cardH;
    let maxY = 0;
    let darkPixelCount = 0;

    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        const lum = p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114;
        const diffFromBg = Math.abs(p[0] - bgR) + Math.abs(p[1] - bgG) + Math.abs(p[2] - bgB);
        if (diffFromBg > 50 && lum < 125 && p[3] > 100) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          darkPixelCount++;
        }
      }
    }

    if (darkPixelCount > 25 && maxX > minX && maxY > minY) {
      const rawW = maxX - minX;
      const rawH = maxY - minY;
      const ratio = rawW / (rawH || 1);
      if (ratio >= 0.7 && ratio <= 1.4 && rawW > box.size * 0.18) {
        const pad = Math.round(Math.max(rawW, rawH) * 0.06);
        const qrSize = Math.max(rawW, rawH) + pad * 2;
        const cX = (minX + maxX) / 2;
        const cY = (minY + maxY) / 2;
        return {
          x: Math.max(0, Math.min(cardW - qrSize, Math.round(cX - qrSize / 2))),
          y: Math.max(0, Math.min(cardH - qrSize, Math.round(cY - qrSize / 2))),
          size: qrSize,
          bgColor: containerBg,
        };
      }
    }
  } catch {}
  return null;
}

function eraseDummyQRCodeFromImage(
  img: HTMLImageElement,
  qrBox: { x: number; y: number; size: number },
  fillColor?: string
): Promise<{ image: HTMLImageElement; erasedBox: { x: number; y: number; size: number } }> {
  return new Promise((resolve) => {
    try {
      const cardW = img.naturalWidth || DEFAULT_CARD_W;
      const cardH = img.naturalHeight || DEFAULT_CARD_H;
      const canvas = document.createElement("canvas");
      canvas.width = cardW;
      canvas.height = cardH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve({ image: img, erasedBox: qrBox });
        return;
      }
      ctx.drawImage(img, 0, 0, cardW, cardH);
      const frame = ctx.getImageData(0, 0, cardW, cardH);
      const d = frame.data;

      const x0 = Math.max(0, qrBox.x);
      const y0 = Math.max(0, qrBox.y);
      const x1 = Math.min(cardW, qrBox.x + qrBox.size);
      const y1 = Math.min(cardH, qrBox.y + qrBox.size);
      let minX = cardW;
      let maxX = 0;
      let minY = cardH;
      let maxY = 0;
      let darkCount = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * cardW + x) * 4;
          const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          if (lum < 115 && d[i + 3] > 100) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            darkCount++;
          }
        }
      }

      let eraseX = qrBox.x;
      let eraseY = qrBox.y;
      let eraseSize = qrBox.size;
      if (darkCount > 25 && maxX > minX && maxY > minY) {
        const rawW = maxX - minX;
        const rawH = maxY - minY;
        const ratio = rawW / (rawH || 1);
        if (ratio >= 0.7 && ratio <= 1.4) {
          const qz = Math.max(4, Math.round(Math.max(rawW, rawH) * 0.06));
          const cX = (minX + maxX) / 2;
          const cY = (minY + maxY) / 2;
          const targetSize = Math.max(rawW, rawH) + qz * 2;
          eraseX = Math.max(0, Math.min(cardW - targetSize, Math.round(cX - targetSize / 2)));
          eraseY = Math.max(0, Math.min(cardH - targetSize, Math.round(cY - targetSize / 2)));
          eraseSize = targetSize;
        }
      }

      const corner = (cx: number, cy: number) => {
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const px = Math.max(0, Math.min(cardW - 1, cx + ox));
            const py = Math.max(0, Math.min(cardH - 1, cy + oy));
            const i = (py * cardW + px) * 4;
            r += d[i];
            g += d[i + 1];
            b += d[i + 2];
            n++;
          }
        }
        return [r / n, g / n, b / n];
      };
      const ex1 = Math.min(cardW, eraseX + eraseSize);
      const ey1 = Math.min(cardH, eraseY + eraseSize);
      const gap = 5;
      const tl = corner(eraseX - gap, eraseY - gap);
      const tr = corner(ex1 + gap, eraseY - gap);
      const bl = corner(eraseX - gap, ey1 + gap);
      const br = corner(ex1 + gap, ey1 + gap);
      const spread = Math.max(
        ...[tr, bl, br].map(
          (c) => Math.abs(c[0] - tl[0]) + Math.abs(c[1] - tl[1]) + Math.abs(c[2] - tl[2])
        )
      );

      if (fillColor || spread < 24) {
        let fill = fillColor;
        if (!fill) {
          fill = `rgb(${Math.round((tl[0] + tr[0] + bl[0] + br[0]) / 4)},${Math.round(
            (tl[1] + tr[1] + bl[1] + br[1]) / 4
          )},${Math.round((tl[2] + tr[2] + bl[2] + br[2]) / 4)})`;
        }
        ctx.fillStyle = fill;
        ctx.fillRect(eraseX, eraseY, eraseSize, eraseSize);
      } else {
        const w = Math.max(1, ex1 - eraseX - 1);
        const h = Math.max(1, ey1 - eraseY - 1);
        for (let y = eraseY; y < ey1; y++) {
          const v = (y - eraseY) / h;
          for (let x = eraseX; x < ex1; x++) {
            const u = (x - eraseX) / w;
            const i = (y * cardW + x) * 4;
            for (let c = 0; c < 3; c++) {
              const top = tl[c] + (tr[c] - tl[c]) * u;
              const bot = bl[c] + (br[c] - bl[c]) * u;
              d[i + c] = top + (bot - top) * v;
            }
            d[i + 3] = 255;
          }
        }
        ctx.putImageData(frame, 0, 0);
      }

      const cleanImg = new Image();
      cleanImg.onload = () =>
        resolve({ image: cleanImg, erasedBox: { x: eraseX, y: eraseY, size: eraseSize } });
      cleanImg.onerror = () => resolve({ image: img, erasedBox: qrBox });
      cleanImg.src = canvas.toDataURL("image/png");
    } catch {
      resolve({ image: img, erasedBox: qrBox });
    }
  });
}

function centerQRInSlot(
  img: HTMLImageElement,
  box: { x: number; y: number; size: number }
): { x: number; y: number; size: number; centered: boolean } {
  const fallback = { ...box, centered: false };
  try {
    const cardW = img.naturalWidth || DEFAULT_CARD_W;
    const cardH = img.naturalHeight || DEFAULT_CARD_H;
    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, cardW, cardH);
    const d = ctx.getImageData(0, 0, cardW, cardH).data;

    const cx = Math.round(box.x + box.size / 2);
    const cy = Math.round(box.y + box.size / 2);
    const ci = (cy * cardW + cx) * 4;
    const bgR = d[ci];
    const bgG = d[ci + 1];
    const bgB = d[ci + 2];
    const same = (x: number, y: number) => {
      const i = (y * cardW + x) * 4;
      return Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB) < 48;
    };
    const maxSteps = Math.round(box.size * 1.6);
    const march = (sx: number, sy: number, dx: number, dy: number) => {
      let n = 0;
      while (n < maxSteps) {
        const nx = sx + dx * (n + 1);
        const ny = sy + dy * (n + 1);
        if (nx < 0 || ny < 0 || nx >= cardW || ny >= cardH) return maxSteps;
        if (!same(nx, ny)) break;
        n++;
      }
      return n;
    };

    const left = march(cx, cy, -1, 0);
    const right = march(cx, cy, 1, 0);
    if (left >= maxSteps || right >= maxSteps) return fallback;
    const slotL = cx - left;
    const slotR = cx + right;
    const slotW = slotR - slotL;
    if (slotW < box.size * 0.9 || slotW > box.size * 2.4) return fallback;

    const xa = Math.round(slotL + slotW * 0.1);
    const xb = Math.round(slotR - slotW * 0.1);
    const up = Math.min(march(xa, cy, 0, -1), march(xb, cy, 0, -1));
    const down = Math.min(march(xa, cy, 0, 1), march(xb, cy, 0, 1));
    const slotT = cy - up;
    const slotB = cy + down;
    const slotH = slotB - slotT;

    let yValid =
      up < maxSteps && down < maxSteps && slotH >= box.size * 0.9 && slotH <= box.size * 2.4;
    if (yValid) {
      const sx0 = Math.round(slotL + slotW * 0.1);
      const sx1 = Math.round(slotR - slotW * 0.1);
      const bandClean = (ya: number, yb: number) => {
        for (let y = Math.max(0, ya); y < Math.min(cardH, yb); y += 2) {
          for (let x = sx0; x < sx1; x += 2) {
            if (!same(x, y)) return false;
          }
        }
        return true;
      };
      yValid = bandClean(slotT, box.y) && bandClean(box.y + box.size, slotB);
    }

    const newCx = (slotL + slotR) / 2;
    const newCy = yValid ? (slotT + slotB) / 2 : cy;
    const limit = Math.min(slotW, yValid ? slotH : Infinity) * 0.96;
    const size = Math.round(Math.min(box.size, limit));
    return {
      x: Math.max(0, Math.min(cardW - size, Math.round(newCx - size / 2))),
      y: Math.max(0, Math.min(cardH - size, Math.round(newCy - size / 2))),
      size,
      centered: true,
    };
  } catch {
    return fallback;
  }
}

export async function detectClientQRCode(img: HTMLImageElement): Promise<{
  x: number;
  y: number;
  size: number;
  detected: boolean;
  qrFound: boolean;
  method: "zxing" | "pattern" | "box" | "fallback";
  text?: string;
  bgColor?: string;
}> {
  const cardW = img.naturalWidth || DEFAULT_CARD_W;
  const cardH = img.naturalHeight || DEFAULT_CARD_H;
  if (!cardW || !cardH) {
    return { x: 100, y: 100, size: 200, detected: false, qrFound: false, method: "fallback" };
  }

  function tryZxingDirect(
    srcCanvas: HTMLCanvasElement,
    offsetX = 0,
    offsetY = 0,
    dsFactor = 1
  ): { x: number; y: number; size: number; text: string } | null {
    try {
      const luminance = new HTMLCanvasElementLuminanceSource(srcCanvas);
      const binarizer = new HybridBinarizer(luminance);
      const bitmap = new BinaryBitmap(binarizer);
      const reader = new QRCodeReader();
      const result = reader.decode(bitmap);

      const points = result.getResultPoints();
      if (!points || points.length < 2) return null;

      const xs = points.map((p) => p.getX() / dsFactor + offsetX);
      const ys = points.map((p) => p.getY() / dsFactor + offsetY);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const distFinder = Math.max(maxX - minX, maxY - minY);

      const coverSize = Math.round(distFinder * 1.34);
      const maxAllowedSize = Math.round(Math.min(cardW, cardH) * 0.85);
      const size = Math.min(coverSize, maxAllowedSize);

      const cX = (minX + maxX) / 2;
      const cY = (minY + maxY) / 2;
      return {
        x: Math.max(0, Math.min(cardW - size, Math.round(cX - size / 2))),
        y: Math.max(0, Math.min(cardH - size, Math.round(cY - size / 2))),
        size,
        text: result.getText(),
      };
    } catch {
      return null;
    }
  }

  try {
    const maxDim = 1400;
    const longSide = Math.max(cardW, cardH);
    const dsFactor = longSide > maxDim ? maxDim / longSide : 1;
    const dsW = Math.round(cardW * dsFactor);
    const dsH = Math.round(cardH * dsFactor);

    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = dsW;
    fullCanvas.height = dsH;
    const fullCtx = fullCanvas.getContext("2d", { willReadFrequently: true })!;
    fullCtx.imageSmoothingEnabled = true;
    fullCtx.imageSmoothingQuality = "high";
    fullCtx.drawImage(img, 0, 0, dsW, dsH);

    function cropCanvas(sx: number, sy: number, sw: number, sh: number): HTMLCanvasElement {
      const c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      c.getContext("2d")!.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      return c;
    }

    let res = tryZxingDirect(fullCanvas, 0, 0, dsFactor);
    if (res) return { ...res, detected: true, qrFound: true, method: "zxing" };

    const rhX = Math.round(dsW * 0.4);
    const rhW = dsW - rhX;
    if (rhW > 60) {
      res = tryZxingDirect(cropCanvas(rhX, 0, rhW, dsH), Math.round(rhX / dsFactor), 0, dsFactor);
      if (res) return { ...res, detected: true, qrFound: true, method: "zxing" };
    }

    const bhY = Math.round(dsH * 0.4);
    const bhH = Math.round(dsH * 0.5);
    if (bhH > 60) {
      res = tryZxingDirect(cropCanvas(0, bhY, dsW, bhH), 0, Math.round(bhY / dsFactor), dsFactor);
      if (res) return { ...res, detected: true, qrFound: true, method: "zxing" };
    }

    if (rhW > 60 && bhH > 60) {
      res = tryZxingDirect(
        cropCanvas(rhX, bhY, rhW, bhH),
        Math.round(rhX / dsFactor),
        Math.round(bhY / dsFactor),
        dsFactor
      );
      if (res) return { ...res, detected: true, qrFound: true, method: "zxing" };
    }

    const lhW = Math.round(dsW * 0.6);
    if (lhW > 60) {
      res = tryZxingDirect(cropCanvas(0, 0, lhW, dsH), 0, 0, dsFactor);
      if (res) return { ...res, detected: true, qrFound: true, method: "zxing" };
    }
  } catch {}

  const boxResult = detectBoxInImage(img);
  if (boxResult.detected) {
    const innerQR = findInnerQROrDarkContent(img, boxResult);
    if (innerQR) {
      return {
        x: innerQR.x,
        y: innerQR.y,
        size: innerQR.size,
        detected: true,
        qrFound: true,
        method: "box",
        bgColor: innerQR.bgColor,
      };
    }
  }

  try {
    const maxDim = 800;
    const longSide = Math.max(cardW, cardH);
    const dsFactor = longSide > maxDim ? maxDim / longSide : 1;
    const dsW = Math.round(cardW * dsFactor);
    const dsH = Math.round(cardH * dsFactor);

    const canvas = document.createElement("canvas");
    canvas.width = dsW;
    canvas.height = dsH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, dsW, dsH);
      const imgData = ctx.getImageData(0, 0, dsW, dsH).data;

      const step = Math.max(2, Math.floor(Math.min(dsW, dsH) / 120));
      const gridW = Math.floor(dsW / step);
      const gridH = Math.floor(dsH / step);
      const lum = new Uint8Array(gridW * gridH);

      for (let gy = 0; gy < gridH; gy++) {
        const py = gy * step;
        for (let gx = 0; gx < gridW; gx++) {
          const px = gx * step;
          const idx = (py * dsW + px) * 4;
          lum[gy * gridW + gx] = Math.round(
            imgData[idx] * 0.299 + imgData[idx + 1] * 0.587 + imgData[idx + 2] * 0.114
          );
        }
      }

      const testSizes = [0.18, 0.26, 0.36].map((r) => Math.round(Math.min(gridW, gridH) * r));
      let bestScore = 0;
      let bestBox = { gx: 0, gy: 0, gSize: testSizes[1] };

      for (const winSize of testSizes) {
        if (winSize < 10) continue;
        const scanStep = Math.max(2, Math.floor(winSize / 4));

        for (let gy = 0; gy <= gridH - winSize; gy += scanStep) {
          for (let gx = 0; gx <= gridW - winSize; gx += scanStep) {
            let hTransitions = 0;
            let vTransitions = 0;
            const threshold = 45;

            for (let y = gy; y < gy + winSize; y += 2) {
              const rowStart = y * gridW;
              for (let x = gx + 1; x < gx + winSize; x++) {
                if (Math.abs(lum[rowStart + x] - lum[rowStart + x - 1]) > threshold) {
                  hTransitions++;
                }
              }
            }

            for (let x = gx; x < gx + winSize; x += 2) {
              for (let y = gy + 1; y < gy + winSize; y++) {
                if (Math.abs(lum[y * gridW + x] - lum[(y - 1) * gridW + x]) > threshold) {
                  vTransitions++;
                }
              }
            }

            if (vTransitions === 0) continue;
            const axisRatio = hTransitions / vTransitions;
            if (axisRatio > 3.5 || axisRatio < 0.3) continue;

            const score = Math.min(hTransitions, vTransitions);
            if (score > bestScore) {
              bestScore = score;
              bestBox = { gx, gy, gSize: winSize };
            }
          }
        }
      }

      const minExpectedTransitions = bestBox.gSize * bestBox.gSize * 0.045;
      if (bestScore > minExpectedTransitions && bestScore > 30) {
        const realX = Math.round((bestBox.gx * step) / dsFactor);
        const realY = Math.round((bestBox.gy * step) / dsFactor);
        const foundSize = Math.round(((bestBox.gSize * step) / dsFactor) * 1.12);
        return {
          x: Math.max(0, Math.min(cardW - foundSize, realX)),
          y: Math.max(0, Math.min(cardH - foundSize, realY)),
          size: foundSize,
          detected: true,
          qrFound: true,
          method: "pattern",
        };
      }
    }
  } catch {}

  if (boxResult.detected) {
    return { ...boxResult, qrFound: false, method: "box" };
  }

  return { ...boxResult, qrFound: false, method: "fallback" };
}

export async function processCustomDesign(sourceImg: HTMLImageElement) {
  const result = await detectClientQRCode(sourceImg);
  let activeImg = sourceImg;
  let placement = { x: result.x, y: result.y, size: result.size };
  let centered = false;
  if (result.qrFound) {
    const eraseRes = await eraseDummyQRCodeFromImage(
      sourceImg,
      { x: result.x, y: result.y, size: result.size },
      result.bgColor
    );
    activeImg = eraseRes.image;
    const slot = centerQRInSlot(activeImg, eraseRes.erasedBox);
    placement = { x: slot.x, y: slot.y, size: slot.size };
    centered = slot.centered;
  }
  return { result, activeImg, placement, centered };
}

export function generateRandomCode(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

function drawGoogleLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, iconSize: number) {
  if (typeof Path2D === "undefined") {
    ctx.save();
    ctx.fillStyle = "#4285F4";
    ctx.font = `bold ${Math.round(iconSize * 0.8)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("G", cx, cy);
    ctx.restore();
    return;
  }

  try {
    ctx.save();
    ctx.translate(cx - iconSize / 2, cy - iconSize / 2);
    const scale = iconSize / 48;
    ctx.scale(scale, scale);

    const pRed = new Path2D(
      "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    );
    const pBlue = new Path2D(
      "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    );
    const pYellow = new Path2D(
      "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"
    );
    const pGreen = new Path2D(
      "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    );

    ctx.fillStyle = "#EA4335";
    ctx.fill(pRed);
    ctx.fillStyle = "#4285F4";
    ctx.fill(pBlue);
    ctx.fillStyle = "#FBBC05";
    ctx.fill(pYellow);
    ctx.fillStyle = "#34A853";
    ctx.fill(pGreen);
    ctx.restore();
  } catch {
    ctx.restore();
  }
}

function drawStarLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, iconSize: number) {
  const outerR = iconSize / 2;
  const innerR = outerR * 0.42;
  const spikes = 5;
  ctx.save();
  ctx.beginPath();
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;

  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
  ctx.fillStyle = "#F59E0B";
  ctx.fill();
  ctx.restore();
}

function drawNfcLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, iconSize: number) {
  ctx.save();
  ctx.strokeStyle = "#4F46E5";
  ctx.fillStyle = "#4F46E5";
  ctx.lineCap = "round";
  const lw = Math.max(2, iconSize * 0.09);
  ctx.lineWidth = lw;

  const originX = cx - iconSize * 0.22;
  ctx.beginPath();
  ctx.arc(originX, cy, lw * 0.75, 0, Math.PI * 2);
  ctx.fill();

  const radii = [iconSize * 0.26, iconSize * 0.46, iconSize * 0.66];
  radii.forEach((r) => {
    ctx.beginPath();
    ctx.arc(originX, cy, r, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();
  });
  ctx.restore();
}

export function compositeCard(
  enhancedBgCanvas: HTMLCanvasElement,
  qrCanvas: HTMLCanvasElement,
  placement: QRPlacementConfig,
  upscaleFactor = 1
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const targetW = enhancedBgCanvas.width;
  const targetH = enhancedBgCanvas.height;
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext("2d", { willReadFrequently: true })!;

  ctx.drawImage(enhancedBgCanvas, 0, 0, targetW, targetH);

  const scale = upscaleFactor;
  const boxX = Math.round(placement.x * scale);
  const boxY = Math.round(placement.y * scale);
  const boxSize = Math.round(placement.size * scale);

  if (placement.style === "white_box") {
    const pad = Math.min(Math.round((placement.padding ?? 18) * scale), Math.floor(boxSize * 0.3));
    const rad = Math.round((placement.radius ?? 18) * scale);

    ctx.fillStyle = placement.boxColor || "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(boxX + rad, boxY);
    ctx.lineTo(boxX + boxSize - rad, boxY);
    ctx.arcTo(boxX + boxSize, boxY, boxX + boxSize, boxY + rad, rad);
    ctx.lineTo(boxX + boxSize, boxY + boxSize - rad);
    ctx.arcTo(boxX + boxSize, boxY + boxSize, boxX + boxSize - rad, boxY + boxSize, rad);
    ctx.lineTo(boxX + rad, boxY + boxSize);
    ctx.arcTo(boxX, boxY + boxSize, boxX, boxY + boxSize - rad, rad);
    ctx.lineTo(boxX, boxY + rad);
    ctx.arcTo(boxX, boxY, boxX + rad, boxY, rad);
    ctx.closePath();
    ctx.fill();

    const innerQrX = boxX + pad;
    const innerQrY = boxY + pad;
    const innerQrSize = Math.max(16, boxSize - pad * 2);
    ctx.imageSmoothingEnabled = innerQrSize !== qrCanvas.width;
    ctx.drawImage(qrCanvas, innerQrX, innerQrY, innerQrSize, innerQrSize);
  } else {
    ctx.imageSmoothingEnabled = boxSize !== qrCanvas.width;
    ctx.drawImage(qrCanvas, boxX, boxY, boxSize, boxSize);
  }

  return out;
}

export function renderStyledQR(
  canvas: HTMLCanvasElement,
  text: string,
  size: number,
  dotStyle: QRDotStyle = "squares",
  fgColor = "#000000",
  bgColor = "transparent",
  logoType: QRLogoType = "none"
) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  if (bgColor !== "transparent") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const count = qr.modules.size;
  const cellSize = Math.max(1, Math.floor(size / count));
  const qrOffset = Math.floor((size - cellSize * count) / 2);
  ctx.save();
  ctx.translate(qrOffset, qrOffset);

  ctx.fillStyle = fgColor;
  ctx.strokeStyle = fgColor;

  const isFinder = (r: number, c: number) => {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= count - 7) return true;
    if (r >= count - 7 && c < 7) return true;
    return false;
  };

  const isCenterBadge = (r: number, c: number) => {
    if (logoType === "none") return false;
    const centerCell = (count - 1) / 2;
    const badgeRadiusCells = (count * 0.24) / 2;
    const dist = Math.hypot(r - centerCell, c - centerCell);
    return dist <= badgeRadiusCells + 0.3;
  };

  const fillRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
    ctx.fill();
  };

  const strokeRoundedRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    lw: number
  ) => {
    ctx.lineWidth = lw;
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
    ctx.stroke();
  };

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.modules.get(r, c) && !isFinder(r, c) && !isCenterBadge(r, c)) {
        const x = c * cellSize;
        const y = r * cellSize;
        if (dotStyle === "dots") {
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;
          const radius = (cellSize / 2) * 0.88;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (dotStyle === "rounded") {
          const pad = cellSize * 0.08;
          fillRoundedRect(
            x + pad,
            y + pad,
            cellSize - pad * 2,
            cellSize - pad * 2,
            cellSize * 0.35
          );
        } else {
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }
  }

  const finderPositions = [
    { row: 0, col: 0 },
    { row: 0, col: count - 7 },
    { row: count - 7, col: 0 },
  ];

  finderPositions.forEach(({ row, col }) => {
    const startX = col * cellSize;
    const startY = row * cellSize;

    if (dotStyle === "dots" || dotStyle === "rounded") {
      const ringX = startX + 0.5 * cellSize;
      const ringY = startY + 0.5 * cellSize;
      const ringSize = 6 * cellSize;
      const outerRad = 1.7 * cellSize;
      strokeRoundedRect(ringX, ringY, ringSize, ringSize, outerRad, cellSize);

      const eyeX = startX + 2 * cellSize;
      const eyeY = startY + 2 * cellSize;
      const eyeSize = 3 * cellSize;
      fillRoundedRect(
        eyeX,
        eyeY,
        eyeSize,
        eyeSize,
        dotStyle === "dots" ? 1.2 * cellSize : 0.8 * cellSize
      );
    } else {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (qr.modules.get(row + r, col + c)) {
            ctx.fillRect((col + c) * cellSize, (row + r) * cellSize, cellSize, cellSize);
          }
        }
      }
    }
  });

  ctx.restore();

  if (logoType !== "none") {
    const centerPx = size / 2;
    const badgePx = size * 0.23;
    const badgeRadius = badgePx / 2;

    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(centerPx, centerPx, badgeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = Math.max(1.5, size * 0.006);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.stroke();

    const iconSize = badgePx * 0.62;
    if (logoType === "google") {
      drawGoogleLogo(ctx, centerPx, centerPx, iconSize);
    } else if (logoType === "star") {
      drawStarLogo(ctx, centerPx, centerPx, iconSize);
    } else if (logoType === "nfc") {
      drawNfcLogo(ctx, centerPx, centerPx, iconSize);
    }
    ctx.restore();
  }
}

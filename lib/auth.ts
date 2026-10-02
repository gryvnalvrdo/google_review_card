import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 jam

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET belum diisi di environment variables");
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createSessionCookieValue(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  if (sign(payload) !== signature) return false;
  const expiresAt = Number(payload);
  if (Number.isNaN(expiresAt)) return false;
  return Date.now() < expiresAt;
}

export async function isAdminLoggedIn(): Promise<boolean> {
  const store = await cookies();
  return isValidSessionValue(store.get(COOKIE_NAME)?.value);
}

/**
 * Timing-safe password comparison — mencegah timing attack.
 * Hash dua-duanya dengan HMAC dulu baru dibandingkan byte-by-byte
 * sehingga panjang password tidak bocor lewat durasi perbandingan.
 */
export function verifyPassword(input: string): boolean {
  const stored = process.env.ADMIN_PASSWORD;
  if (!stored || !input) return false;
  const key = "pwd-verify-key";
  const inputHash = Buffer.from(
    crypto.createHmac("sha256", key).update(input).digest("hex")
  );
  const storedHash = Buffer.from(
    crypto.createHmac("sha256", key).update(stored).digest("hex")
  );
  return crypto.timingSafeEqual(inputHash, storedHash);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

// Rate limit sederhana (in-memory, per instance Vercel).
// Cukup untuk memperlambat brute force — bukan proteksi penuh di multi-instance.
const attempts = new Map<string, { count: number; firstAttemptAt: number }>();
const WINDOW_MS = 1000 * 60 * 15; // 15 menit
const MAX_ATTEMPTS = 10;

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttemptAt: now });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createClient } from "@vercel/kv";
import crypto from "crypto";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

const kvUrl = process.env.KV_REST_API_URL || process.env.KV_REST_API_URL_KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_URL_KV_REST_API_TOKEN;
const rateLimitKv = kvUrl && kvToken ? createClient({ url: kvUrl, token: kvToken }) : null;

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
  const expected = sign(payload);
  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== signatureBuf.length) return false;
  if (!crypto.timingSafeEqual(expectedBuf, signatureBuf)) return false;
  const expiresAt = Number(payload);
  if (Number.isNaN(expiresAt)) return false;
  return Date.now() < expiresAt;
}

export async function isAdminLoggedIn(): Promise<boolean> {
  const store = await cookies();
  return isValidSessionValue(store.get(COOKIE_NAME)?.value);
}

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

export function extractClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstHop = forwarded.split(",")[0]?.trim();
    if (firstHop) return firstHop.slice(0, 64);
  }
  return "unknown";
}

export function isValidSameOrigin(req: NextRequest): boolean {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  if (!host) return false;

  const origin = req.headers.get("origin");
  if (origin !== null) {
    if (origin === "null") return false;
    try {
      return new URL(origin).host.toLowerCase() === host;
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host.toLowerCase() === host;
    } catch {
      return false;
    }
  }

  return true;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

const attempts = new Map<string, { count: number; firstAttemptAt: number }>();
const WINDOW_MS = 1000 * 60 * 15;
const WINDOW_SECONDS = 900;
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

export async function isRateLimitedAsync(ip: string): Promise<boolean> {
  if (rateLimitKv) {
    try {
      const key = `rl:login:${ip}`;
      const count = await rateLimitKv.incr(key);
      if (count === 1) {
        await rateLimitKv.expire(key, WINDOW_SECONDS);
      }
      return count > MAX_ATTEMPTS;
    } catch {
      return isRateLimited(ip);
    }
  }
  return isRateLimited(ip);
}

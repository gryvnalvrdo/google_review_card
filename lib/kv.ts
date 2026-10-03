import { createClient } from "@vercel/kv";

export type CardRecord = {
  code: string;
  storeName: string;
  googleReviewUrl: string;
  createdAt: string;
  updatedAt: string;
  price?: number;
};

const KEY_PREFIX   = "card:";
const TAP_PREFIX   = "tap:";
const INDEX_KEY    = "card:_index";
const STOK_INDEX   = "stok:_index";   // set kode yang sudah dicetak tapi belum di-assign

// Mengambil env vars standar atau nama hasil auto-generate Vercel Integration
const kvUrl = process.env.KV_REST_API_URL || process.env.KV_REST_API_URL_KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_URL_KV_REST_API_TOKEN;

// Fallback in-memory untuk dev lokal tanpa Vercel KV.
// DATA HILANG tiap restart — jangan dipakai di produksi.
const memoryStore = new Map<string, CardRecord>();
const tapStore    = new Map<string, number>();
const stokStore   = new Set<string>();          // in-memory stok fallback

const hasKv = Boolean(kvUrl && kvToken);
const vercelKv = hasKv ? createClient({ url: kvUrl!, token: kvToken! }) : null;

export async function getCard(code: string): Promise<CardRecord | null> {
  if (hasKv && vercelKv) {
    const data = await vercelKv.get<CardRecord>(KEY_PREFIX + code);
    return data ?? null;
  }
  return memoryStore.get(code) ?? null;
}

export async function setCard(record: CardRecord): Promise<void> {
  if (hasKv && vercelKv) {
    await vercelKv.set(KEY_PREFIX + record.code, record);
    await vercelKv.sadd(INDEX_KEY, record.code);
    return;
  }
  memoryStore.set(record.code, record);
}

export async function deleteCard(code: string): Promise<void> {
  if (hasKv && vercelKv) {
    await Promise.all([
      vercelKv.del(KEY_PREFIX + code),
      vercelKv.del(TAP_PREFIX + code),
      vercelKv.srem(INDEX_KEY, code),
    ]);
    return;
  }
  memoryStore.delete(code);
  tapStore.delete(code);
}

export async function incrementTapCount(code: string): Promise<void> {
  if (hasKv && vercelKv) {
    await vercelKv.incr(TAP_PREFIX + code);
    return;
  }
  tapStore.set(code, (tapStore.get(code) ?? 0) + 1);
}

export async function listCards(): Promise<(CardRecord & { tapCount: number })[]> {
  if (hasKv && vercelKv) {
    const codes = await vercelKv.smembers<string[]>(INDEX_KEY);
    if (!codes || codes.length === 0) return [];
    const [records, taps] = await Promise.all([
      Promise.all(codes.map((c) => getCard(c))),
      Promise.all(codes.map((c) =>
        vercelKv.get<number>(TAP_PREFIX + c).then((v) => v ?? 0)
      )),
    ]);
    return records
      .map((r, i) => (r ? { ...r, tapCount: taps[i] } : null))
      .filter((r): r is CardRecord & { tapCount: number } => r !== null);
  }
  return Array.from(memoryStore.values()).map((r) => ({
    ...r,
    tapCount: tapStore.get(r.code) ?? 0,
  }));
}

// ── STOK FUNCTIONS ──────────────────────────────────────────────────────────

/** Simpan sejumlah kode sebagai stok (belum di-assign). */
export async function addStokCodes(codes: string[]): Promise<void> {
  if (codes.length === 0) return;
  if (hasKv && vercelKv) {
    await vercelKv.sadd(STOK_INDEX, ...codes);
    return;
  }
  codes.forEach((c) => stokStore.add(c));
}

/** Hapus satu kode dari stok (ketika di-assign ke toko). */
export async function removeStokCode(code: string): Promise<void> {
  if (hasKv && vercelKv) {
    await vercelKv.srem(STOK_INDEX, code);
    return;
  }
  stokStore.delete(code);
}

/** Daftar semua kode stok (belum di-assign). */
export async function listStokCodes(): Promise<string[]> {
  if (hasKv && vercelKv) {
    const members = await vercelKv.smembers<string[]>(STOK_INDEX);
    return members ?? [];
  }
  return Array.from(stokStore);
}

/** Jumlah kode stok. */
export async function getStokCount(): Promise<number> {
  if (hasKv && vercelKv) {
    const n = await vercelKv.scard(STOK_INDEX);
    return n ?? 0;
  }
  return stokStore.size;
}

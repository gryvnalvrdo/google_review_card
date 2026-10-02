import { kv as vercelKv } from "@vercel/kv";

export type CardRecord = {
  code: string;
  storeName: string;
  googleReviewUrl: string;
  createdAt: string;
  updatedAt: string;
};

const KEY_PREFIX = "card:";
const INDEX_KEY = "card:_index"; // set berisi semua kode yang pernah di-assign

// Fallback in-memory supaya `npm run dev` tetap bisa dicoba tanpa Vercel KV
// terkoneksi. DATA HILANG tiap restart server — jangan dipakai di produksi.
const memoryStore = new Map<string, CardRecord>();
const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export async function getCard(code: string): Promise<CardRecord | null> {
  if (hasKv) {
    const data = await vercelKv.get<CardRecord>(KEY_PREFIX + code);
    return data ?? null;
  }
  return memoryStore.get(code) ?? null;
}

export async function setCard(record: CardRecord): Promise<void> {
  if (hasKv) {
    await vercelKv.set(KEY_PREFIX + record.code, record);
    await vercelKv.sadd(INDEX_KEY, record.code);
    return;
  }
  memoryStore.set(record.code, record);
}

export async function listCards(): Promise<CardRecord[]> {
  if (hasKv) {
    const codes = await vercelKv.smembers<string[]>(INDEX_KEY);
    if (!codes || codes.length === 0) return [];
    const records = await Promise.all(codes.map((c) => getCard(c)));
    return records.filter((r): r is CardRecord => r !== null);
  }
  return Array.from(memoryStore.values());
}

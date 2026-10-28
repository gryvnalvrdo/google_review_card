import { createClient } from "@vercel/kv";

export type TapLogEntry = {
  code: string;
  storeName: string;
  tappedAt: string; // ISO timestamp
};

/** Coba ulang fn maksimal maxAttempts kali. Jika semua gagal, return null (diam-diam). */
async function retryOrNull<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 300
): Promise<T | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch {
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  return null; // semua retry gagal → tampil "kartu belum aktif" seperti biasa
}

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
const TAP_LOG_KEY  = "tap_log";        // list riwayat tap (JSON string), newest first
const TAP_LOG_MAX  = 25000;            // maksimal entri yang disimpan (kapasitas jangka panjang multi-tahun puluhan cafe)

// Mengambil env vars standar atau nama hasil auto-generate Vercel Integration
const kvUrl = process.env.KV_REST_API_URL || process.env.KV_REST_API_URL_KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_URL_KV_REST_API_TOKEN;

// Fallback in-memory untuk dev lokal tanpa Vercel KV.
// DATA HILANG tiap restart — jangan dipakai di produksi.
const memoryStore = new Map<string, CardRecord>();
const tapStore    = new Map<string, number>();
const stokStore   = new Set<string>();          // in-memory stok fallback
const tapLogStore: TapLogEntry[] = [];          // in-memory tap log fallback

const hasKv = Boolean(kvUrl && kvToken);
const vercelKv = hasKv ? createClient({ url: kvUrl!, token: kvToken! }) : null;

// Initial seed data for local dev demonstration (when Vercel KV is not configured)
if (!hasKv && memoryStore.size === 0) {
  const sampleStores = [
    { code: "KPK01", name: "Kopi Kenangan Senopati" },
    { code: "JJR02", name: "Janji Jiwa Roastery Tebet" },
    { code: "FRC03", name: "Fore Coffee Cikini" },
    { code: "KTK04", name: "Kopi Tuku Cipete" },
    { code: "TNM05", name: "Tanamera Coffee Thamrin" },
    { code: "ANM06", name: "Anomali Coffee Kemang" },
  ];

  for (const s of sampleStores) {
    memoryStore.set(s.code, {
      code: s.code,
      storeName: s.name,
      googleReviewUrl: "https://g.page/r/sample/review",
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      price: 150000,
    });
  }

  const now = Date.now();
  for (let dayOffset = 55; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(now - dayOffset * 86400000);
    const dayOfWeek = dayDate.getDay();
    const baseTaps = dayOfWeek === 0 || dayOfWeek === 6 ? 6 : 3;
    const numTaps = Math.max(1, Math.round(baseTaps + ((dayOffset % 3) - 1)));

    for (let t = 0; t < numTaps; t++) {
      const storeIdx = Math.floor(Math.pow(Math.random(), 1.6) * sampleStores.length);
      const store = sampleStores[Math.min(storeIdx, sampleStores.length - 1)];

      const hourRand = Math.random();
      let hour = 19;
      if (hourRand < 0.25) hour = 12 + Math.floor(Math.random() * 3);
      else if (hourRand < 0.7) hour = 18 + Math.floor(Math.random() * 4);
      else hour = 9 + Math.floor(Math.random() * 12);

      const tapTime = new Date(dayDate);
      tapTime.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));

      tapLogStore.push({
        code: store.code,
        storeName: store.name,
        tappedAt: tapTime.toISOString(),
      });
      tapStore.set(store.code, (tapStore.get(store.code) || 0) + 1);
    }
  }
}

export async function getCard(code: string): Promise<CardRecord | null> {
  if (hasKv && vercelKv) {
    // Retry hingga 3x untuk menangani transient error Vercel KV.
    // Jika semua gagal, return null → route handler tampil "kartu belum aktif" seperti biasa.
    const data = await retryOrNull(() =>
      vercelKv!.get<CardRecord>(KEY_PREFIX + code)
    );
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
    try {
      const rawLogs = await vercelKv.lrange<string>(TAP_LOG_KEY, 0, TAP_LOG_MAX - 1);
      if (rawLogs && rawLogs.length > 0) {
        const remaining = rawLogs
          .map((item) => {
            if (typeof item === "string") {
              try { return JSON.parse(item) as TapLogEntry; } catch { return null; }
            }
            return item as unknown as TapLogEntry;
          })
          .filter((e): e is TapLogEntry => e !== null && e.code !== code);

        await vercelKv.del(TAP_LOG_KEY);
        if (remaining.length > 0) {
          // Gunakan lpush dengan urutan terbalik agar newest-first terjaga (sama dengan addTapLog)
          await vercelKv.lpush(TAP_LOG_KEY, ...[...remaining].reverse().map((e) => JSON.stringify(e)));
        }
      }
    } catch (e) {
      console.error("Gagal membersihkan tap_log untuk kode", code, e);
    }

    await Promise.all([
      vercelKv.del(KEY_PREFIX + code),
      vercelKv.del(TAP_PREFIX + code),
      vercelKv.srem(INDEX_KEY, code),
    ]);
    return;
  }
  memoryStore.delete(code);
  tapStore.delete(code);
  for (let i = tapLogStore.length - 1; i >= 0; i--) {
    if (tapLogStore[i].code === code) {
      tapLogStore.splice(i, 1);
    }
  }
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

/** Hapus semua kode stok. */
export async function clearStok(): Promise<void> {
  if (hasKv && vercelKv) {
    await vercelKv.del(STOK_INDEX);
    return;
  }
  stokStore.clear();
}

/** Jumlah kode stok. */
export async function getStokCount(): Promise<number> {
  if (hasKv && vercelKv) {
    const n = await vercelKv.scard(STOK_INDEX);
    return n ?? 0;
  }
  return stokStore.size;
}

// ── TAP LOG FUNCTIONS ───────────────────────────────────────────────

/** Catat satu tap event ke log. Simpan maks TAP_LOG_MAX entri terbaru. */
export async function addTapLog(entry: TapLogEntry): Promise<void> {
  if (hasKv && vercelKv) {
    // LPUSH = push ke head list (newest first), lalu trim ke TAP_LOG_MAX
    await vercelKv.lpush(TAP_LOG_KEY, JSON.stringify(entry));
    await vercelKv.ltrim(TAP_LOG_KEY, 0, TAP_LOG_MAX - 1);
    return;
  }
  tapLogStore.unshift(entry);
  if (tapLogStore.length > TAP_LOG_MAX) tapLogStore.splice(TAP_LOG_MAX);
}

/** Ambil N entri tap terbaru (hanya untuk kartu yang masih aktif). */
export async function getTapLogs(limit = 50): Promise<TapLogEntry[]> {
  if (hasKv && vercelKv) {
    const [activeCodesList, raw] = await Promise.all([
      vercelKv.smembers<string[]>(INDEX_KEY),
      vercelKv.lrange<string>(TAP_LOG_KEY, 0, TAP_LOG_MAX - 1),
    ]);

    const activeCodes = new Set(activeCodesList ?? []);
    if (!raw || raw.length === 0) return [];

    let hasOrphan = false;
    const validLogs: TapLogEntry[] = [];

    for (const item of raw) {
      let entry: TapLogEntry | null = null;
      if (typeof item === "string") {
        try { entry = JSON.parse(item) as TapLogEntry; } catch { entry = null; }
      } else {
        entry = item as unknown as TapLogEntry;
      }

      if (entry && entry.code) {
        if (activeCodes.has(entry.code)) {
          validLogs.push(entry);
        } else {
          hasOrphan = true;
        }
      }
    }

    // Jika ada orphan log dari kartu yang sudah dihapus sebelumnya, bersihkan di Redis secara async
    if (hasOrphan) {
      (async () => {
        try {
          await vercelKv.del(TAP_LOG_KEY);
          if (validLogs.length > 0) {
            // Gunakan lpush dengan urutan terbalik agar newest-first terjaga
            await vercelKv.lpush(TAP_LOG_KEY, ...[...validLogs].reverse().map((e) => JSON.stringify(e)));
          }
        } catch (err) {
          console.error("Gagal auto-clean orphan tap_log:", err);
        }
      })();
    }

    return validLogs.slice(0, limit);
  }

  const activeCodes = new Set(memoryStore.keys());
  const valid = tapLogStore.filter((e) => activeCodes.has(e.code));
  return valid.slice(0, limit);
}

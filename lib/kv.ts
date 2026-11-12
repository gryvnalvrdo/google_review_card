import { createClient } from "@vercel/kv";

export type TapLogEntry = {
  code: string;
  storeName: string;
  tappedAt: string; // ISO timestamp
};

/** Coba ulang fn maksimal maxAttempts kali.
 *  Jika semua retry gagal karena exception (bukan karena data null),
 *  lempar error agar caller bisa membedakan "tidak ditemukan" vs "gagal koneksi". */
async function retryOrThrow<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 300
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr; // semua retry gagal → lempar error ke caller
}

export type CardRecord = {
  code: string;
  storeName: string;
  googleReviewUrl: string;
  createdAt: string;
  updatedAt: string;
  price?: number;
  cost?: number; // Modal awal pembuatan kartu (HPP)
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
      cost: 25000,
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

// Cache memori jangka pendek per serverless container untuk kartu (TTL 45 detik)
// Sangat krusial agar NFC tap instan (<5ms), menghemat kuota Upstash,
// dan mencegah error koneksi/rate-limit menampilkan "kartu belum aktif".
const cardMemCache = new Map<string, { card: CardRecord | null; expires: number }>();

export async function getCard(code: string): Promise<CardRecord | null> {
  const normalized = (code || "").trim();
  if (!normalized) return null;

  const now = Date.now();
  const cached = cardMemCache.get(normalized);
  if (cached && cached.expires > now) {
    return cached.card;
  }

  if (hasKv && vercelKv) {
    try {
      // Retry hingga 3x untuk menangani transient error Vercel KV.
      const data = await retryOrThrow(() =>
        vercelKv!.get<CardRecord>(KEY_PREFIX + normalized)
      );
      const res = data ?? null;
      cardMemCache.set(normalized, { card: res, expires: now + 45000 });
      return res;
    } catch (err) {
      // Jika terjadi error koneksi ke KV tetapi sebelumnya ada cache di memori (meskipun stale),
      // gunakan data cache tersebut agar pelanggan tidak pernah terblokir!
      if (cached?.card) {
        console.warn("KV fetch error, using stale cached card for code=" + normalized, err);
        return cached.card;
      }
      throw err;
    }
  }

  return memoryStore.get(normalized) ?? null;
}

export async function setCard(record: CardRecord): Promise<void> {
  // Update cache memori lokal segera
  cardMemCache.set(record.code, { card: record, expires: Date.now() + 45000 });

  if (hasKv && vercelKv) {
    await vercelKv.set(KEY_PREFIX + record.code, record);
    await vercelKv.sadd(INDEX_KEY, record.code);
    return;
  }
  memoryStore.set(record.code, record);
}

/** Reset hitungan tap dan bersihkan entri log tap untuk satu kartu tertentu (misal toko/lokasi berganti). */
export async function resetCardTaps(code: string): Promise<void> {
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

        // Pastikan urutan selalu kronologis (newest-first)
        remaining.sort((a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime());

        if (remaining.length > 0) {
          const tempKey = `${TAP_LOG_KEY}:reset:${Date.now()}`;
          await vercelKv.rpush(tempKey, ...remaining.map((e) => JSON.stringify(e)));
          await vercelKv.rename(tempKey, TAP_LOG_KEY);
        } else {
          await vercelKv.del(TAP_LOG_KEY);
        }
      }
    } catch (e) {
      console.error("Gagal membersihkan tap_log untuk kode", code, e);
    }

    await vercelKv.del(TAP_PREFIX + code);
    return;
  }

  tapStore.delete(code);
  for (let i = tapLogStore.length - 1; i >= 0; i--) {
    if (tapLogStore[i].code === code) {
      tapLogStore.splice(i, 1);
    }
  }
}

export async function deleteCard(code: string): Promise<void> {
  cardMemCache.delete(code);
  await resetCardTaps(code);
  if (hasKv && vercelKv) {
    await Promise.all([
      vercelKv.del(KEY_PREFIX + code),
      vercelKv.srem(INDEX_KEY, code),
    ]);
    return;
  }
  memoryStore.delete(code);
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

    const cardKeys = codes.map((c) => KEY_PREFIX + c);
    const tapKeys = codes.map((c) => TAP_PREFIX + c);

    // Optimasi MGET: Ambil seluruh data kartu dan tap dalam 1 batch command Redis
    // (Menghemat 99% kuota command Redis dibandingkan loop GET per kartu)
    const [rawRecords, rawTaps, rawLogs] = await Promise.all([
      cardKeys.length > 0
        ? vercelKv.mget<CardRecord[]>(...cardKeys).catch(() => Promise.all(codes.map((c) => getCard(c))))
        : [],
      tapKeys.length > 0
        ? vercelKv.mget<number[]>(...tapKeys).catch(() => Promise.all(codes.map((c) => vercelKv!.get<number>(TAP_PREFIX + c).then((v) => v ?? 0))))
        : [],
      vercelKv.lrange<string>(TAP_LOG_KEY, 0, TAP_LOG_MAX - 1).catch(() => []),
    ]);

    const records = (rawRecords as (CardRecord | null)[]) ?? [];
    const taps = ((rawTaps as (number | null)[]) ?? []).map((v) => (typeof v === "number" ? v : 0));

    // Warm-up memory cache untuk semua kartu yang diambil
    const now = Date.now();
    for (const r of records) {
      if (r && r.code) {
        cardMemCache.set(r.code, { card: r, expires: now + 45000 });
      }
    }

    // Hitung riwayat log per kode kartu agar angka di Daftar Kartu selalu 100% konsisten
    // dengan halaman Riwayat Tap (menghindari selisih akibat log masa lalu ter-trim atau async delay)
    const logCounts = new Map<string, number>();
    if (rawLogs && rawLogs.length > 0) {
      for (const item of rawLogs) {
        let entry: TapLogEntry | null = null;
        if (typeof item === "string") {
          try { entry = JSON.parse(item); } catch {}
        } else {
          entry = item as unknown as TapLogEntry;
        }
        if (entry && entry.code) {
          logCounts.set(entry.code, (logCounts.get(entry.code) ?? 0) + 1);
        }
      }
    }

    return records
      .map((r, i) => {
        if (!r) return null;
        const code = r.code;
        const countFromLogs = logCounts.get(code) ?? 0;
        // Jika ada tap_log tersimpan di sistem, jumlah log riil adalah acuan mutlak (single source of truth)
        const hasLogsInSystem = rawLogs && rawLogs.length > 0;
        const tapCount = hasLogsInSystem ? countFromLogs : (taps[i] ?? 0);

        // Self-healing: jika counter numerik tap:code berbeda dengan jumlah log riil,
        // sinkronkan counter ke Redis secara otomatis agar konsisten di semua tempat
        if (hasLogsInSystem && taps[i] !== countFromLogs) {
          vercelKv.set(TAP_PREFIX + code, countFromLogs).catch(() => {});
        }

        return { ...r, tapCount };
      })
      .filter((r): r is CardRecord & { tapCount: number } => r !== null);
  }

  const activeCodes = new Set(memoryStore.keys());
  const valid = tapLogStore.filter((e) => activeCodes.has(e.code));
  const logCounts = new Map<string, number>();
  valid.forEach(l => logCounts.set(l.code, (logCounts.get(l.code) ?? 0) + 1));

  return Array.from(memoryStore.values()).map((r) => ({
    ...r,
    tapCount: logCounts.get(r.code) ?? (tapStore.get(r.code) ?? 0),
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

    // Cek apakah ada entri yang tidak berurutan secara kronologis
    let isOutOfOrder = false;
    for (let i = 0; i < validLogs.length - 1; i++) {
      if (new Date(validLogs[i].tappedAt).getTime() < new Date(validLogs[i + 1].tappedAt).getTime()) {
        isOutOfOrder = true;
        break;
      }
    }

    // Pastikan SELALU diurutkan dari yang terbaru (newest-first)
    validLogs.sort((a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime());

    // Jika ada orphan log atau urutan di Redis sempat teracak, rapikan kembali di Redis secara atomik
    if (hasOrphan || isOutOfOrder) {
      (async () => {
        try {
          if (validLogs.length > 0) {
            const tempKey = `${TAP_LOG_KEY}:heal:${Date.now()}`;
            await vercelKv.rpush(tempKey, ...validLogs.map((e) => JSON.stringify(e)));
            await vercelKv.rename(tempKey, TAP_LOG_KEY);
          } else {
            await vercelKv.del(TAP_LOG_KEY);
          }
        } catch (err) {
          console.error("Gagal auto-heal urutan tap_log di KV:", err);
        }
      })();
    }

    return validLogs.slice(0, limit);
  }

  const activeCodes = new Set(memoryStore.keys());
  const valid = tapLogStore
    .filter((e) => activeCodes.has(e.code))
    .sort((a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime());
  return valid.slice(0, limit);
}

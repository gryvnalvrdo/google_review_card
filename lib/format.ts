export function formatRupiah(amount: number | undefined | null): string {
  const num = typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
  return `Rp ${num.toLocaleString("id-ID")}`;
}

export function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateSafe(input: string | Date): Date {
  if (input instanceof Date) return input;
  if (!input || typeof input !== "string") return new Date(NaN);
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(trimmed);
}

export function formatDateIndo(dateInput: string | Date): string {
  const d = parseDateSafe(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShortIndo(dateInput: string | Date): string {
  const d = parseDateSafe(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTapDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const date = d.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date}, ${time}`;
}

export function formatFullDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins}m lalu`;

  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((nowDateOnly.getTime() - targetDateOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}j lalu`;
  }
  if (diffDays === 1) return "Kemarin";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} hari lalu`;

  const isPrevYear = target.getFullYear() !== now.getFullYear();
  return target.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    ...(isPrevYear ? { year: "numeric" } : {}),
  });
}

export function getStoreInitials(name?: string): string {
  if (!name || !name.trim()) return "TK";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "TK";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

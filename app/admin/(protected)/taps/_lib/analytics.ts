import { formatDateShortIndo, toDateInputValue } from "../../../../../lib/format";
import type { TapLogEntry } from "../../../../../lib/types";

export type ChartBarItem = {
  label: string;
  subLabel?: string;
  mobileSubLabel?: string;
  value: number;
  highlight?: boolean;
  tooltip?: string;
  dateKey?: string;
  weekKey?: string;
};

export type WeekBucket = {
  weekKey: string;
  label: string;
  subLabel: string;
  mobileSubLabel: string;
  start: Date;
  end: Date;
  count: number;
  logs: TapLogEntry[];
};

export type MonthGroup = {
  monthKey: string;
  label: string;
  total: number;
  byStore: {
    storeName: string;
    code: string;
    count: number;
    lastMonthCount: number;
  }[];
};

export type CafeSummary = {
  storeName: string;
  code: string;
  count: number;
  pct: number;
};

export function getNiceYScale(maxVal: number): { niceMax: number; ticks: number[] } {
  if (maxVal <= 4) return { niceMax: 4, ticks: [0, 1, 2, 3, 4] };
  if (maxVal <= 8) return { niceMax: 8, ticks: [0, 2, 4, 6, 8] };
  if (maxVal <= 12) return { niceMax: 12, ticks: [0, 3, 6, 9, 12] };
  if (maxVal <= 20) return { niceMax: 20, ticks: [0, 5, 10, 15, 20] };
  if (maxVal <= 40) return { niceMax: 40, ticks: [0, 10, 20, 30, 40] };
  if (maxVal <= 60) return { niceMax: 60, ticks: [0, 15, 30, 45, 60] };
  if (maxVal <= 100) return { niceMax: 100, ticks: [0, 25, 50, 75, 100] };

  const pow10 = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const normalized = maxVal / pow10;
  let mult = 10;
  if (normalized <= 1.2) mult = 1.2;
  else if (normalized <= 1.5) mult = 1.5;
  else if (normalized <= 2) mult = 2;
  else if (normalized <= 2.5) mult = 2.5;
  else if (normalized <= 3) mult = 3;
  else if (normalized <= 4) mult = 4;
  else if (normalized <= 5) mult = 5;
  else if (normalized <= 6) mult = 6;
  else if (normalized <= 8) mult = 8;

  const niceMax = Math.ceil(maxVal / ((mult * pow10) / 4)) * ((mult * pow10) / 4);
  const step = niceMax / 4;
  return {
    niceMax,
    ticks: [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), Math.round(niceMax)],
  };
}

export function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const startStr = monday.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  const endStr = sunday.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

  const weekKey = `${monday.getFullYear()}-W${String(getWeekNumber(monday)).padStart(2, "0")}`;
  const label = `${startStr} s/d ${endStr}`;

  return { start: monday, end: sunday, label, weekKey };
}

export function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export function matchesDate(iso: string, targetYmd: string): boolean {
  return toDateInputValue(new Date(iso)) === targetYmd;
}

export function computePeakHour(logs: TapLogEntry[]) {
  const counts = Array(24).fill(0);
  logs.forEach((l) => {
    const h = new Date(l.tappedAt).getHours();
    if (h >= 0 && h < 24) counts[h]++;
  });
  const max = Math.max(...counts);
  if (max === 0) return null;
  const h = counts.indexOf(max);
  return {
    hour: h,
    count: max,
    label: `${String(h).padStart(2, "0")}.00 s/d ${String((h + 1) % 24).padStart(2, "0")}.00`,
  };
}

export function buildHourCounts(logs: TapLogEntry[]): number[] {
  const counts = Array(24).fill(0);
  logs.forEach((l) => {
    const h = new Date(l.tappedAt).getHours();
    if (h >= 0 && h < 24) counts[h]++;
  });
  return counts;
}

export function buildHourChartData(allHourCounts: number[], activeHour: number | null): ChartBarItem[] {
  return allHourCounts.map((v, i) => {
    const isLabeled = i % 4 === 0 || i === 23;
    const hourStr = String(i).padStart(2, "0");
    const nextHourStr = String((i + 1) % 24).padStart(2, "0");
    return {
      label: isLabeled ? `${hourStr}.00` : "",
      value: v,
      highlight: activeHour !== null && i === activeHour,
      tooltip: `Pukul ${hourStr}.00 s/d ${nextHourStr}.00: ${v} tap`,
    };
  });
}

export function buildDailyTrend7(logs: TapLogEntry[]): ChartBarItem[] {
  const days: ChartBarItem[] = [];
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const count = logs.filter((l) => {
      const t = new Date(l.tappedAt);
      return t >= d && t < next;
    }).length;

    const dayName = i === 0 ? "Hari ini" : dayNames[d.getDay()];
    const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const fullDate = d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    days.push({
      label: dayName,
      subLabel: dateStr,
      value: count,
      highlight: i === 0,
      tooltip: `${fullDate}: ${count} tap`,
      dateKey: toDateInputValue(d),
    });
  }
  return days;
}

export function buildDailyTrend30(logs: TapLogEntry[]): ChartBarItem[] {
  const days: ChartBarItem[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const count = logs.filter((l) => {
      const t = new Date(l.tappedAt);
      return t >= d && t < next;
    }).length;

    const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    let label = "";
    if (i === 0) label = "Hari ini";
    else if (i % 5 === 0 || i === 29) label = dateStr;

    const fullDate = d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    days.push({
      label,
      subLabel: dateStr,
      value: count,
      highlight: i === 0,
      tooltip: `${fullDate}: ${count} tap`,
      dateKey: toDateInputValue(d),
    });
  }
  return days;
}

export function buildCustomDailyTrend(
  logs: TapLogEntry[],
  customStartDate: string,
  customEndDate: string
): ChartBarItem[] {
  const start = new Date(customStartDate);
  const end = new Date(customEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const days: ChartBarItem[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endLimit = new Date(end);
  endLimit.setHours(23, 59, 59, 999);

  let stepCount = 0;
  while (current <= endLimit && stepCount < 90) {
    const d = new Date(current);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const count = logs.filter((l) => {
      const t = new Date(l.tappedAt);
      return t >= d && t < next;
    }).length;

    const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const fullDate = d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    days.push({
      label: dateStr,
      subLabel: dateStr,
      value: count,
      highlight: false,
      tooltip: `${fullDate}: ${count} tap`,
      dateKey: toDateInputValue(d),
    });

    current.setDate(current.getDate() + 1);
    stepCount++;
  }
  return days;
}

export function formatWeeklyPeriodLabel(
  weeklyTrendData: WeekBucket[],
  weeklyPeriodType: "8w" | "12w" | "month" | "year",
  weekPageOffset: number,
  selectedWeeklyMonth: string,
  selectedWeeklyYear: number,
  thisMonthKey: string
): string {
  if (weeklyTrendData.length === 0) return "Tren Mingguan";
  const earliest = weeklyTrendData[0].start;
  const latest = weeklyTrendData[weeklyTrendData.length - 1].end;
  if (weeklyPeriodType === "8w") {
    if (weekPageOffset === 0) {
      return weeklyTrendData.length < 8
        ? `${weeklyTrendData.length} Minggu (${formatDateShortIndo(earliest)} s/d ${formatDateShortIndo(latest)})`
        : "8 Minggu Terakhir";
    }
    return `${formatDateShortIndo(earliest)} s/d ${formatDateShortIndo(latest)}`;
  }
  if (weeklyPeriodType === "12w") {
    if (weekPageOffset === 0) {
      return weeklyTrendData.length < 12
        ? `${weeklyTrendData.length} Minggu (${formatDateShortIndo(earliest)} s/d ${formatDateShortIndo(latest)})`
        : "12 Minggu Terakhir";
    }
    return `${formatDateShortIndo(earliest)} s/d ${formatDateShortIndo(latest)}`;
  }
  if (weeklyPeriodType === "month") {
    return `Bulan ${formatMonthLabel(selectedWeeklyMonth || thisMonthKey)}`;
  }
  return `Tahun ${selectedWeeklyYear || new Date().getFullYear()}`;
}

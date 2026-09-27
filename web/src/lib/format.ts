const LOCALE = "vi-VN";

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });

const numberFormatter = new Intl.NumberFormat(LOCALE);

const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.345],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(value: string | number | Date): string {
  return dateTimeFormatter.format(toDate(value));
}

export function formatDate(value: string | number | Date): string {
  return dateFormatter.format(toDate(value));
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatRelative(value: string | number | Date, now: number = Date.now()): string {
  let delta = (toDate(value).getTime() - now) / 1000;
  if (Math.abs(delta) < 45) return "vừa xong";
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(delta) < size) return relativeFormatter.format(Math.round(delta), unit);
    delta /= size;
  }
  return formatDate(value);
}

export function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút`;
  return `${totalSeconds} giây`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} giây`;
  return `${Math.floor(seconds / 60)} phút ${Math.round(seconds % 60)} giây`;
}

export function initialsOf(value: string): string {
  const name = value.split("@")[0] ?? value;
  const parts = name.split(/[._\-\s]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

import type { User } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

export interface MonthPoint {
  key: string;
  label: string;
  longLabel: string;
  created: number;
  total: number;
}

export interface DayPoint {
  key: string;
  label: string;
  longLabel: string;
  created: number;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function monthlySeries(users: User[], months: number, now: Date): MonthPoint[] {
  const times = users.map((user) => new Date(user.createdAt).getTime());
  const points: MonthPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    points.push({
      key: `${start.getFullYear()}-${start.getMonth() + 1}`,
      label: `Th${start.getMonth() + 1}`,
      longLabel: `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`,
      created: times.filter((time) => time >= start.getTime() && time < end.getTime()).length,
      total: times.filter((time) => time < end.getTime()).length,
    });
  }
  return points;
}

export function dailySeries(users: User[], days: number, now: Date): DayPoint[] {
  const times = users.map((user) => new Date(user.createdAt).getTime());
  const points: DayPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset + 1);
    points.push({
      key: start.toISOString(),
      label: WEEKDAYS[start.getDay()],
      longLabel: `${WEEKDAYS[start.getDay()]}, ${formatDate(start)}`,
      created: times.filter((time) => time >= start.getTime() && time < end.getTime()).length,
    });
  }
  return points;
}

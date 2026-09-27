"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { DependencyCheck, LivenessResponse, ReadinessResponse } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";

export type HealthLevel = "operational" | "degraded" | "offline";

export interface HealthSnapshot {
  level: HealthLevel;
  uptimeSeconds: number | null;
  database: DependencyCheck | null;
  roundTripMs: number;
  checkedAt: number;
}

function readDatabaseCheck(details: unknown): DependencyCheck | null {
  if (typeof details !== "object" || details === null || !("database" in details)) return null;
  const database = (details as { database?: DependencyCheck }).database;
  return database && typeof database.status === "string" ? database : null;
}

async function fetchHealth(): Promise<HealthSnapshot> {
  const startedAt = performance.now();
  const [live, ready] = await Promise.allSettled([
    api.get<LivenessResponse>("/health/live"),
    api.get<ReadinessResponse>("/health/ready"),
  ]);
  const roundTripMs = Math.round(performance.now() - startedAt);

  const uptimeSeconds = live.status === "fulfilled" ? live.value.uptimeSeconds : null;
  const database =
    ready.status === "fulfilled"
      ? ready.value.checks.database
      : isApiError(ready.reason)
        ? readDatabaseCheck(ready.reason.details)
        : null;

  const level: HealthLevel =
    live.status === "rejected"
      ? "offline"
      : ready.status === "fulfilled" && database?.status === "up"
        ? "operational"
        : "degraded";

  return { level, uptimeSeconds, database, roundTripMs, checkedAt: Date.now() };
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}

export const HEALTH_COPY: Record<HealthLevel, { label: string; tone: "success" | "warning" | "danger" }> = {
  operational: { label: "Hoạt động ổn định", tone: "success" },
  degraded: { label: "Database gián đoạn", tone: "warning" },
  offline: { label: "Mất kết nối API", tone: "danger" },
};

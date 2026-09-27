import "server-only";
import type { NextRequest } from "next/server";
import type { ApiErrorBody } from "@/lib/api/types";

const BACKEND_TIMEOUT_MS = 15_000;

export const BACKEND_API_URL = (process.env.BACKEND_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

interface BackendInit {
  method?: string;
  body?: BodyInit | null;
  accessToken?: string;
  headers?: Record<string, string>;
}

export function backendFetch(path: string, init: BackendInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.accessToken) headers.set("Authorization", `Bearer ${init.accessToken}`);
  return fetch(`${BACKEND_API_URL}${path}`, {
    method: init.method ?? "GET",
    body: init.body ?? undefined,
    headers,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
  });
}

export function clientContextHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");
  const requestId = request.headers.get("x-request-id");
  if (forwardedFor || realIp) headers["X-Forwarded-For"] = (forwardedFor ?? realIp) as string;
  if (userAgent) headers["User-Agent"] = userAgent;
  if (requestId) headers["X-Request-Id"] = requestId.slice(0, 128);
  return headers;
}

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function errorBody(statusCode: number, error: string, message: string): ApiErrorBody {
  return { statusCode, error, message, timestamp: new Date().toISOString() };
}

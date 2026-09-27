import "server-only";
import { createHash } from "node:crypto";
import type { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import type { AuthResult } from "@/lib/api/types";
import { backendFetch } from "./backend";

const EXPIRY_SKEW_SECONDS = 20;
const REFRESH_REUSE_WINDOW_MS = 30_000;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function readTokenExpiry(token: string): number | null {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const payload = JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isTokenFresh(token: string | undefined): token is string {
  if (!token) return false;
  const exp = readTokenExpiry(token);
  return exp !== null && exp - EXPIRY_SKEW_SECONDS > Math.floor(Date.now() / 1000);
}

export function applySessionCookies(response: NextResponse, result: AuthResult): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, result.accessToken, {
    ...cookieBase,
    maxAge: Math.max(result.expiresIn, 1),
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, result.refreshToken, {
    ...cookieBase,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...cookieBase, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

interface RefreshEntry {
  promise: Promise<AuthResult | null>;
  startedAt: number;
}

const registry = globalThis as typeof globalThis & { __pihRefreshRegistry?: Map<string, RefreshEntry> };

function refreshRegistry(): Map<string, RefreshEntry> {
  registry.__pihRefreshRegistry ??= new Map();
  const map = registry.__pihRefreshRegistry;
  const now = Date.now();
  for (const [key, entry] of map) {
    if (now - entry.startedAt > REFRESH_REUSE_WINDOW_MS) map.delete(key);
  }
  return map;
}

async function requestRefresh(refreshToken: string, headers: Record<string, string>): Promise<AuthResult | null> {
  try {
    const response = await backendFetch("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      headers: { ...headers, "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as AuthResult;
  } catch {
    return null;
  }
}

export function refreshSession(refreshToken: string, headers: Record<string, string> = {}): Promise<AuthResult | null> {
  const map = refreshRegistry();
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const existing = map.get(key);
  if (existing) return existing.promise;
  const promise = requestRefresh(refreshToken, headers);
  map.set(key, { promise, startedAt: Date.now() });
  return promise;
}

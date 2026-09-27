import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";
import type { AuthResult } from "@/lib/api/types";
import { backendFetch, clientContextHeaders, errorBody, isSameOrigin } from "@/lib/server/backend";
import { applySessionCookies, isTokenFresh, refreshSession } from "@/lib/server/session";

const BLOCKED_PATHS = new Set(["auth/login", "auth/register", "auth/refresh"]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "x-request-id",
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
];

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

async function handle(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { path } = await params;
  const normalized = path.join("/").toLowerCase();

  if (BLOCKED_PATHS.has(normalized)) {
    return NextResponse.json(errorBody(404, "Not Found", "Không tìm thấy tài nguyên"), { status: 404 });
  }

  if (MUTATING_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json(errorBody(403, "Forbidden", "Yêu cầu không hợp lệ"), { status: 403 });
  }

  const target = `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const payload = MUTATING_METHODS.has(request.method) ? await request.arrayBuffer() : null;
  const contentType = request.headers.get("content-type");
  const contextHeaders = clientContextHeaders(request);
  const upstreamHeaders = contentType ? { ...contextHeaders, "Content-Type": contentType } : contextHeaders;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  let accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  let rotated: AuthResult | null = null;
  let refreshAttempted = false;

  if (!isTokenFresh(accessToken) && refreshToken) {
    refreshAttempted = true;
    rotated = await refreshSession(refreshToken, contextHeaders);
    if (rotated) accessToken = rotated.accessToken;
  }

  const forward = (token: string | undefined) =>
    backendFetch(target, {
      method: request.method,
      body: payload && payload.byteLength > 0 ? payload : undefined,
      accessToken: token,
      headers: upstreamHeaders,
    });

  let upstream: Response;
  try {
    upstream = await forward(accessToken);
    if (upstream.status === 401 && refreshToken && !refreshAttempted) {
      rotated = await refreshSession(refreshToken, contextHeaders);
      if (rotated) upstream = await forward(rotated.accessToken);
    }
  } catch {
    return NextResponse.json(errorBody(502, "Bad Gateway", "Không thể kết nối tới máy chủ API"), { status: 502 });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  const response = new NextResponse(upstream.body, { status: upstream.status, headers });
  if (rotated) applySessionCookies(response, rotated);
  return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;

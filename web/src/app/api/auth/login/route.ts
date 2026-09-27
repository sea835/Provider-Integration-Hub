import { NextResponse, type NextRequest } from "next/server";
import type { AuthResult } from "@/lib/api/types";
import { backendFetch, clientContextHeaders, errorBody, isSameOrigin } from "@/lib/server/backend";
import { applySessionCookies } from "@/lib/server/session";

const PASSTHROUGH_HEADERS = ["retry-after", "x-request-id"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json(errorBody(403, "Forbidden", "Yêu cầu không hợp lệ"), { status: 403 });
  }

  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = (await request.json()) as typeof credentials;
  } catch {
    return NextResponse.json(errorBody(400, "Bad Request", "Dữ liệu đăng nhập không hợp lệ"), { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await backendFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: typeof credentials.email === "string" ? credentials.email.trim() : "",
        password: typeof credentials.password === "string" ? credentials.password : "",
      }),
      headers: { ...clientContextHeaders(request), "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(errorBody(502, "Bad Gateway", "Không thể kết nối tới máy chủ API"), { status: 502 });
  }

  const body: unknown = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    const headers = new Headers();
    for (const name of PASSTHROUGH_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return NextResponse.json(body ?? errorBody(upstream.status, "Error", "Đăng nhập thất bại"), {
      status: upstream.status,
      headers,
    });
  }

  const result = body as AuthResult;
  const response = NextResponse.json({ user: result.user }, { headers: { "Cache-Control": "no-store" } });
  applySessionCookies(response, result);
  return response;
}

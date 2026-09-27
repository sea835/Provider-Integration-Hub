import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";
import { backendFetch, clientContextHeaders, errorBody, isSameOrigin } from "@/lib/server/backend";
import { clearSessionCookies, isTokenFresh, refreshSession } from "@/lib/server/session";

async function resolveAccessToken(request: NextRequest): Promise<string | undefined> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (isTokenFresh(accessToken)) return accessToken;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return undefined;
  const rotated = await refreshSession(refreshToken, clientContextHeaders(request));
  return rotated?.accessToken;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json(errorBody(403, "Forbidden", "Yêu cầu không hợp lệ"), { status: 403 });
  }

  const accessToken = await resolveAccessToken(request);
  if (accessToken) {
    await backendFetch("/auth/logout", { method: "POST", accessToken, headers: clientContextHeaders(request) }).catch(
      () => null,
    );
  }

  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  clearSessionCookies(response);
  return response;
}

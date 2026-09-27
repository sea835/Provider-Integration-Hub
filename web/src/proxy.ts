import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH, LOGIN_PATH, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";
import { isSafeRedirect } from "@/lib/utils";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(REFRESH_TOKEN_COOKIE);
  const onLoginPage = pathname === LOGIN_PATH;

  if (!hasSession && !onLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    if (pathname !== HOME_PATH) url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && onLoginPage) {
    const next = request.nextUrl.searchParams.get("next");
    return NextResponse.redirect(new URL(isSafeRedirect(next) ? next : HOME_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)",
  ],
};

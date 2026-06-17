import { NextResponse, type NextRequest } from "next/server";

function localeFromPath(pathname: string) {
  const segment = pathname.split("/")[1];
  return segment === "en" ? "en" : "ko";
}

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-app-locale", localeFromPath(request.nextUrl.pathname));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|og-image.png|robots.txt|manifest.json).*)"],
};

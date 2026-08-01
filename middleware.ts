import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth", "/api/diag"];

/**
 * Protected-route middleware: refreshes the Supabase session cookie and
 * redirects unauthenticated visitors to /login. Account-state gating and
 * permission checks happen server-side in layouts/services — middleware
 * only guarantees "no session, no app".
 */
export async function middleware(request: NextRequest) {
  // Normalize duplicate slashes (e.g. "//auth/confirm" from an APP_URL
  // configured with a trailing slash). Without this, path checks below
  // misclassify the auth callback and bounce recovery links to /login,
  // losing the one-time code (live incident, 2026-07-31). Query params
  // are preserved; fragments survive client-side.
  if (/\/{2,}/.test(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.pathname.replace(/\/{2,}/g, "/");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // Misconfiguration: fail closed for app pages.
    return request.nextUrl.pathname === "/login"
      ? response
      : NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() validates the token with the auth server — required, do not
  // trust getSession() contents in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  // /set-password requires the session minted by the confirm link.
  const isSetPassword = path === "/set-password";

  if (!user && !isPublic && !isSetPassword) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  if (user && (path === "/login" || path === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!user && path === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

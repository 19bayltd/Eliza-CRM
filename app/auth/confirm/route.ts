import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Auth confirmation endpoint (invitation / password recovery).
 *
 * Scanner-proof design (Supabase docs, "Email prefetching" limitation):
 * mail providers (Gmail, Outlook SafeLinks) prefetch GET links and would
 * consume a one-time token before the user's real click. Therefore:
 *
 *  - GET never consumes credentials. It forwards upstream error codes,
 *    and otherwise redirects to /auth/continue, an interstitial page with
 *    a button. Scanners follow GETs but do not submit forms.
 *  - POST (from the interstitial form) performs the actual exchange —
 *    verifyOtp for token_hash links (documented SSR pattern) or
 *    exchangeCodeForSession for PKCE codes — establishing the session
 *    server-side, then forwards to `next`.
 *
 * Only relative in-app paths are accepted as redirect targets.
 */

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/set-password";
}

function loginError(origin: string, reason: string): NextResponse {
  const url = new URL("/login", origin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const upstreamErrorCode = searchParams.get("error_code");
  const next = safeNext(searchParams.get("next"));

  // GoTrue redirected here with an error (e.g. otp_expired) instead of a
  // credential — surface the code (never a token) to the login page.
  if (upstreamErrorCode) {
    return loginError(origin, upstreamErrorCode);
  }

  if ((tokenHash && type) || code) {
    const url = new URL("/auth/continue", origin);
    if (tokenHash) url.searchParams.set("token_hash", tokenHash);
    if (type) url.searchParams.set("type", type);
    if (code) url.searchParams.set("code", code);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  return loginError(origin, "invalid_link");
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "");
  const code = String(form.get("code") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));

  const supabase = await createServerSupabase();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(next, origin), 303);
    return loginError(origin, error.code ?? "otp_expired");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin), 303);
    return loginError(origin, error.code ?? "code_exchange_failed");
  }

  return loginError(origin, "invalid_link");
}

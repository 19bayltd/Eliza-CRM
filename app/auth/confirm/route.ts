import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Auth confirmation endpoint (invitation / password recovery), following
 * the documented Supabase SSR pattern: the email template links here with
 * token_hash + type, and verifyOtp establishes the session server-side
 * (cookies set on the response) before forwarding to the next step.
 * Also handles the PKCE ?code= form, and forwards GoTrue's non-secret
 * error codes so the login page can explain what happened.
 * Only relative in-app paths are accepted as redirect targets.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const upstreamErrorCode = searchParams.get("error_code");
  const rawNext = searchParams.get("next") ?? "/set-password";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/set-password";

  const loginError = (reason: string): NextResponse => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", reason);
    return NextResponse.redirect(url);
  };

  // GoTrue redirected here with an error (e.g. otp_expired) instead of a
  // token — surface the code (never a token) to the login page.
  if (upstreamErrorCode) {
    return loginError(upstreamErrorCode);
  }

  const supabase = await createServerSupabase();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return loginError(error.code ?? "otp_expired");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return loginError(error.code ?? "code_exchange_failed");
  }

  return loginError("invalid_link");
}

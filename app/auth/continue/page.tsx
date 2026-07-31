import { createHash } from "node:crypto";
import { redirect } from "next/navigation";

/**
 * Interstitial confirmation page (scanner-proofing). Email links land here
 * via GET without consuming their one-time credential; the button submits
 * a POST to /auth/confirm, which performs the actual verification. Mail
 * scanners prefetch GETs but never submit forms, so the credential
 * survives until the human clicks.
 */
export default async function AuthContinuePage(props: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    code?: string;
    next?: string;
  }>;
}) {
  const params = await props.searchParams;
  const hasCredential = Boolean((params.token_hash && params.type) || params.code);
  // TEMPORARY DIAGNOSTICS: fingerprint only (secondary sha256, 12 hex
  // chars) — the raw token_hash is never logged.
  console.log(
    JSON.stringify({
      diag: "auth_continue_render",
      token_hash_len: params.token_hash?.length ?? 0,
      token_hash_fp: params.token_hash
        ? createHash("sha256").update(params.token_hash).digest("hex").slice(0, 12)
        : null,
      type: params.type ?? null,
      has_code: Boolean(params.code),
    }),
  );
  if (!hasCredential) redirect("/login?error=invalid_link");

  const rawNext = params.next ?? "/set-password";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/set-password";

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1>Continue to Eliza OS</h1>
        <p className="muted">
          For your security, confirm that you want to continue. This link can
          only be used once.
        </p>
        <form method="POST" action="/auth/confirm" className="stack">
          {params.token_hash && (
            <input type="hidden" name="token_hash" value={params.token_hash} />
          )}
          {params.type && <input type="hidden" name="type" value={params.type} />}
          {params.code && <input type="hidden" name="code" value={params.code} />}
          <input type="hidden" name="next" value={next} />
          <div>
            <button type="submit">Continue</button>
          </div>
        </form>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { signInAction } from "@/server/actions/auth";

const LINK_ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "That link is invalid. Request a new one below.",
  otp_expired:
    "That email link has expired or was already used. Request a fresh one via “Forgot password”.",
  access_denied:
    "That email link could not be verified. Request a fresh one via “Forgot password”.",
  code_exchange_failed:
    "Sign-in could not be completed from that link. Request a fresh one via “Forgot password”.",
};

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await props.searchParams;
  const linkMessage = error
    ? (LINK_ERROR_MESSAGES[error] ??
      "That link could not be processed. Request a new one below.")
    : null;

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1>Eliza OS</h1>
        <p className="muted">Sign in with your account</p>
        {linkMessage && (
          <p className="msg-error" role="alert">
            {linkMessage}
          </p>
        )}
        <ActionForm action={signInAction} submitLabel="Sign in">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        </ActionForm>
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}

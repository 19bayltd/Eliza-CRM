import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { signInAction } from "@/server/actions/auth";

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1>Eliza OS</h1>
        <p className="muted">Sign in with your account</p>
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

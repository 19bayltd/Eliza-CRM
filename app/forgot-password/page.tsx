import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { forgotPasswordAction } from "@/server/actions/auth";

export default function ForgotPasswordPage() {
  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1>Reset password</h1>
        <p className="muted">
          Enter your email. If an account exists, a reset link will be sent.
        </p>
        <ActionForm
          action={forgotPasswordAction}
          submitLabel="Send reset link"
          successMessage="If an account exists for that email, a reset link is on its way."
        >
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
        </ActionForm>
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

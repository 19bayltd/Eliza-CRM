import { ActionForm } from "@/components/action-form";
import { setPasswordAction } from "@/server/actions/auth";

export default function SetPasswordPage() {
  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1>Set your password</h1>
        <p className="muted">
          Choose a password of at least 12 characters to finish setting up
          your account.
        </p>
        <ActionForm action={setPasswordAction} submitLabel="Save password">
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
        </ActionForm>
      </div>
    </div>
  );
}

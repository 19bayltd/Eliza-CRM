"use server";

import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { writeAudit } from "@/server/audit";
import { type ActionResult } from "@/server/errors";
import {
  forgotPasswordSchema,
  setPasswordSchema,
  signInSchema,
} from "@/server/validation/auth";

const BLOCKED_STATUS_MESSAGES: Record<string, string> = {
  invited: "Please finish setting up your account from the invitation email.",
  suspended: "Your account is suspended. Contact an administrator.",
  locked: "Your account is locked. Contact an administrator.",
  disabled: "Your account is disabled. Contact an administrator.",
  exited: "This account is no longer active.",
};

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    await writeAudit(
      {
        module: "auth",
        action: "user.login_failed",
        actorEmail: parsed.data.email,
        result: "failure",
        failureReason: "invalid_credentials",
      },
      { critical: false },
    );
    return { ok: false, code: "unauthenticated", message: "Invalid email or password" };
  }

  // Account-state gate: any non-active state signs the session back out.
  const admin = createAdminSupabase();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("account_status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || profile.account_status !== "active") {
    await supabase.auth.signOut();
    const status = profile?.account_status ?? "unknown";
    await writeAudit(
      {
        module: "auth",
        action: "user.login_blocked",
        actorUserId: data.user.id,
        actorEmail: parsed.data.email,
        result: "failure",
        failureReason: `account_${status}`,
      },
      { critical: false },
    );
    return {
      ok: false,
      code: "account_inactive",
      message: BLOCKED_STATUS_MESSAGES[status] ?? "Account is not active.",
    };
  }

  await writeAudit(
    {
      module: "auth",
      action: "user.login_succeeded",
      actorUserId: data.user.id,
      actorEmail: parsed.data.email,
    },
    { critical: false },
  );
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) {
    await writeAudit(
      {
        module: "auth",
        action: "user.signed_out",
        actorUserId: user.id,
        actorEmail: user.email ?? null,
      },
      { critical: false },
    );
  }
  redirect("/login");
}

export async function forgotPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const env = publicEnv();
  const supabase = await createServerSupabase();
  // The user always gets the same response whether or not the email exists
  // (no account enumeration) — but the AUDIT record must tell the truth:
  // acceptance by the Auth API is recorded as a handoff status, never as
  // proof of delivery, and provider errors are recorded as failures.
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/set-password`,
    },
  );
  await writeAudit(
    {
      module: "auth",
      action: "user.password_reset_requested",
      actorEmail: parsed.data.email,
      result: error ? "failure" : "success",
      failureReason: error
        ? `auth_api_error:${error.code ?? error.status ?? "unknown"}`
        : null,
      newValue: {
        provider_handoff: error ? "rejected_by_auth_api" : "accepted_by_auth_api",
        delivery_confirmed: false,
      },
    },
    { critical: false },
  );
  return { ok: true, data: undefined };
}

export async function setPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      code: "unauthenticated",
      message: "Your link has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Password could not be set. Choose a different password.",
    };
  }

  // First-time setup: invited → active.
  const admin = createAdminSupabase();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.account_status === "invited") {
    await admin
      .from("user_profiles")
      .update({ account_status: "active", updated_by: user.id })
      .eq("id", user.id);
    await writeAudit({
      module: "auth",
      action: "user.activated",
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      entityType: "user",
      entityId: user.id,
      previousValue: { account_status: "invited" },
      newValue: { account_status: "active" },
    });
  } else {
    await writeAudit(
      {
        module: "auth",
        action: "user.password_changed",
        actorUserId: user.id,
        actorEmail: user.email ?? null,
      },
      { critical: false },
    );
  }
  redirect("/dashboard");
}

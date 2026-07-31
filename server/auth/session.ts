import "server-only";

import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { accountInactive, unauthenticated } from "@/server/errors";
import type { Tables } from "@/types/database";

export type UserProfile = Tables<"user_profiles">;

export type SessionContext = {
  userId: string;
  email: string;
  profile: UserProfile;
};

/**
 * Server-side session verification. Uses getUser() (validates the JWT with
 * the auth server) — never trusts the cookie contents alone. Cached per
 * request.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return { userId: user.id, email: profile.email, profile };
});

/** Requires an authenticated user (any account state). */
export async function requireUser(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw unauthenticated();
  return session;
}

/**
 * Requires an authenticated user whose account is 'active'. Suspended,
 * locked, disabled, exited, and not-yet-activated accounts are rejected —
 * this is the application-layer gate; RLS enforces the same at the
 * database boundary and suspension also bans the auth user itself.
 */
export async function requireActiveUser(): Promise<SessionContext> {
  const session = await requireUser();
  if (session.profile.account_status !== "active") {
    throw accountInactive(
      `Account is ${session.profile.account_status}. Contact an administrator.`,
    );
  }
  return session;
}

import "server-only";

import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/session";
import { PERMISSIONS, getAccessContext, requirePermission } from "@/server/permissions";
import { evaluatePermission } from "@/server/permissions/evaluate";
import { writeAudit } from "@/server/audit";
import {
  conflict,
  forbidden,
  internal,
  invalidInput,
  notFound,
  ServiceError,
} from "@/server/errors";
import {
  assignRoleSchema,
  companyScopeSchema,
  invitationTargetSchema,
  inviteUserSchema,
  revokeRoleSchema,
  setAccountStatusSchema,
} from "@/server/validation/users";
import type { Enums, Tables } from "@/types/database";

type AccountStatus = Enums<"account_status">;

/** Controlled account-state machine (docs/modules/authentication). */
const ALLOWED_TRANSITIONS: Record<AccountStatus, readonly AccountStatus[]> = {
  invited: ["active", "disabled"],
  active: ["suspended", "locked", "disabled", "exited"],
  suspended: ["active", "disabled", "exited"],
  locked: ["active", "disabled"],
  disabled: ["active", "exited"],
  exited: [],
};

/** Ban duration used to hard-block token refresh for non-active accounts. */
const INDEFINITE_BAN = "876000h"; // ~100 years
const STATUSES_REQUIRING_BAN: readonly AccountStatus[] = [
  "suspended",
  "locked",
  "disabled",
  "exited",
];

export type UserListEntry = {
  profile: Tables<"user_profiles">;
  companyIds: string[];
  roles: { userRoleId: string; roleKey: string; roleName: string; companyId: string | null }[];
};

/**
 * Users visible to the caller: those sharing a company (in which the caller
 * holds users.view) plus not-yet-scoped invitees (visible to inviters so
 * they can finish setup). Owner-style global grants see everyone.
 */
export async function listUsers(): Promise<UserListEntry[]> {
  const ctx = await getAccessContext();
  const viewableCompanies = ctx.companyIds.filter(
    (companyId) =>
      evaluatePermission(ctx, { permission: PERMISSIONS.usersView, companyId }).allowed,
  );
  const hasGlobalView = ctx.roleGrants.some(
    (g) => g.companyId === null && g.permissions.includes(PERMISSIONS.usersView),
  );
  if (viewableCompanies.length === 0 && !hasGlobalView) {
    throw forbidden("Not permitted (missing_permission)");
  }

  const admin = createAdminSupabase();
  const [profiles, scopes, roles] = await Promise.all([
    admin.from("user_profiles").select("*").order("email"),
    admin.from("user_company_scopes").select("user_id, company_id"),
    admin
      .from("user_roles")
      .select("id, user_id, company_id, roles(key, name)"),
  ]);
  if (profiles.error || scopes.error || roles.error) throw internal();

  const scopesByUser = new Map<string, string[]>();
  for (const s of scopes.data) {
    const list = scopesByUser.get(s.user_id) ?? [];
    list.push(s.company_id);
    scopesByUser.set(s.user_id, list);
  }

  const visible = profiles.data.filter((p) => {
    if (hasGlobalView) return true;
    const userCompanies = scopesByUser.get(p.id) ?? [];
    if (userCompanies.length === 0) return true; // unscoped invitee
    return userCompanies.some((c) => viewableCompanies.includes(c));
  });

  return visible.map((profile) => ({
    profile,
    companyIds: scopesByUser.get(profile.id) ?? [],
    roles: roles.data
      .filter((r) => r.user_id === profile.id)
      .map((r) => ({
        userRoleId: r.id,
        roleKey: r.roles?.key ?? "?",
        roleName: r.roles?.name ?? "?",
        companyId: r.company_id,
      })),
  }));
}

export async function listRoles(): Promise<Tables<"roles">[]> {
  await requireActiveUser();
  const admin = createAdminSupabase();
  const { data, error } = await admin.from("roles").select("*").order("key");
  if (error) throw internal();
  return data;
}

/**
 * Invite a user: creates the auth user (Supabase sends the invitation
 * email), grants initial company scopes and role, audits. Requires
 * users.invite in every target company; role assignment additionally
 * requires users.role.assign.
 */
export async function inviteUser(
  input: z.input<typeof inviteUserSchema>,
): Promise<{ userId: string }> {
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const session = await requireActiveUser();
  for (const companyId of parsed.data.companyIds) {
    await requirePermission({ permission: PERMISSIONS.usersInvite, companyId });
    await requirePermission({ permission: PERMISSIONS.usersRoleAssign, companyId });
    await requirePermission({ permission: PERMISSIONS.usersScopeAssign, companyId });
  }

  const admin = createAdminSupabase();
  const { data: role } = await admin
    .from("roles")
    .select("id, key")
    .eq("key", parsed.data.roleKey)
    .maybeSingle();
  if (!role) throw invalidInput("Unknown role");
  // Owner-level access is never granted through invitation.
  if (role.key === "owner") throw forbidden("The owner role cannot be assigned via invitation");

  const env = publicEnv();
  const { data: created, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.fullName },
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    });
  if (inviteError || !created.user) {
    if (inviteError?.code === "email_exists") {
      throw conflict("A user with this email already exists");
    }
    throw internal("Invitation could not be sent");
  }
  const userId = created.user.id;

  const scopeRows = parsed.data.companyIds.map((companyId) => ({
    user_id: userId,
    company_id: companyId,
    created_by: session.userId,
  }));
  const roleRows = parsed.data.companyIds.map((companyId) => ({
    user_id: userId,
    role_id: role.id,
    company_id: companyId,
    created_by: session.userId,
  }));
  const [scopeRes, roleRes] = await Promise.all([
    admin.from("user_company_scopes").insert(scopeRows),
    admin.from("user_roles").insert(roleRows),
  ]);
  if (scopeRes.error || roleRes.error) throw internal("Invitation grants failed");

  await writeAudit({
    module: "auth",
    action: "user.invited",
    actorUserId: session.userId,
    actorEmail: session.email,
    entityType: "user",
    entityId: userId,
    newValue: {
      email: parsed.data.email,
      full_name: parsed.data.fullName,
      role: role.key,
      company_ids: parsed.data.companyIds,
    },
  });
  return { userId };
}

/**
 * Loads an invitation that is still pending (status `invited`, never
 * signed in) and verifies the caller may manage it: users.invite in every
 * company the invitee is scoped to, or a global users.invite grant when
 * the invitee has no scopes yet. Invite links are one-time and expire, so
 * pending invitations sometimes need to be re-sent or removed; both
 * operations are only ever valid before first sign-in.
 */
async function requirePendingInvitation(userId: string) {
  const session = await requireActiveUser();
  const admin = createAdminSupabase();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) throw notFound("User not found");
  if (profile.account_status !== "invited") {
    throw conflict(
      "Only accounts still in the invited state can be re-invited or removed",
    );
  }
  const { data: authUser, error: authError } =
    await admin.auth.admin.getUserById(userId);
  if (authError || !authUser.user) throw internal();
  if (authUser.user.last_sign_in_at) {
    throw conflict(
      "This user has already signed in; manage them via account status instead",
    );
  }

  const { data: scopeRows } = await admin
    .from("user_company_scopes")
    .select("company_id")
    .eq("user_id", userId);
  const companyIds = (scopeRows ?? []).map((s) => s.company_id);
  if (companyIds.length === 0) {
    const ctx = await getAccessContext();
    const hasGlobal = ctx.roleGrants.some(
      (g) => g.companyId === null && g.permissions.includes(PERMISSIONS.usersInvite),
    );
    if (!hasGlobal) throw forbidden("Not permitted (missing_permission)");
  } else {
    for (const companyId of companyIds) {
      await requirePermission({ permission: PERMISSIONS.usersInvite, companyId });
    }
  }

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("role_id, company_id, roles(key)")
    .eq("user_id", userId);

  return { session, admin, profile, companyIds, roleRows: roleRows ?? [] };
}

/**
 * Re-send a pending invitation. Supabase cannot re-issue an invite email
 * for an existing auth user, so the stale user is deleted and re-invited
 * with identical role and scope grants; the previous link stops working.
 */
export async function resendInvitation(
  input: z.input<typeof invitationTargetSchema>,
): Promise<{ userId: string }> {
  const parsed = invitationTargetSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { session, admin, profile, companyIds, roleRows } =
    await requirePendingInvitation(parsed.data.userId);

  const { error: deleteError } = await admin.auth.admin.deleteUser(profile.id);
  if (deleteError) throw internal("Invitation could not be re-sent");

  const env = publicEnv();
  const { data: created, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(profile.email, {
      data: { full_name: profile.full_name },
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    });
  if (inviteError || !created.user) {
    throw internal("The old invitation was removed but the new email failed; invite again");
  }
  const userId = created.user.id;

  const scopeRows = companyIds.map((companyId) => ({
    user_id: userId,
    company_id: companyId,
    created_by: session.userId,
  }));
  const newRoleRows = roleRows.map((r) => ({
    user_id: userId,
    role_id: r.role_id,
    company_id: r.company_id,
    created_by: session.userId,
  }));
  const [scopeRes, roleRes] = await Promise.all([
    scopeRows.length
      ? admin.from("user_company_scopes").insert(scopeRows)
      : Promise.resolve({ error: null }),
    newRoleRows.length
      ? admin.from("user_roles").insert(newRoleRows)
      : Promise.resolve({ error: null }),
  ]);
  if (scopeRes.error || roleRes.error) throw internal("Invitation grants failed");

  await writeAudit({
    module: "auth",
    action: "user.invitation_resent",
    actorUserId: session.userId,
    actorEmail: session.email,
    entityType: "user",
    entityId: userId,
    previousValue: { user_id: profile.id },
    newValue: {
      email: profile.email,
      full_name: profile.full_name,
      roles: roleRows.map((r) => ({ role: r.roles?.key, company_id: r.company_id })),
      company_ids: companyIds,
    },
  });
  return { userId };
}

/**
 * Remove a pending invitation entirely (auth user + cascaded profile,
 * roles, and scopes). Only valid before first sign-in — established
 * accounts must go through the account-status state machine instead.
 */
export async function deleteInvitation(
  input: z.input<typeof invitationTargetSchema>,
): Promise<void> {
  const parsed = invitationTargetSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { session, admin, profile, companyIds, roleRows } =
    await requirePendingInvitation(parsed.data.userId);

  const { error } = await admin.auth.admin.deleteUser(profile.id);
  if (error) throw internal("Invitation could not be deleted");

  await writeAudit({
    module: "auth",
    action: "user.invitation_deleted",
    actorUserId: session.userId,
    actorEmail: session.email,
    entityType: "user",
    entityId: profile.id,
    previousValue: {
      email: profile.email,
      full_name: profile.full_name,
      account_status: profile.account_status,
      roles: roleRows.map((r) => ({ role: r.roles?.key, company_id: r.company_id })),
      company_ids: companyIds,
    },
  });
}

/**
 * Controlled account-state transition. Non-active target states also ban
 * the auth user (blocks token refresh immediately); returning to active
 * lifts the ban. Cannot be applied to yourself.
 */
export async function setAccountStatus(
  input: z.input<typeof setAccountStatusSchema>,
): Promise<void> {
  const parsed = setAccountStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const session = await requireActiveUser();
  if (parsed.data.userId === session.userId) {
    throw forbidden("You cannot change your own account status");
  }

  const admin = createAdminSupabase();
  const { data: target } = await admin
    .from("user_profiles")
    .select("*")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  if (!target) throw notFound("User not found");

  // Authority: users.suspend in at least one company shared with the
  // target, or a global grant.
  const ctx = await getAccessContext();
  const { data: targetScopes } = await admin
    .from("user_company_scopes")
    .select("company_id")
    .eq("user_id", target.id);
  const shared = (targetScopes ?? [])
    .map((s) => s.company_id)
    .filter((c) => ctx.companyIds.includes(c));
  const hasGlobal = ctx.roleGrants.some(
    (g) => g.companyId === null && g.permissions.includes(PERMISSIONS.usersSuspend),
  );
  const hasScoped = shared.some(
    (companyId) =>
      evaluatePermission(ctx, { permission: PERMISSIONS.usersSuspend, companyId }).allowed,
  );
  if (!hasGlobal && !hasScoped) throw forbidden("Not permitted (missing_permission)");

  const from = target.account_status;
  const to = parsed.data.status;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ServiceError(
      "invalid_status_transition",
      `Cannot change status from ${from} to ${to}`,
    );
  }

  const { error: updateError } = await admin
    .from("user_profiles")
    .update({ account_status: to, updated_by: session.userId })
    .eq("id", target.id);
  if (updateError) throw internal();

  const { error: banError } = await admin.auth.admin.updateUserById(target.id, {
    ban_duration: STATUSES_REQUIRING_BAN.includes(to) ? INDEFINITE_BAN : "none",
  });
  if (banError) {
    // Roll the profile back rather than leave state and ban out of sync.
    await admin
      .from("user_profiles")
      .update({ account_status: from, updated_by: session.userId })
      .eq("id", target.id);
    throw internal("Account status change failed");
  }

  await writeAudit({
    module: "auth",
    action: `user.status_changed`,
    actorUserId: session.userId,
    actorEmail: session.email,
    entityType: "user",
    entityId: target.id,
    previousValue: { account_status: from },
    newValue: { account_status: to },
    reason: parsed.data.reason,
  });
}

export async function assignRole(
  input: z.input<typeof assignRoleSchema>,
): Promise<void> {
  const parsed = assignRoleSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const session = await requireActiveUser();
  const ctx = await getAccessContext();

  if (parsed.data.companyId) {
    await requirePermission({
      permission: PERMISSIONS.usersRoleAssign,
      companyId: parsed.data.companyId,
    });
  } else {
    // Global role grants require global authority (owner-level).
    const hasGlobal = ctx.roleGrants.some(
      (g) => g.companyId === null && g.permissions.includes(PERMISSIONS.usersRoleAssign),
    );
    if (!hasGlobal) throw forbidden("Global role grants require global authority");
  }

  const admin = createAdminSupabase();
  const { data: role } = await admin
    .from("roles")
    .select("id, key")
    .eq("key", parsed.data.roleKey)
    .maybeSingle();
  if (!role) throw invalidInput("Unknown role");
  if (role.key === "owner") {
    const callerIsGlobalOwner = ctx.roleGrants.some(
      (g) => g.companyId === null && g.permissions.includes(PERMISSIONS.usersRoleAssign),
    );
    if (!callerIsGlobalOwner) throw forbidden("Only global authority can assign the owner role");
  }

  const { data: target } = await admin
    .from("user_profiles")
    .select("id, email")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  if (!target) throw notFound("User not found");

  const { error } = await admin.from("user_roles").insert({
    user_id: target.id,
    role_id: role.id,
    company_id: parsed.data.companyId ?? null,
    created_by: session.userId,
  });
  if (error) {
    if (error.code === "23505") throw conflict("This role is already assigned");
    throw internal();
  }

  await writeAudit({
    module: "auth",
    action: "user.role_assigned",
    actorUserId: session.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId ?? null,
    entityType: "user",
    entityId: target.id,
    newValue: { role: role.key, company_id: parsed.data.companyId ?? null },
  });
}

export async function revokeRole(
  input: z.input<typeof revokeRoleSchema>,
): Promise<void> {
  const parsed = revokeRoleSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const session = await requireActiveUser();
  const ctx = await getAccessContext();
  const admin = createAdminSupabase();

  const { data: assignment } = await admin
    .from("user_roles")
    .select("id, user_id, company_id, roles(key)")
    .eq("id", parsed.data.userRoleId)
    .maybeSingle();
  if (!assignment) throw notFound("Role assignment not found");

  if (assignment.company_id) {
    await requirePermission({
      permission: PERMISSIONS.usersRoleAssign,
      companyId: assignment.company_id,
    });
  } else {
    const hasGlobal = ctx.roleGrants.some(
      (g) => g.companyId === null && g.permissions.includes(PERMISSIONS.usersRoleAssign),
    );
    if (!hasGlobal) throw forbidden("Global role grants require global authority");
  }
  if (assignment.user_id === session.userId && assignment.roles?.key === "owner") {
    throw forbidden("You cannot revoke your own owner role");
  }

  const { error } = await admin
    .from("user_roles")
    .delete()
    .eq("id", assignment.id);
  if (error) throw internal();

  await writeAudit({
    module: "auth",
    action: "user.role_revoked",
    actorUserId: session.userId,
    actorEmail: session.email,
    companyId: assignment.company_id,
    entityType: "user",
    entityId: assignment.user_id,
    previousValue: { role: assignment.roles?.key, company_id: assignment.company_id },
  });
}

export async function grantCompanyScope(
  input: z.input<typeof companyScopeSchema>,
): Promise<void> {
  const parsed = companyScopeSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const session = await requireActiveUser();
  await requirePermission({
    permission: PERMISSIONS.usersScopeAssign,
    companyId: parsed.data.companyId,
  });
  const admin = createAdminSupabase();
  const { error } = await admin.from("user_company_scopes").insert({
    user_id: parsed.data.userId,
    company_id: parsed.data.companyId,
    created_by: session.userId,
  });
  if (error) {
    if (error.code === "23505") throw conflict("Scope already granted");
    if (error.code === "23503") throw notFound("User or company not found");
    throw internal();
  }
  await writeAudit({
    module: "auth",
    action: "user.scope_granted",
    actorUserId: session.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "user",
    entityId: parsed.data.userId,
    newValue: { scope: "company", company_id: parsed.data.companyId },
  });
}

export async function revokeCompanyScope(
  input: z.input<typeof companyScopeSchema>,
): Promise<void> {
  const parsed = companyScopeSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const session = await requireActiveUser();
  await requirePermission({
    permission: PERMISSIONS.usersScopeAssign,
    companyId: parsed.data.companyId,
  });
  if (parsed.data.userId === session.userId) {
    throw forbidden("You cannot revoke your own company scope");
  }
  const admin = createAdminSupabase();
  const { error, count } = await admin
    .from("user_company_scopes")
    .delete({ count: "exact" })
    .eq("user_id", parsed.data.userId)
    .eq("company_id", parsed.data.companyId);
  if (error) throw internal();
  if (!count) throw notFound("Scope grant not found");

  await writeAudit({
    module: "auth",
    action: "user.scope_revoked",
    actorUserId: session.userId,
    actorEmail: session.email,
    companyId: parsed.data.companyId,
    entityType: "user",
    entityId: parsed.data.userId,
    previousValue: { scope: "company", company_id: parsed.data.companyId },
  });
}

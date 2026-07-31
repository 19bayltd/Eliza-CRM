#!/usr/bin/env node
/**
 * One-time owner bootstrap. Run by the OWNER against a project that has
 * migrations + company seed applied but no users yet:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/bootstrap-owner.mjs owner@example.com "Owner Name"
 *
 * Creates the auth user (email-confirmed, invited state), assigns the
 * global owner role, grants scope on every company, marks the account
 * active, writes audit events, and sends a password-recovery email so the
 * owner sets their own password. Idempotent: refuses to run if any owner
 * role assignment already exists.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [email, fullName] = process.argv.slice(2);

if (!url || !serviceKey || !email) {
  console.error(
    "Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/bootstrap-owner.mjs <email> [full name]",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: ownerRole, error: roleErr } = await admin
  .from("roles")
  .select("id, key")
  .eq("key", "owner")
  .single();
if (roleErr) throw new Error(`roles lookup failed: ${roleErr.message}`);

const { count: existingOwners, error: countErr } = await admin
  .from("user_roles")
  .select("id", { count: "exact", head: true })
  .eq("role_id", ownerRole.id);
if (countErr) throw new Error(`owner check failed: ${countErr.message}`);
if ((existingOwners ?? 0) > 0) {
  console.error("An owner already exists. Bootstrap refuses to run twice.");
  process.exit(1);
}

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: { full_name: fullName ?? "Owner" },
});
if (createErr) throw new Error(`user creation failed: ${createErr.message}`);
const userId = created.user.id;

const { data: companies, error: compErr } = await admin
  .from("companies")
  .select("id, code");
if (compErr) throw new Error(`companies lookup failed: ${compErr.message}`);

const { error: roleAssignErr } = await admin
  .from("user_roles")
  .insert({ user_id: userId, role_id: ownerRole.id, company_id: null });
if (roleAssignErr) throw new Error(`role assign failed: ${roleAssignErr.message}`);

if (companies.length > 0) {
  const { error: scopeErr } = await admin.from("user_company_scopes").insert(
    companies.map((c) => ({ user_id: userId, company_id: c.id })),
  );
  if (scopeErr) throw new Error(`scope grant failed: ${scopeErr.message}`);
}

const { error: activateErr } = await admin
  .from("user_profiles")
  .update({ account_status: "active" })
  .eq("id", userId);
if (activateErr) throw new Error(`activation failed: ${activateErr.message}`);

const { error: auditErr } = await admin.from("audit_log").insert({
  module: "auth",
  action: "user.bootstrap_owner",
  actor_user_id: userId,
  actor_email: email,
  entity_type: "user",
  entity_id: userId,
  new_value: {
    role: "owner",
    company_codes: companies.map((c) => c.code),
    account_status: "active",
  },
});
if (auditErr) throw new Error(`audit write failed: ${auditErr.message}`);

const { error: resetErr } = await admin.auth.resetPasswordForEmail(email);
if (resetErr) {
  console.warn(
    `Owner created, but the password email failed (${resetErr.message}). Use the dashboard to send a recovery link.`,
  );
} else {
  console.log("Password setup email sent.");
}

console.log(`Owner bootstrapped: ${email} (${userId})`);
console.log(`Scoped to companies: ${companies.map((c) => c.code).join(", ") || "none"}`);

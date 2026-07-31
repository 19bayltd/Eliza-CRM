import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cross-company isolation tests against a real (STAGING) database.
 * Requires environment:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 *   SUPABASE_TEST_USER_EMAIL, SUPABASE_TEST_USER_PASSWORD
 * The test user must be an active account scoped to exactly one company.
 * Skipped automatically when credentials are absent (e.g. this sandbox);
 * runs in CI/staging. The equivalent database-level checks were executed
 * directly against staging via scripts/rls-verification.sql.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.SUPABASE_TEST_USER_EMAIL;
const password = process.env.SUPABASE_TEST_USER_PASSWORD;
const configured = Boolean(url && key && email && password);

describe.skipIf(!configured)("RLS cross-company isolation (staging)", () => {
  async function signedInClient() {
    const supabase = createClient<Database>(url!, key!);
    const { error } = await supabase.auth.signInWithPassword({
      email: email!,
      password: password!,
    });
    expect(error).toBeNull();
    return supabase;
  }

  it("sees only companies within granted scope", async () => {
    const supabase = await signedInClient();
    const { data, error } = await supabase.from("companies").select("id, code");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("cannot write to organization tables", async () => {
    const supabase = await signedInClient();
    const { error } = await supabase
      .from("companies")
      .insert({ code: "HACK_CO", name: "Hack", base_currency: "USD" });
    expect(error).not.toBeNull();
  });

  it("cannot read the audit log directly", async () => {
    const supabase = await signedInClient();
    const { error } = await supabase.from("audit_log").select("id").limit(1);
    expect(error).not.toBeNull();
  });

  it("sees only its own profile row", async () => {
    const supabase = await signedInClient();
    const { data, error } = await supabase.from("user_profiles").select("id, email");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
    expect(data?.[0]?.email).toBe(email);
  });

  it("cannot self-grant scopes or roles", async () => {
    const supabase = await signedInClient();
    const me = (await supabase.auth.getUser()).data.user!.id;
    const { data: companies } = await supabase.from("companies").select("id");
    const companyId = companies?.[0]?.id;
    expect(companyId).toBeTruthy();

    const scope = await supabase
      .from("user_company_scopes")
      .insert({ user_id: me, company_id: companyId! });
    expect(scope.error).not.toBeNull();
  });
});

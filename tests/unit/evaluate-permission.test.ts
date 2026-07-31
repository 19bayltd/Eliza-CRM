import { describe, expect, it } from "vitest";
import {
  evaluatePermission,
  type AccessContext,
} from "@/server/permissions/evaluate";

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BRANCH_1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BRANCH_2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function ctx(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    userId: "user-1",
    accountStatus: "active",
    companyIds: [COMPANY_A],
    branchIds: [],
    warehouseIds: [],
    departmentIds: [],
    roleGrants: [
      { companyId: COMPANY_A, permissions: ["organization.branch.manage"] },
    ],
    ...overrides,
  };
}

describe("evaluatePermission", () => {
  it("allows a scoped permission in the granted company", () => {
    expect(
      evaluatePermission(ctx(), {
        permission: "organization.branch.manage",
        companyId: COMPANY_A,
      }),
    ).toEqual({ allowed: true });
  });

  it("denies without company scope even when the role would grant it", () => {
    const d = evaluatePermission(
      ctx({ roleGrants: [{ companyId: null, permissions: ["organization.branch.manage"] }], companyIds: [] }),
      { permission: "organization.branch.manage", companyId: COMPANY_A },
    );
    expect(d).toEqual({ allowed: false, reason: "no_company_scope" });
  });

  it("denies cross-company access (wrong company)", () => {
    const d = evaluatePermission(ctx(), {
      permission: "organization.branch.manage",
      companyId: COMPANY_B,
    });
    expect(d).toEqual({ allowed: false, reason: "no_company_scope" });
  });

  it("denies when the role is bound to a different company", () => {
    const d = evaluatePermission(
      ctx({
        companyIds: [COMPANY_A, COMPANY_B],
        roleGrants: [
          { companyId: COMPANY_B, permissions: ["organization.branch.manage"] },
        ],
      }),
      { permission: "organization.branch.manage", companyId: COMPANY_A },
    );
    expect(d).toEqual({ allowed: false, reason: "missing_permission" });
  });

  it("allows via a global role grant across scoped companies", () => {
    const d = evaluatePermission(
      ctx({
        companyIds: [COMPANY_A, COMPANY_B],
        roleGrants: [{ companyId: null, permissions: ["users.suspend"] }],
      }),
      { permission: "users.suspend", companyId: COMPANY_B },
    );
    expect(d).toEqual({ allowed: true });
  });

  it.each(["invited", "suspended", "locked", "disabled", "exited"] as const)(
    "denies %s accounts regardless of grants",
    (status) => {
      const d = evaluatePermission(ctx({ accountStatus: status }), {
        permission: "organization.branch.manage",
        companyId: COMPANY_A,
      });
      expect(d).toEqual({ allowed: false, reason: `account_${status}` });
    },
  );

  it("denies missing permission", () => {
    const d = evaluatePermission(ctx(), {
      permission: "users.suspend",
      companyId: COMPANY_A,
    });
    expect(d).toEqual({ allowed: false, reason: "missing_permission" });
  });

  it("requires a global grant when requireGlobalGrant is set", () => {
    const scoped = evaluatePermission(
      ctx({
        roleGrants: [
          { companyId: COMPANY_A, permissions: ["organization.company.create"] },
        ],
      }),
      { permission: "organization.company.create", requireGlobalGrant: true },
    );
    expect(scoped).toEqual({
      allowed: false,
      reason: "missing_global_permission",
    });

    const global = evaluatePermission(
      ctx({
        roleGrants: [
          { companyId: null, permissions: ["organization.company.create"] },
        ],
      }),
      { permission: "organization.company.create", requireGlobalGrant: true },
    );
    expect(global).toEqual({ allowed: true });
  });

  it("denies company-scoped checks without a company target", () => {
    const d = evaluatePermission(ctx(), {
      permission: "organization.branch.manage",
    });
    expect(d).toEqual({ allowed: false, reason: "missing_company_target" });
  });

  it("enforces branch scope only for branch-restricted users", () => {
    const unrestricted = evaluatePermission(ctx(), {
      permission: "organization.branch.manage",
      companyId: COMPANY_A,
      branchId: BRANCH_1,
    });
    expect(unrestricted).toEqual({ allowed: true });

    const restricted = evaluatePermission(ctx({ branchIds: [BRANCH_2] }), {
      permission: "organization.branch.manage",
      companyId: COMPANY_A,
      branchId: BRANCH_1,
    });
    expect(restricted).toEqual({ allowed: false, reason: "no_branch_scope" });

    const matching = evaluatePermission(ctx({ branchIds: [BRANCH_1] }), {
      permission: "organization.branch.manage",
      companyId: COMPANY_A,
      branchId: BRANCH_1,
    });
    expect(matching).toEqual({ allowed: true });
  });
});

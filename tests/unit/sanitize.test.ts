import { describe, expect, it } from "vitest";
import { sanitizeAuditValue } from "@/server/audit/sanitize";

describe("sanitizeAuditValue", () => {
  it("redacts sensitive keys at any depth", () => {
    const out = sanitizeAuditValue({
      email: "a@b.c",
      password: "hunter2",
      nested: {
        access_token: "tok",
        apiKey: "k",
        service_role_key: "srk",
        Authorization: "Bearer x",
        safe: "keep",
      },
    });
    expect(out).toEqual({
      email: "a@b.c",
      password: "[redacted]",
      nested: {
        access_token: "[redacted]",
        apiKey: "[redacted]",
        service_role_key: "[redacted]",
        Authorization: "[redacted]",
        safe: "keep",
      },
    });
  });

  it("passes through scalars and truncates long strings", () => {
    expect(sanitizeAuditValue(42)).toBe(42);
    expect(sanitizeAuditValue(true)).toBe(true);
    expect(sanitizeAuditValue(null)).toBe(null);
    const long = "x".repeat(3000);
    const out = sanitizeAuditValue(long);
    expect(typeof out).toBe("string");
    expect((out as string).length).toBeLessThan(2100);
    expect(out as string).toContain("[truncated]");
  });

  it("handles arrays and depth limits without throwing", () => {
    expect(sanitizeAuditValue([{ token: "t" }, "ok"])).toEqual([
      { token: "[redacted]" },
      "ok",
    ]);
    type Deep = { child?: Deep };
    const deep: Deep = {};
    let cursor = deep;
    for (let i = 0; i < 10; i++) {
      cursor.child = {};
      cursor = cursor.child;
    }
    expect(() => sanitizeAuditValue(deep)).not.toThrow();
  });
});

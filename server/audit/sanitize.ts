/**
 * Audit value sanitization — pure and unit-tested. Audit rows must never
 * contain passwords, tokens, secrets, or keys (docs/AUDIT_EVENT_CATALOG.md).
 */

const SENSITIVE_KEY_PATTERN =
  /password|passwd|token|secret|api[_-]?key|service[_-]?role|authorization|credential|private[_-]?key|session/i;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function sanitizeAuditValue(value: unknown, depth = 0): JsonValue {
  if (depth > 6) return "[truncated]";
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.length > 2000 ? `${value.slice(0, 2000)}…[truncated]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((v) => sanitizeAuditValue(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: { [key: string]: JsonValue } = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k)
        ? "[redacted]"
        : sanitizeAuditValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

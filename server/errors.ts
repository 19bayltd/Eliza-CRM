/**
 * Typed error hierarchy for server services. User-facing messages never
 * leak internals; codes let the UI and tests branch precisely.
 */

export type ServiceErrorCode =
  | "unauthenticated"
  | "account_inactive"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "invalid_status_transition"
  | "internal";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function unauthenticated(message = "Sign in required"): ServiceError {
  return new ServiceError("unauthenticated", message);
}

export function accountInactive(message = "Account is not active"): ServiceError {
  return new ServiceError("account_inactive", message);
}

export function forbidden(message = "Not permitted"): ServiceError {
  return new ServiceError("forbidden", message);
}

export function notFound(message = "Not found"): ServiceError {
  return new ServiceError("not_found", message);
}

export function invalidInput(message: string): ServiceError {
  return new ServiceError("invalid_input", message);
}

export function conflict(message: string): ServiceError {
  return new ServiceError("conflict", message);
}

export function internal(message = "Something went wrong"): ServiceError {
  return new ServiceError("internal", message);
}

/** Safe shape for returning errors to the UI from server actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ServiceErrorCode; message: string };

export function toActionError(err: unknown): ActionResult<never> {
  if (err instanceof ServiceError) {
    return { ok: false, code: err.code, message: err.message };
  }
  return { ok: false, code: "internal", message: "Something went wrong" };
}

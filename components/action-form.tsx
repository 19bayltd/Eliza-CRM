"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/server/errors";

type ServerAction = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

/**
 * Generic form wrapper for server actions: pending state, error display,
 * optional success message, optional confirmation for destructive actions.
 */
export function ActionForm(props: {
  action: ServerAction;
  submitLabel: string;
  children?: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  successMessage?: string;
  buttonClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(props.action, null);

  return (
    <form
      action={formAction}
      className={props.className ?? "stack"}
      onSubmit={(e) => {
        if (props.confirmMessage && !window.confirm(props.confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {props.children}
      <div>
        <button
          type="submit"
          disabled={pending}
          className={props.buttonClassName}
          aria-busy={pending}
        >
          {pending ? "Working…" : props.submitLabel}
        </button>
      </div>
      {state && !state.ok && (
        <p className="msg-error" role="alert">
          {state.message}
        </p>
      )}
      {state?.ok && props.successMessage && (
        <p className="msg-success" role="status">
          {props.successMessage}
        </p>
      )}
    </form>
  );
}

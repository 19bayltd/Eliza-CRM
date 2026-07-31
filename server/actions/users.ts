"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/errors";
import {
  assignRole,
  grantCompanyScope,
  inviteUser,
  revokeCompanyScope,
  revokeRole,
  setAccountStatus,
} from "@/server/services/users";

const ADMIN_USERS_PATH = "/admin/users";

export async function inviteUserAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await inviteUser({
      email: String(formData.get("email") ?? ""),
      fullName: String(formData.get("fullName") ?? ""),
      roleKey: String(formData.get("roleKey") ?? ""),
      companyIds: formData.getAll("companyIds").map(String),
    });
    revalidatePath(ADMIN_USERS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setAccountStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await setAccountStatus({
      userId: String(formData.get("userId") ?? ""),
      status: String(formData.get("status") ?? "") as
        | "active"
        | "suspended"
        | "locked"
        | "disabled"
        | "exited",
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath(ADMIN_USERS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function assignRoleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const companyId = String(formData.get("companyId") ?? "");
    await assignRole({
      userId: String(formData.get("userId") ?? ""),
      roleKey: String(formData.get("roleKey") ?? ""),
      companyId: companyId || undefined,
    });
    revalidatePath(ADMIN_USERS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function revokeRoleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await revokeRole({ userRoleId: String(formData.get("userRoleId") ?? "") });
    revalidatePath(ADMIN_USERS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function grantCompanyScopeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await grantCompanyScope({
      userId: String(formData.get("userId") ?? ""),
      companyId: String(formData.get("companyId") ?? ""),
    });
    revalidatePath(ADMIN_USERS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function revokeCompanyScopeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await revokeCompanyScope({
      userId: String(formData.get("userId") ?? ""),
      companyId: String(formData.get("companyId") ?? ""),
    });
    revalidatePath(ADMIN_USERS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

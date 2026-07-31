"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/errors";
import {
  archiveOrgEntity,
  createBranch,
  createCompany,
  createDepartment,
  createWarehouse,
  updateCompany,
} from "@/server/services/organization";

const ADMIN_ORG_PATH = "/admin/organization";

export async function createCompanyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createCompany({
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      baseCurrency: String(formData.get("baseCurrency") ?? ""),
      timezone: String(formData.get("timezone") ?? "Asia/Dhaka"),
    });
    revalidatePath(ADMIN_ORG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateCompanyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await updateCompany({
      companyId: String(formData.get("companyId") ?? ""),
      name: String(formData.get("name") ?? ""),
      baseCurrency: String(formData.get("baseCurrency") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
    });
    revalidatePath(ADMIN_ORG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createBranchAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await createBranch({
      companyId: String(formData.get("companyId") ?? ""),
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath(ADMIN_ORG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createWarehouseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const branchId = String(formData.get("branchId") ?? "");
    await createWarehouse({
      companyId: String(formData.get("companyId") ?? ""),
      branchId: branchId || undefined,
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath(ADMIN_ORG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function createDepartmentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const branchId = String(formData.get("branchId") ?? "");
    await createDepartment({
      companyId: String(formData.get("companyId") ?? ""),
      branchId: branchId || undefined,
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath(ADMIN_ORG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveEntityAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const kind = String(formData.get("kind") ?? "");
    if (!["company", "branch", "warehouse", "department"].includes(kind)) {
      return { ok: false, code: "invalid_input", message: "Invalid entity" };
    }
    await archiveOrgEntity(kind as "company" | "branch" | "warehouse" | "department", {
      id: String(formData.get("id") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath(ADMIN_ORG_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

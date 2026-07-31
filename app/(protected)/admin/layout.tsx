import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessContext, PERMISSIONS } from "@/server/permissions";

const ADMIN_PERMISSIONS: string[] = [
  PERMISSIONS.companyCreate,
  PERMISSIONS.branchManage,
  PERMISSIONS.warehouseManage,
  PERMISSIONS.departmentManage,
  PERMISSIONS.usersView,
  PERMISSIONS.auditView,
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAccessContext();
  const grants = ctx.roleGrants.flatMap((g) => g.permissions);
  if (!grants.some((p) => ADMIN_PERMISSIONS.includes(p))) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1>Administration</h1>
      <nav aria-label="Administration sections" style={{ marginBottom: "1rem" }}>
        <span className="badge">
          <Link href="/admin/organization">Organization</Link>
        </span>
        {grants.includes(PERMISSIONS.usersView) && (
          <span className="badge">
            <Link href="/admin/users">Users</Link>
          </span>
        )}
        {grants.includes(PERMISSIONS.auditView) && (
          <span className="badge">
            <Link href="/admin/audit">Audit log</Link>
          </span>
        )}
      </nav>
      {children}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { getAccessContext, PERMISSIONS } from "@/server/permissions";
import { signOutAction } from "@/server/actions/auth";

const ADMIN_PERMISSIONS: string[] = [
  PERMISSIONS.companyCreate,
  PERMISSIONS.branchManage,
  PERMISSIONS.warehouseManage,
  PERMISSIONS.departmentManage,
  PERMISSIONS.usersView,
  PERMISSIONS.auditView,
];

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Account-state gate: non-active accounts see only a blocked screen.
  if (session.profile.account_status !== "active") {
    return (
      <div className="auth-shell">
        <div className="card auth-card">
          <h1>Access blocked</h1>
          <p>
            Your account is <strong>{session.profile.account_status}</strong>.
            Contact an administrator if you believe this is a mistake.
          </p>
          <form action={signOutAction}>
            <button type="submit" className="secondary">
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  const ctx = await getAccessContext();
  const showAdmin = ctx.roleGrants.some((g) =>
    g.permissions.some((p) => ADMIN_PERMISSIONS.includes(p)),
  );
  const showProducts = ctx.roleGrants.some((g) =>
    g.permissions.includes(PERMISSIONS.productsView),
  );
  const showSuppliers = ctx.roleGrants.some((g) =>
    g.permissions.includes(PERMISSIONS.suppliersView),
  );

  return (
    <div>
      <header className="topbar">
        <span className="brand">Eliza OS</span>
        <nav aria-label="Main navigation">
          <Link href="/dashboard">Dashboard</Link>
          {showProducts && <Link href="/products">Products</Link>}
          {showSuppliers && <Link href="/suppliers">Suppliers</Link>}
          {showAdmin && <Link href="/admin/organization">Administration</Link>}
        </nav>
        <span className="spacer" />
        <span className="who">{session.email}</span>
        <form action={signOutAction}>
          <button type="submit" className="secondary">
            Sign out
          </button>
        </form>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}

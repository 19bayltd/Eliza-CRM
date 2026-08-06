import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessContext, PERMISSIONS } from "@/server/permissions";

export default async function SuppliersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAccessContext();
  const grants = ctx.roleGrants.flatMap((g) => g.permissions);
  if (!grants.includes(PERMISSIONS.suppliersView)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1>Suppliers</h1>
      <nav aria-label="Supplier sections" style={{ marginBottom: "1rem" }}>
        <span className="badge">
          <Link href="/suppliers">Suppliers</Link>
        </span>
        {grants.includes(PERMISSIONS.suppliersQuotationCostView) && (
          <span className="badge">
            <Link href="/suppliers/compare">Compare quotations</Link>
          </span>
        )}
      </nav>
      {children}
    </div>
  );
}

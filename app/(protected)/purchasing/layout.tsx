import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessContext, PERMISSIONS } from "@/server/permissions";

export default async function PurchasingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAccessContext();
  const grants = ctx.roleGrants.flatMap((g) => g.permissions);
  if (!grants.includes(PERMISSIONS.purchasingRequestView)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1>Purchasing</h1>
      <nav aria-label="Purchasing sections" style={{ marginBottom: "1rem" }}>
        <span className="badge">
          <Link href="/purchasing">Requests</Link>
        </span>
        {grants.includes(PERMISSIONS.purchasingOrderView) && (
          <span className="badge">
            <Link href="/purchasing/orders">Purchase orders</Link>
          </span>
        )}
        {grants.includes(PERMISSIONS.purchasingSampleView) && (
          <span className="badge">
            <Link href="/purchasing/samples">Samples</Link>
          </span>
        )}
      </nav>
      {children}
    </div>
  );
}

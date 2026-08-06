import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessContext, PERMISSIONS } from "@/server/permissions";

export default async function InventoryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAccessContext();
  const grants = ctx.roleGrants.flatMap((g) => g.permissions);
  if (!grants.includes(PERMISSIONS.inventoryView)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1>Inventory</h1>
      <nav aria-label="Inventory sections" style={{ marginBottom: "1rem" }}>
        <span className="badge">
          <Link href="/inventory">Stock</Link>
        </span>
        <span className="badge">
          <Link href="/inventory/ledger">Movement history</Link>
        </span>
        {grants.includes(PERMISSIONS.inventoryTransferManage) && (
          <span className="badge">
            <Link href="/inventory/transfers">Transfers</Link>
          </span>
        )}
        {grants.includes(PERMISSIONS.inventoryAdjustmentManage) && (
          <span className="badge">
            <Link href="/inventory/adjustments">Adjustments</Link>
          </span>
        )}
        {grants.includes(PERMISSIONS.inventoryCountManage) && (
          <span className="badge">
            <Link href="/inventory/counts">Stock counts</Link>
          </span>
        )}
      </nav>
      {children}
    </div>
  );
}

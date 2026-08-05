import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessContext, PERMISSIONS } from "@/server/permissions";

export default async function ProductsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAccessContext();
  const grants = ctx.roleGrants.flatMap((g) => g.permissions);
  if (!grants.includes(PERMISSIONS.productsView)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1>Products</h1>
      <nav aria-label="Product sections" style={{ marginBottom: "1rem" }}>
        <span className="badge">
          <Link href="/products">Products</Link>
        </span>
        {grants.includes(PERMISSIONS.productsCatalogManage) && (
          <span className="badge">
            <Link href="/products/catalog">Catalog</Link>
          </span>
        )}
        {grants.includes(PERMISSIONS.productsImport) && (
          <span className="badge">
            <Link href="/products/import">Import</Link>
          </span>
        )}
      </nav>
      {children}
    </div>
  );
}

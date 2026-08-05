import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createProductAction } from "@/server/actions/products";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listCompanies } from "@/server/services/organization";
import { listCatalog } from "@/server/services/catalog";
import { listProducts } from "@/server/services/products";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const companies = await listCompanies();

  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.productsView,
      companyId: company.id,
    });
    if (!canView) continue;
    const [products, catalog, canCreate] = await Promise.all([
      listProducts(company.id),
      listCatalog(company.id),
      hasPermission({
        permission: PERMISSIONS.productsCreate,
        companyId: company.id,
      }),
    ]);
    sections.push({ company, products, catalog, canCreate });
  }

  if (sections.length === 0) {
    return <p className="empty">No companies in your product scope.</p>;
  }

  return (
    <div>
      {sections.map(({ company, products, catalog, canCreate }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>

          {products.length === 0 ? (
            <p className="empty">No products yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">SKU</th>
                    <th scope="col">Name</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col">Variants</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/products/${p.id}`}>{p.sku}</Link>
                      </td>
                      <td>{p.name}</td>
                      <td>
                        {catalog.categories.find((c) => c.id === p.category_id)
                          ?.name ?? "—"}
                      </td>
                      <td>
                        <span className={`badge status-${p.status}`}>{p.status}</span>
                      </td>
                      <td>{p.variantCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canCreate && (
            <details style={{ marginTop: "1rem" }}>
              <summary>New product</summary>
              <ActionForm
                action={createProductAction}
                submitLabel="Create product"
                successMessage="Product created (status: draft)."
                className="stack"
              >
                <input type="hidden" name="companyId" value={company.id} />
                <div className="row">
                  <label>
                    SKU
                    <input
                      name="sku"
                      required
                      placeholder="ELS-TSH-0001"
                      style={{ textTransform: "uppercase" }}
                    />
                  </label>
                  <label>
                    Name
                    <input name="name" required maxLength={200} />
                  </label>
                </div>
                <div className="row">
                  <label>
                    Category
                    <select name="categoryId" defaultValue="">
                      <option value="">—</option>
                      {catalog.categories
                        .filter((c) => c.status === "active")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Unit
                    <select name="unitId" defaultValue="">
                      <option value="">—</option>
                      {catalog.units
                        .filter((u) => u.status === "active")
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.code})
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <label>
                  Description
                  <textarea name="description" rows={2} maxLength={5000} />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

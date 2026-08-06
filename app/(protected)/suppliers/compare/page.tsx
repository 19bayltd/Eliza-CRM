import Link from "next/link";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listCompanies } from "@/server/services/organization";
import { listProducts } from "@/server/services/products";
import { compareQuotations } from "@/server/services/quotations";

export const dynamic = "force-dynamic";

/**
 * Side-by-side quotation comparison for one product, prices normalized
 * to the company base currency via each quote's captured exchange rate.
 * Restricted to quotation-cost holders (layout links it conditionally;
 * the services enforce regardless).
 */
export default async function CompareQuotationsPage(props: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productId } = await props.searchParams;

  const companies = await listCompanies();
  const productsByCompany = [];
  for (const company of companies) {
    const canCosts = await hasPermission({
      permission: PERMISSIONS.suppliersQuotationCostView,
      companyId: company.id,
    });
    if (!canCosts) continue;
    // A role holding cost.view without products.view degrades to an
    // empty product list rather than crashing the page.
    let products: Awaited<ReturnType<typeof listProducts>> = [];
    try {
      products = await listProducts(company.id);
    } catch (err) {
      if (!(err instanceof ServiceError && err.code === "forbidden")) throw err;
    }
    productsByCompany.push({ company, products });
  }

  if (productsByCompany.length === 0) {
    return (
      <p className="empty">
        Quotation comparison requires the quotation-cost permission.
      </p>
    );
  }

  // Bad or foreign product ids render a notice, never a server crash.
  let comparison: Awaited<ReturnType<typeof compareQuotations>> | null = null;
  let comparisonError: string | null = null;
  if (productId) {
    try {
      comparison = await compareQuotations(productId);
    } catch (err) {
      if (err instanceof ServiceError) {
        comparisonError =
          err.code === "forbidden"
            ? "You do not have quotation access in that product's company."
            : "That product could not be found.";
      } else {
        throw err;
      }
    }
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Pick a product</h2>
        {productsByCompany.map(({ company, products }) => (
          <div key={company.id}>
            <h3>
              {company.name} <span className="badge">{company.code}</span>
            </h3>
            {products.length === 0 ? (
              <p className="empty">No products.</p>
            ) : (
              <ul>
                {products.map((p) => (
                  <li key={p.id}>
                    <Link href={`/suppliers/compare?product=${p.id}`}>
                      {p.sku} — {p.name}
                    </Link>{" "}
                    <span className={`badge status-${p.status}`}>{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {comparisonError && <p className="msg-error">{comparisonError}</p>}

      {comparison && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>
            Quotations for <span className="badge">{comparison.productSku}</span>
          </h2>
          {comparison.entries.length === 0 ? (
            <p className="empty">No quotations for this product yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Supplier</th>
                    <th scope="col">Variant</th>
                    <th scope="col">Quoted price</th>
                    <th scope="col">Normalized</th>
                    <th scope="col">MOQ</th>
                    <th scope="col">Lead (days)</th>
                    <th scope="col">Valid until</th>
                    <th scope="col">Terms</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.entries.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <Link href={`/suppliers/${q.supplier_id}`}>
                          {q.supplierCode}
                        </Link>{" "}
                        {q.supplierName}
                      </td>
                      <td>{q.variantSku ?? "—"}</td>
                      <td>
                        {q.cost ? `${q.cost.unitPrice} ${q.cost.currency}` : "•••"}
                      </td>
                      <td>
                        {q.cost
                          ? `${q.cost.normalized} ${q.cost.baseCurrency}`
                          : "•••"}
                      </td>
                      <td>{q.moq ?? "—"}</td>
                      <td>{q.lead_time_days ?? "—"}</td>
                      <td>{q.valid_until ?? "—"}</td>
                      <td>{q.terms ?? "—"}</td>
                      <td>
                        <span className={`badge status-${q.status}`}>{q.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

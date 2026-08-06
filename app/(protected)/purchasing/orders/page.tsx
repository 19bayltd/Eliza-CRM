import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createOrderAction } from "@/server/actions/purchasing";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listCompanies } from "@/server/services/organization";
import { listOrders } from "@/server/services/purchase-orders";
import { listRequests } from "@/server/services/purchase-requests";
import { listSuppliers } from "@/server/services/suppliers";

export const dynamic = "force-dynamic";

/**
 * Purchase orders per company. Creating one requires both order.manage
 * and cost.view — you cannot commit money you are not allowed to see —
 * so the form only renders for holders of both.
 */
export default async function PurchaseOrdersPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.purchasingOrderView,
      companyId: company.id,
    });
    if (!canView) continue;

    const [orders, canManage, canCosts] = await Promise.all([
      listOrders(company.id),
      hasPermission({
        permission: PERMISSIONS.purchasingOrderManage,
        companyId: company.id,
      }),
      hasPermission({
        permission: PERMISSIONS.purchasingCostView,
        companyId: company.id,
      }),
    ]);

    const canCreate = canManage && canCosts;
    const [suppliers, requests] = canCreate
      ? await Promise.all([listSuppliers(company.id), listRequests(company.id)])
      : [[], []];

    sections.push({
      company,
      orders,
      canCreate,
      suppliers: suppliers.filter((s) => s.status === "active"),
      approvedRequests: requests.filter((r) => r.status === "approved"),
    });
  }

  if (sections.length === 0) {
    return <p className="empty">You have no purchase-order access.</p>;
  }

  return (
    <div>
      {sections.map(({ company, orders, canCreate, suppliers, approvedRequests }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>

          {orders.length === 0 ? (
            <p className="empty">No purchase orders yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Supplier</th>
                    <th scope="col">Lines</th>
                    <th scope="col">Currency</th>
                    <th scope="col">Expected</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/purchasing/orders/${o.id}`}>{o.number}</Link>
                      </td>
                      <td>{o.supplierCode}</td>
                      <td>{o.lineCount}</td>
                      <td>{o.currency}</td>
                      <td>{o.expected_date ?? "—"}</td>
                      <td>
                        <span className={`badge status-${o.status}`}>{o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canCreate && (
            <details style={{ marginTop: "1rem" }}>
              <summary>New purchase order</summary>
              <ActionForm
                action={createOrderAction}
                submitLabel="Create order"
                successMessage="Order created."
                className="stack"
              >
                <input type="hidden" name="companyId" value={company.id} />
                <label>
                  Supplier
                  {suppliers.length === 0 ? (
                    <p className="empty">No active suppliers in this company.</p>
                  ) : (
                    <select name="supplierId" required defaultValue="">
                      <option value="" disabled>
                        Choose a supplier
                      </option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <label>
                  From approved request (optional)
                  <select name="requestId" defaultValue="">
                    <option value="">— none —</option>
                    {approvedRequests.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.number} — {r.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Currency
                  <input name="currency" required maxLength={3} placeholder="USD" />
                </label>
                <label>
                  Rate to base currency ({company.base_currency})
                  <input name="exchangeRate" required placeholder="121.50" />
                </label>
                <label>
                  Expected date
                  <input type="date" name="expectedDate" />
                </label>
                <label>
                  Terms
                  <input name="terms" maxLength={1000} />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

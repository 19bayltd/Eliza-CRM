import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { openCountAction } from "@/server/actions/inventory";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listWarehouses } from "@/server/services/inventory";
import { listCompanies } from "@/server/services/organization";
import { listCounts } from "@/server/services/stock-counts";

export const dynamic = "force-dynamic";

export default async function CountsPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.inventoryView,
      companyId: company.id,
    });
    if (!canView) continue;
    const [counts, warehouses, canManage] = await Promise.all([
      listCounts(company.id),
      listWarehouses(company.id),
      hasPermission({
        permission: PERMISSIONS.inventoryCountManage,
        companyId: company.id,
      }),
    ]);
    sections.push({ company, counts, warehouses, canManage });
  }

  if (sections.length === 0) {
    return <p className="empty">You have no stock access.</p>;
  }

  return (
    <div>
      {sections.map(({ company, counts, warehouses, canManage }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>
          <p className="empty">
            Opening a count records what the system believes right now. You then
            enter what was physically found, and posting corrects the difference
            — leaving both the belief and the correction in the history.
          </p>

          {counts.length === 0 ? (
            <p className="empty">No stock counts yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Warehouse</th>
                    <th scope="col">Lines</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/inventory/counts/${c.id}`}>{c.number}</Link>
                      </td>
                      <td>{c.warehouseCode}</td>
                      <td>{c.lineCount}</td>
                      <td>
                        <span className={`badge status-${c.status}`}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && warehouses.length > 0 && (
            <details style={{ marginTop: "1rem" }}>
              <summary>Open a count</summary>
              <ActionForm
                action={openCountAction}
                submitLabel="Open count"
                successMessage="Count opened."
                className="stack"
              >
                <input type="hidden" name="companyId" value={company.id} />
                <label>
                  Warehouse
                  <select name="warehouseId" required defaultValue="">
                    <option value="" disabled>
                      Choose a warehouse
                    </option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Note
                  <input name="note" maxLength={1000} placeholder="Quarterly count" />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

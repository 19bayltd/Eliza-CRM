import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createAdjustmentAction } from "@/server/actions/inventory";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listWarehouses } from "@/server/services/inventory";
import { listCompanies } from "@/server/services/organization";
import { listAdjustments } from "@/server/services/stock-adjustments";

export const dynamic = "force-dynamic";

export default async function AdjustmentsPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.inventoryView,
      companyId: company.id,
    });
    if (!canView) continue;
    const [adjustments, warehouses, canManage] = await Promise.all([
      listAdjustments(company.id),
      listWarehouses(company.id),
      hasPermission({
        permission: PERMISSIONS.inventoryAdjustmentManage,
        companyId: company.id,
      }),
    ]);
    sections.push({ company, adjustments, warehouses, canManage });
  }

  if (sections.length === 0) {
    return <p className="empty">You have no stock access.</p>;
  }

  return (
    <div>
      {sections.map(({ company, adjustments, warehouses, canManage }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>
          <p className="empty">
            An adjustment changes stock without a physical event, so it is the
            one movement that needs a second person&apos;s approval — and the
            stock moves at the moment of approval, not before.
          </p>

          {adjustments.length === 0 ? (
            <p className="empty">No adjustments yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Warehouse</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Lines</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/inventory/adjustments/${a.id}`}>{a.number}</Link>
                      </td>
                      <td>{a.warehouseCode}</td>
                      <td>{a.reason}</td>
                      <td>{a.lineCount}</td>
                      <td>
                        <span className={`badge status-${a.status}`}>{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && warehouses.length > 0 && (
            <details style={{ marginTop: "1rem" }}>
              <summary>New adjustment</summary>
              <ActionForm
                action={createAdjustmentAction}
                submitLabel="Create adjustment"
                successMessage="Adjustment created."
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
                  Reason
                  <input
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                    placeholder="Damaged in storage, recount after audit…"
                  />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createTransferAction } from "@/server/actions/inventory";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listWarehouses } from "@/server/services/inventory";
import { listCompanies } from "@/server/services/organization";
import { listTransfers } from "@/server/services/stock-transfers";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.inventoryView,
      companyId: company.id,
    });
    if (!canView) continue;
    const [transfers, warehouses, canManage] = await Promise.all([
      listTransfers(company.id),
      listWarehouses(company.id),
      hasPermission({
        permission: PERMISSIONS.inventoryTransferManage,
        companyId: company.id,
      }),
    ]);
    sections.push({ company, transfers, warehouses, canManage });
  }

  if (sections.length === 0) {
    return <p className="empty">You have no stock access.</p>;
  }

  return (
    <div>
      {sections.map(({ company, transfers, warehouses, canManage }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>

          {transfers.length === 0 ? (
            <p className="empty">No transfers yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Lines</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/inventory/transfers/${t.id}`}>{t.number}</Link>
                      </td>
                      <td>{t.fromCode}</td>
                      <td>{t.toCode}</td>
                      <td>{t.lineCount}</td>
                      <td>
                        <span className={`badge status-${t.status}`}>{t.status}</span>
                        {t.status === "dispatched" && (
                          <span className="empty"> · in transit</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <details style={{ marginTop: "1rem" }}>
              <summary>New transfer</summary>
              {warehouses.length < 2 ? (
                <p className="empty">
                  A transfer needs two active warehouses in this company.
                </p>
              ) : (
                <ActionForm
                  action={createTransferAction}
                  submitLabel="Create transfer"
                  successMessage="Transfer created."
                  className="stack"
                >
                  <input type="hidden" name="companyId" value={company.id} />
                  <label>
                    From warehouse
                    <select name="fromWarehouse" required defaultValue="">
                      <option value="" disabled>
                        Choose the source
                      </option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code} — {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To warehouse
                    <select name="toWarehouse" required defaultValue="">
                      <option value="" disabled>
                        Choose the destination
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
                    <input name="note" maxLength={1000} />
                  </label>
                </ActionForm>
              )}
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

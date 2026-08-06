import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listLedger } from "@/server/services/inventory";
import { listCompanies } from "@/server/services/organization";

export const dynamic = "force-dynamic";

/**
 * The movement history — the answer to "why is the balance this?". Rows
 * are immutable; there is deliberately no edit or delete control here,
 * and the database would refuse one anyway.
 */
export default async function LedgerPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.inventoryView,
      companyId: company.id,
    });
    if (!canView) continue;
    sections.push({ company, entries: await listLedger(company.id, 200) });
  }

  if (sections.length === 0) {
    return <p className="empty">You have no stock access.</p>;
  }

  return (
    <div>
      {sections.map(({ company, entries }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>
          <p className="empty">
            Every stock movement, newest first. Entries can never be edited or
            deleted — a mistake is corrected by posting the opposite movement,
            so both remain visible.
          </p>

          {entries.length === 0 ? (
            <p className="empty">No movements recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Warehouse</th>
                    <th scope="col">Product</th>
                    <th scope="col">Movement</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.occurred_at).toLocaleString()}</td>
                      <td>{e.warehouseCode}</td>
                      <td>{e.productSku}</td>
                      <td>
                        <span className="badge">{e.txn_type.replace(/_/g, " ")}</span>
                      </td>
                      <td>
                        <strong className={e.quantity < 0 ? "msg-error" : undefined}>
                          {e.quantity > 0 ? `+${e.quantity}` : e.quantity}
                        </strong>
                      </td>
                      <td>{e.reference_number ?? "—"}</td>
                      <td>{e.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

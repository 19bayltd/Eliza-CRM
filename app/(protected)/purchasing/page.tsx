import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createRequestAction } from "@/server/actions/purchasing";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listCompanies } from "@/server/services/organization";
import { listRequests } from "@/server/services/purchase-requests";

export const dynamic = "force-dynamic";

/**
 * Purchase requests per company. Employees see and raise them; approvers
 * act from the request page, where the frozen total is shown.
 */
export default async function PurchaseRequestsPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.purchasingRequestView,
      companyId: company.id,
    });
    if (!canView) continue;
    const [requests, canManage] = await Promise.all([
      listRequests(company.id),
      hasPermission({
        permission: PERMISSIONS.purchasingRequestManage,
        companyId: company.id,
      }),
    ]);
    sections.push({ company, requests, canManage });
  }

  if (sections.length === 0) {
    return <p className="empty">No companies in your purchasing scope.</p>;
  }

  return (
    <div>
      {sections.map(({ company, requests, canManage }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>

          {requests.length === 0 ? (
            <p className="empty">No purchase requests yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Title</th>
                    <th scope="col">Lines</th>
                    <th scope="col">Needed by</th>
                    <th scope="col">Submitted total</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/purchasing/requests/${r.id}`}>{r.number}</Link>
                      </td>
                      <td>{r.title}</td>
                      <td>{r.lineCount}</td>
                      <td>{r.needed_by ?? "—"}</td>
                      <td>
                        {r.submitted_total === null
                          ? "—"
                          : `${r.submitted_total} ${company.base_currency}`}
                      </td>
                      <td>
                        <span className={`badge status-${r.status}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <details style={{ marginTop: "1rem" }}>
              <summary>New request</summary>
              <ActionForm
                action={createRequestAction}
                submitLabel="Create request"
                successMessage="Request created."
                className="stack"
              >
                <input type="hidden" name="companyId" value={company.id} />
                <label>
                  Title
                  <input name="title" required minLength={3} maxLength={200} />
                </label>
                <label>
                  Justification
                  <textarea name="justification" rows={2} maxLength={2000} />
                </label>
                <label>
                  Needed by
                  <input type="date" name="neededBy" />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

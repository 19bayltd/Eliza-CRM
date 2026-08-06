import { ActionForm } from "@/components/action-form";
import {
  cancelSampleAction,
  createSampleAction,
  dispatchSampleAction,
  evaluateSampleAction,
  receiveSampleAction,
} from "@/server/actions/purchasing";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listCompanies } from "@/server/services/organization";
import { listProducts } from "@/server/services/products";
import { listSamples } from "@/server/services/samples";
import { listSuppliers } from "@/server/services/suppliers";

export const dynamic = "force-dynamic";

/**
 * Sample requests, one card per company. Each row offers exactly the one
 * transition its status allows — dispatch, receive, or evaluate — so the
 * sequence cannot be skipped from the UI, and the service refuses it
 * anyway if someone tries.
 */
export default async function SamplesPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.purchasingSampleView,
      companyId: company.id,
    });
    if (!canView) continue;

    const [samples, canManage] = await Promise.all([
      listSamples(company.id),
      hasPermission({
        permission: PERMISSIONS.purchasingSampleManage,
        companyId: company.id,
      }),
    ]);

    let suppliers: Awaited<ReturnType<typeof listSuppliers>> = [];
    let products: Awaited<ReturnType<typeof listProducts>> = [];
    if (canManage) {
      try {
        [suppliers, products] = await Promise.all([
          listSuppliers(company.id),
          listProducts(company.id),
        ]);
      } catch (err) {
        if (!(err instanceof ServiceError && err.code === "forbidden")) throw err;
      }
    }

    sections.push({
      company,
      samples,
      canManage,
      suppliers: suppliers.filter((s) => s.status === "active"),
      products: products.filter((p) => p.status !== "archived"),
    });
  }

  if (sections.length === 0) {
    return <p className="empty">You have no sample access.</p>;
  }

  return (
    <div>
      {sections.map(({ company, samples, canManage, suppliers, products }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>

          {samples.length === 0 ? (
            <p className="empty">No sample requests yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Supplier</th>
                    <th scope="col">Product</th>
                    <th scope="col">Description</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Status</th>
                    <th scope="col">Outcome</th>
                    {canManage && <th scope="col">Next step</th>}
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s) => (
                    <tr key={s.id}>
                      <td>{s.number}</td>
                      <td>{s.supplierCode}</td>
                      <td>{s.productSku ?? "—"}</td>
                      <td>{s.description}</td>
                      <td>{s.quantity}</td>
                      <td>
                        <span className={`badge status-${s.status}`}>{s.status}</span>
                      </td>
                      <td>
                        {s.evaluation_outcome ? (
                          <span className={`badge status-${s.evaluation_outcome}`}>
                            {s.evaluation_outcome}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {canManage && (
                        <td>
                          {s.status === "requested" && (
                            <details>
                              <summary>Dispatch</summary>
                              <ActionForm
                                action={dispatchSampleAction}
                                submitLabel="Mark dispatched"
                                className="row"
                              >
                                <input type="hidden" name="sampleId" value={s.id} />
                                <label>
                                  Tracking reference
                                  <input name="trackingRef" maxLength={120} />
                                </label>
                              </ActionForm>
                            </details>
                          )}
                          {s.status === "dispatched" && (
                            <ActionForm
                              action={receiveSampleAction}
                              submitLabel="Mark received"
                              className="row"
                            >
                              <input type="hidden" name="sampleId" value={s.id} />
                            </ActionForm>
                          )}
                          {s.status === "received" && (
                            <details>
                              <summary>Evaluate</summary>
                              <ActionForm
                                action={evaluateSampleAction}
                                submitLabel="Record evaluation"
                                className="stack"
                              >
                                <input type="hidden" name="sampleId" value={s.id} />
                                <label>
                                  Outcome
                                  <select name="outcome" required defaultValue="approved">
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                  </select>
                                </label>
                                <label>
                                  Notes
                                  <input name="notes" required minLength={3} />
                                </label>
                              </ActionForm>
                            </details>
                          )}
                          {!["evaluated", "cancelled"].includes(s.status) && (
                            <details>
                              <summary>Cancel</summary>
                              <ActionForm
                                action={cancelSampleAction}
                                submitLabel="Cancel sample"
                                buttonClassName="danger"
                                className="row"
                              >
                                <input type="hidden" name="sampleId" value={s.id} />
                                <label>
                                  Reason
                                  <input name="reason" required minLength={3} />
                                </label>
                              </ActionForm>
                            </details>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <details style={{ marginTop: "1rem" }}>
              <summary>New sample request</summary>
              <ActionForm
                action={createSampleAction}
                submitLabel="Request sample"
                successMessage="Sample requested."
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
                  Product (optional)
                  <select name="productId" defaultValue="">
                    <option value="">— none —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Description
                  <input name="description" required minLength={3} maxLength={500} />
                </label>
                <label>
                  Quantity
                  <input name="quantity" type="number" min={1} step={1} defaultValue={1} required />
                </label>
                <label>
                  Purpose
                  <input name="purpose" maxLength={1000} />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

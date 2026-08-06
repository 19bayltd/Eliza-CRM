import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  addContactAction,
  archiveContactAction,
  archiveQuotationAction,
  archiveSupplierAction,
  createQuotationAction,
  removeSupplierDocumentAction,
  updateSupplierAction,
  uploadSupplierDocumentAction,
} from "@/server/actions/suppliers";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listProducts } from "@/server/services/products";
import { listSupplierQuotations } from "@/server/services/quotations";
import { listSupplierDocuments } from "@/server/services/supplier-documents";
import { getSupplierDetail } from "@/server/services/suppliers";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  let detail;
  try {
    detail = await getSupplierDetail(id);
  } catch (err) {
    if (err instanceof ServiceError && err.code === "not_found") notFound();
    throw err;
  }
  const { supplier, contacts } = detail;

  const [canManage, canQuotationView, canQuotationManage, canCostView, canDocsView, canDocsManage] =
    await Promise.all([
      hasPermission({ permission: PERMISSIONS.suppliersManage, companyId: supplier.company_id }),
      hasPermission({ permission: PERMISSIONS.suppliersQuotationView, companyId: supplier.company_id }),
      hasPermission({ permission: PERMISSIONS.suppliersQuotationManage, companyId: supplier.company_id }),
      hasPermission({ permission: PERMISSIONS.suppliersQuotationCostView, companyId: supplier.company_id }),
      hasPermission({ permission: PERMISSIONS.suppliersDocumentDownload, companyId: supplier.company_id }),
      hasPermission({ permission: PERMISSIONS.suppliersDocumentManage, companyId: supplier.company_id }),
    ]);

  const quotations = canQuotationView ? await listSupplierQuotations(supplier.id) : [];
  const documents = canDocsView ? await listSupplierDocuments(supplier.id) : [];
  const products = canQuotationManage ? await listProducts(supplier.company_id) : [];

  return (
    <div>
      <p>
        <Link href="/suppliers">← All suppliers</Link>
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {supplier.name} <span className="badge">{supplier.code}</span>{" "}
          <span className="badge">{supplier.country}</span>{" "}
          <span className={`badge status-${supplier.status}`}>{supplier.status}</span>
        </h2>
        <p className="muted">
          Capabilities: {supplier.capabilities ?? "—"} · Address:{" "}
          {supplier.address ?? "—"}
        </p>
        {supplier.notes && <p>{supplier.notes}</p>}

        {canManage && supplier.status === "active" && (
          <>
            <details>
              <summary>Edit supplier</summary>
              <ActionForm
                action={updateSupplierAction}
                submitLabel="Save changes"
                successMessage="Supplier updated."
                className="stack"
              >
                <input type="hidden" name="supplierId" value={supplier.id} />
                <div className="row">
                  <label>
                    Name
                    <input name="name" required maxLength={200} defaultValue={supplier.name} />
                  </label>
                  <label>
                    Country
                    <input
                      name="country"
                      required
                      maxLength={2}
                      defaultValue={supplier.country}
                      style={{ textTransform: "uppercase" }}
                    />
                  </label>
                </div>
                <label>
                  Capabilities
                  <input
                    name="capabilities"
                    maxLength={500}
                    defaultValue={supplier.capabilities ?? ""}
                  />
                </label>
                <label>
                  Address
                  <input name="address" maxLength={500} defaultValue={supplier.address ?? ""} />
                </label>
                <label>
                  Notes
                  <textarea name="notes" rows={2} maxLength={2000} defaultValue={supplier.notes ?? ""} />
                </label>
              </ActionForm>
            </details>
            <details>
              <summary>Archive supplier</summary>
              <ActionForm
                action={archiveSupplierAction}
                submitLabel="Archive supplier"
                confirmMessage={`Archive ${supplier.code}? Active quotations must be archived first.`}
                buttonClassName="danger"
                className="row"
              >
                <input type="hidden" name="id" value={supplier.id} />
                <label>
                  Reason
                  <input name="reason" required minLength={3} />
                </label>
              </ActionForm>
            </details>
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Contacts</h2>
        {contacts.length === 0 ? (
          <p className="empty">No contacts yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Messaging</th>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  {canManage && <th scope="col">Manage</th>}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.role_title ?? "—"}</td>
                    <td>{c.phone ?? "—"}</td>
                    <td>{c.messaging ?? "—"}</td>
                    <td>{c.email ?? "—"}</td>
                    <td>
                      <span className={`badge status-${c.status}`}>{c.status}</span>
                    </td>
                    {canManage && (
                      <td>
                        {c.status === "active" && (
                          <details>
                            <summary>Archive</summary>
                            <ActionForm
                              action={archiveContactAction}
                              submitLabel="Archive contact"
                              buttonClassName="danger"
                              className="row"
                            >
                              <input type="hidden" name="supplierId" value={supplier.id} />
                              <input type="hidden" name="id" value={c.id} />
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

        {canManage && supplier.status === "active" && (
          <details style={{ marginTop: "1rem" }}>
            <summary>Add contact</summary>
            <ActionForm
              action={addContactAction}
              submitLabel="Add contact"
              successMessage="Contact added."
              className="stack"
            >
              <input type="hidden" name="supplierId" value={supplier.id} />
              <div className="row">
                <label>
                  Name
                  <input name="name" required maxLength={120} />
                </label>
                <label>
                  Role
                  <input name="roleTitle" maxLength={120} placeholder="Sales Manager" />
                </label>
              </div>
              <div className="row">
                <label>
                  Phone
                  <input name="phone" maxLength={40} />
                </label>
                <label>
                  WeChat / WhatsApp
                  <input name="messaging" maxLength={120} />
                </label>
                <label>
                  Email
                  <input name="email" type="email" maxLength={254} />
                </label>
              </div>
            </ActionForm>
          </details>
        )}
      </div>

      {canQuotationView && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Quotations</h2>
          {!canCostView && (
            <p className="muted">
              Prices are restricted to holders of the quotation-cost
              permission; you see terms and logistics only.
            </p>
          )}
          {quotations.length === 0 ? (
            <p className="empty">No quotations yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Variant</th>
                    <th scope="col">Price</th>
                    <th scope="col">MOQ</th>
                    <th scope="col">Lead (days)</th>
                    <th scope="col">Valid until</th>
                    <th scope="col">Status</th>
                    {canQuotationManage && <th scope="col">Manage</th>}
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr key={q.id}>
                      <td>{q.productSku}</td>
                      <td>{q.variantSku ?? "—"}</td>
                      <td>
                        {q.cost
                          ? `${q.cost.unitPrice} ${q.cost.currency} (≈ ${q.cost.normalized} ${q.cost.baseCurrency})`
                          : "•••"}
                      </td>
                      <td>{q.moq ?? "—"}</td>
                      <td>{q.lead_time_days ?? "—"}</td>
                      <td>{q.valid_until ?? "—"}</td>
                      <td>
                        <span className={`badge status-${q.status}`}>{q.status}</span>
                      </td>
                      {canQuotationManage && (
                        <td>
                          {q.status === "active" && (
                            <details>
                              <summary>Archive</summary>
                              <ActionForm
                                action={archiveQuotationAction}
                                submitLabel="Archive quotation"
                                buttonClassName="danger"
                                className="row"
                              >
                                <input type="hidden" name="supplierId" value={supplier.id} />
                                <input type="hidden" name="id" value={q.id} />
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

          {canQuotationManage && canCostView && supplier.status === "active" && (
            <details style={{ marginTop: "1rem" }}>
              <summary>New quotation</summary>
              <ActionForm
                action={createQuotationAction}
                submitLabel="Add quotation"
                successMessage="Quotation added."
                className="stack"
              >
                <input type="hidden" name="supplierId" value={supplier.id} />
                <label>
                  Product
                  <select name="productId" required>
                    {products
                      .filter((p) => p.status !== "archived")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="row">
                  <label>
                    Unit price
                    <input name="unitPrice" required inputMode="decimal" placeholder="1.85" />
                  </label>
                  <label>
                    Currency
                    <input
                      name="currency"
                      required
                      maxLength={3}
                      placeholder="USD"
                      style={{ textTransform: "uppercase" }}
                    />
                  </label>
                  <label>
                    Rate to base currency
                    <input
                      name="exchangeRate"
                      required
                      inputMode="decimal"
                      placeholder="121.50"
                      title="How many units of the company's base currency equal 1 unit of the quote currency"
                    />
                  </label>
                </div>
                <div className="row">
                  <label>
                    MOQ
                    <input name="moq" inputMode="numeric" placeholder="500" />
                  </label>
                  <label>
                    Lead time (days)
                    <input name="leadTimeDays" inputMode="numeric" placeholder="45" />
                  </label>
                  <label>
                    Valid until
                    <input name="validUntil" type="date" />
                  </label>
                </div>
                <label>
                  Terms
                  <input name="terms" maxLength={1000} placeholder="FOB Chattogram, 30% advance" />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      )}

      {canDocsView && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Private documents</h2>
          <p className="muted">
            Confidential — every download is recorded in the audit log.
          </p>
          {documents.length === 0 ? (
            <p className="empty">No documents.</p>
          ) : (
            <ul>
              {documents.map((d) => (
                <li key={d.id}>
                  <a href={d.url} target="_blank" rel="noreferrer">
                    {d.title ?? d.originalName}
                  </a>{" "}
                  <span className="muted">({d.originalName})</span>
                  {canDocsManage && (
                    <ActionForm
                      action={removeSupplierDocumentAction}
                      submitLabel="Remove"
                      confirmMessage="Remove this document?"
                      buttonClassName="danger"
                      className="row"
                    >
                      <input type="hidden" name="supplierId" value={supplier.id} />
                      <input type="hidden" name="documentId" value={d.id} />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canDocsManage && supplier.status === "active" && (
            <details style={{ marginTop: "1rem" }}>
              <summary>Upload document</summary>
              <ActionForm
                action={uploadSupplierDocumentAction}
                submitLabel="Upload"
                successMessage="Document uploaded."
                className="stack"
              >
                <input type="hidden" name="supplierId" value={supplier.id} />
                <label>
                  File (PDF, image, or office document)
                  <input type="file" name="file" required />
                </label>
                <label>
                  Title (optional)
                  <input name="title" maxLength={200} placeholder="2026 price list" />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

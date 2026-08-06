import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  addOrderLineAction,
  cancelOrderAction,
  issueOrderAction,
  recordReceiptAction,
  removePurchaseDocumentAction,
  setOrderWarehouseAction,
  uploadPurchaseDocumentAction,
} from "@/server/actions/purchasing";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listWarehouses } from "@/server/services/inventory";
import { listCompanies } from "@/server/services/organization";
import { listProducts } from "@/server/services/products";
import { getOrderDetail } from "@/server/services/purchase-orders";
import { listPurchaseDocuments } from "@/server/services/purchase-documents";
import { ISSUE_BLOCK_MESSAGE } from "@/server/validation/purchasing";

export const dynamic = "force-dynamic";

/**
 * One purchase order. Prices show as `•••` for anyone without
 * `purchasing.cost.view` — and for those users the service never fetches
 * the cost rows at all, so nothing is hidden client-side.
 */
export default async function PurchaseOrderPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  let detail: Awaited<ReturnType<typeof getOrderDetail>>;
  try {
    detail = await getOrderDetail(id);
  } catch (err) {
    if (err instanceof ServiceError && err.code === "not_found") notFound();
    throw err;
  }
  const { order, lines, total, receipts, canSeeCosts, issueBlock } = detail;

  const [companies, canManage, canReceive, canDocs, canDocManage] = await Promise.all([
    listCompanies(),
    hasPermission({
      permission: PERMISSIONS.purchasingOrderManage,
      companyId: order.company_id,
    }),
    hasPermission({
      permission: PERMISSIONS.purchasingReceive,
      companyId: order.company_id,
    }),
    hasPermission({
      permission: PERMISSIONS.purchasingDocumentDownload,
      companyId: order.company_id,
    }),
    hasPermission({
      permission: PERMISSIONS.purchasingDocumentManage,
      companyId: order.company_id,
    }),
  ]);

  const documents = canDocs
    ? await listPurchaseDocuments("purchase_order", order.id)
    : [];
  const baseCurrency =
    companies.find((c) => c.id === order.company_id)?.base_currency ?? "";

  let products: Awaited<ReturnType<typeof listProducts>> = [];
  try {
    products = await listProducts(order.company_id);
  } catch (err) {
    if (!(err instanceof ServiceError && err.code === "forbidden")) throw err;
  }
  const selectable = products.filter((p) => p.status !== "archived");

  const isDraft = order.status === "draft";
  const isReceivable = ["issued", "partially_received"].includes(order.status);

  // Warehouses are only offered while the order can still change. The list
  // needs inventory.view, which an order manager may not hold — and
  // "you cannot see the warehouses" must not be reported as "there are
  // none", because the two need different people to fix them.
  let warehouses: Awaited<ReturnType<typeof listWarehouses>> = [];
  let warehousesHidden = false;
  if (canManage && isDraft) {
    try {
      warehouses = await listWarehouses(order.company_id);
    } catch (err) {
      if (err instanceof ServiceError && err.code === "forbidden") {
        warehousesHidden = true;
      } else {
        throw err;
      }
    }
  }

  return (
    <div>
      <p>
        <Link href="/purchasing/orders">← All purchase orders</Link>
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {order.supplierName} <span className="badge">{order.number}</span>{" "}
          <span className={`badge status-${order.status}`}>{order.status}</span>
        </h2>
        <p>
          Supplier: {order.supplierCode} · Currency: {order.currency} · Expected:{" "}
          {order.expected_date ?? "—"}
        </p>
        <p>
          Deliver to:{" "}
          {order.warehouseCode ? (
            <>
              {order.warehouseCode} — {order.warehouseName}
              {order.warehouseStatus !== "active" && (
                <span className="badge status-archived"> archived</span>
              )}
            </>
          ) : (
            <span className="empty">not set</span>
          )}
        </p>
        {order.terms && <p>Terms: {order.terms}</p>}
        {canSeeCosts ? (
          <p>
            <strong>
              Order total: {total} {order.currency}
            </strong>{" "}
            <span className="empty">
              (rate {order.exchange_rate} to {baseCurrency}, frozen at issue)
            </span>
          </p>
        ) : (
          <p className="empty">
            Prices are restricted to holders of the purchasing-cost permission;
            you see quantities and logistics only.
          </p>
        )}
        {order.cancel_reason && (
          <p>
            Cancellation reason: <em>{order.cancel_reason}</em>
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Lines</h2>
        {lines.length === 0 ? (
          <p className="empty">No lines yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Variant</th>
                  <th scope="col">Ordered</th>
                  <th scope="col">Accepted so far</th>
                  <th scope="col">Unit price</th>
                  <th scope="col">Line total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.productSku}</td>
                    <td>{l.variantSku ?? "—"}</td>
                    <td>{l.quantity_ordered}</td>
                    <td>{l.receivedAccepted}</td>
                    <td>{l.unitPrice ? `${l.unitPrice} ${order.currency}` : "•••"}</td>
                    <td>{l.lineTotal ? `${l.lineTotal} ${order.currency}` : "•••"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage && canSeeCosts && isDraft && (
          <details style={{ marginTop: "1rem" }}>
            <summary>Add line</summary>
            <ActionForm
              action={addOrderLineAction}
              submitLabel="Add line"
              successMessage="Line added."
              className="stack"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <label>
                Product
                {selectable.length === 0 ? (
                  <p className="empty">No selectable products in this company.</p>
                ) : (
                  <select name="productId" required defaultValue="">
                    <option value="" disabled>
                      Choose a product
                    </option>
                    {selectable.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label>
                Quantity
                <input name="quantity" type="number" min={1} step={1} required />
              </label>
              <label>
                Unit price ({order.currency})
                <input name="unitPrice" required placeholder="1.85" />
              </label>
              <label>
                Notes
                <input name="notes" maxLength={500} />
              </label>
            </ActionForm>
          </details>
        )}
      </div>

      {canManage && (isDraft || order.status === "issued") && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Order actions</h2>
          {isDraft && (
            <>
              <details style={{ marginBottom: "0.75rem" }} open={!order.warehouseCode}>
                <summary>
                  {order.warehouseCode ? "Change destination" : "Set destination"}
                </summary>
                {warehousesHidden ? (
                  <p className="empty">
                    You do not have inventory access in this company, so the
                    warehouse list cannot be shown. Ask someone with inventory
                    access to set the destination before this order is issued.
                  </p>
                ) : warehouses.length === 0 ? (
                  <p className="empty">
                    No active warehouse exists in this company yet. Create one in
                    Administration → Organization — receiving posts stock into
                    it, so the order cannot be issued until it has one.
                  </p>
                ) : (
                  <ActionForm
                    action={setOrderWarehouseAction}
                    submitLabel="Save destination"
                    successMessage="Destination saved."
                    className="row"
                  >
                    <input type="hidden" name="orderId" value={order.id} />
                    <label>
                      Deliver to warehouse
                      <select
                        name="warehouseId"
                        required
                        defaultValue={order.warehouse_id ?? ""}
                      >
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
                  </ActionForm>
                )}
              </details>
              {issueBlock ? (
                <p className="empty">
                  Cannot issue yet: {ISSUE_BLOCK_MESSAGE[issueBlock]}.
                </p>
              ) : (
                <ActionForm
                  action={issueOrderAction}
                  submitLabel="Issue order"
                  successMessage="Order issued."
                  confirmMessage="Issue this order? It becomes a commitment and lines can no longer be edited."
                  className="row"
                >
                  <input type="hidden" name="orderId" value={order.id} />
                </ActionForm>
              )}
            </>
          )}
          <details style={{ marginTop: "0.75rem" }}>
            <summary>Cancel order</summary>
            <ActionForm
              action={cancelOrderAction}
              submitLabel="Cancel order"
              buttonClassName="danger"
              className="row"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </ActionForm>
          </details>
        </div>
      )}

      {canReceive && isReceivable && lines.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Record a receipt</h2>
          <p className="empty">
            Record what actually arrived per line. The whole receipt is written
            in one transaction — if any line fails, nothing is recorded.
          </p>
          <ActionForm
            action={recordReceiptAction}
            submitLabel="Record receipt"
            successMessage="Receipt recorded."
            className="stack"
          >
            <input type="hidden" name="orderId" value={order.id} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Ordered</th>
                    <th scope="col">Accepted</th>
                    <th scope="col">Damaged</th>
                    <th scope="col">Missing</th>
                    <th scope="col">Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.productSku}
                        <input type="hidden" name="lineId" value={l.id} />
                      </td>
                      <td>{l.quantity_ordered}</td>
                      <td>
                        <input
                          name={`accepted_${l.id}`}
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={0}
                          aria-label={`Accepted quantity for ${l.productSku}`}
                        />
                      </td>
                      <td>
                        <input
                          name={`damaged_${l.id}`}
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={0}
                          aria-label={`Damaged quantity for ${l.productSku}`}
                        />
                      </td>
                      <td>
                        <input
                          name={`missing_${l.id}`}
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={0}
                          aria-label={`Missing quantity for ${l.productSku}`}
                        />
                      </td>
                      <td>
                        <input
                          name={`extra_${l.id}`}
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={0}
                          aria-label={`Extra quantity for ${l.productSku}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label>
              Note
              <input name="note" maxLength={1000} />
            </label>
          </ActionForm>
        </div>
      )}

      {canDocs && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Documents</h2>
          <p className="empty">
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
                  <span className="empty">({d.originalName})</span>
                  {canDocManage && (
                    <ActionForm
                      action={removePurchaseDocumentAction}
                      submitLabel="Remove"
                      buttonClassName="danger"
                      confirmMessage="Remove this document? The file is deleted; the audit trail keeps the record."
                      className="row"
                    >
                      <input type="hidden" name="documentId" value={d.id} />
                      <input type="hidden" name="orderId" value={order.id} />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canDocManage && order.status !== "cancelled" && (
            <details style={{ marginTop: "1rem" }}>
              <summary>Upload document</summary>
              <ActionForm
                action={uploadPurchaseDocumentAction}
                submitLabel="Upload"
                successMessage="Document uploaded."
                className="stack"
              >
                <input type="hidden" name="entityType" value="purchase_order" />
                <input type="hidden" name="entityId" value={order.id} />
                <label>
                  File (PDF, image, or office document)
                  <input type="file" name="file" required />
                </label>
                <label>
                  Title (optional)
                  <input name="title" maxLength={200} placeholder="Signed PO" />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Receipts</h2>
        {receipts.length === 0 ? (
          <p className="empty">Nothing received yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Number</th>
                  <th scope="col">Received at</th>
                  <th scope="col">Lines</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td>{r.number}</td>
                    <td>{new Date(r.received_at).toLocaleString()}</td>
                    <td>{r.lineCount}</td>
                    <td>{r.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

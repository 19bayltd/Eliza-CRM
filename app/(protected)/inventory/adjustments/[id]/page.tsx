import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  addAdjustmentLineAction,
  decideAdjustmentAction,
  submitAdjustmentAction,
} from "@/server/actions/inventory";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listProducts } from "@/server/services/products";
import { getAdjustmentDetail } from "@/server/services/stock-adjustments";

export const dynamic = "force-dynamic";

/**
 * One adjustment. Approving it posts the ledger entries in the same call,
 * so the decision and the stock movement cannot come apart.
 */
export default async function AdjustmentPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  let detail: Awaited<ReturnType<typeof getAdjustmentDetail>>;
  try {
    detail = await getAdjustmentDetail(id);
  } catch (err) {
    if (err instanceof ServiceError && err.code === "not_found") notFound();
    throw err;
  }
  const { adjustment, lines, approvals, canDecide, blockedBecause } = detail;

  const [canManage, canOverride] = await Promise.all([
    hasPermission({
      permission: PERMISSIONS.inventoryAdjustmentManage,
      companyId: adjustment.company_id,
    }),
    hasPermission({
      permission: PERMISSIONS.inventoryNegativeOverride,
      companyId: adjustment.company_id,
    }),
  ]);

  let products: Awaited<ReturnType<typeof listProducts>> = [];
  if (canManage && adjustment.status === "draft") {
    try {
      products = await listProducts(adjustment.company_id);
    } catch (err) {
      if (!(err instanceof ServiceError && err.code === "forbidden")) throw err;
    }
  }

  const isDraft = adjustment.status === "draft";
  const isSubmitted = adjustment.status === "submitted";
  const net = lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div>
      <p>
        <Link href="/inventory/adjustments">← All adjustments</Link>
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {adjustment.number}{" "}
          <span className={`badge status-${adjustment.status}`}>{adjustment.status}</span>
        </h2>
        <p>
          Warehouse: {adjustment.warehouseCode} · Lines: {lines.length} · Net
          change: <strong>{net > 0 ? `+${net}` : net}</strong>
        </p>
        <p>
          Reason: <em>{adjustment.reason}</em>
        </p>
        {adjustment.decision_reason && (
          <p>
            Decision reason: <em>{adjustment.decision_reason}</em>
          </p>
        )}
        {adjustment.status === "approved" && (
          <p className="empty">Approved and posted to the ledger.</p>
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
                  <th scope="col">Change</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.productSku}</td>
                    <td>{l.variantSku ?? "—"}</td>
                    <td>
                      <strong className={l.quantity < 0 ? "msg-error" : undefined}>
                        {l.quantity > 0 ? `+${l.quantity}` : l.quantity}
                      </strong>
                    </td>
                    <td>{l.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage && isDraft && (
          <details style={{ marginTop: "1rem" }}>
            <summary>Add line</summary>
            <ActionForm
              action={addAdjustmentLineAction}
              submitLabel="Add line"
              successMessage="Line added."
              className="stack"
            >
              <input type="hidden" name="adjustmentId" value={adjustment.id} />
              <label>
                Product
                {products.length === 0 ? (
                  <p className="empty">No selectable products in this company.</p>
                ) : (
                  <select name="productId" required defaultValue="">
                    <option value="" disabled>
                      Choose a product
                    </option>
                    {products
                      .filter((p) => p.status !== "archived")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                  </select>
                )}
              </label>
              <label>
                Change (positive to add, negative to remove)
                <input name="quantity" type="number" step={1} required placeholder="-5" />
              </label>
              <label>
                Note
                <input name="note" maxLength={500} />
              </label>
            </ActionForm>
          </details>
        )}
      </div>

      {canManage && isDraft && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Submit</h2>
          <ActionForm
            action={submitAdjustmentAction}
            submitLabel="Submit for approval"
            successMessage="Submitted."
            confirmMessage="Submit this adjustment? Lines can no longer be edited."
            className="row"
          >
            <input type="hidden" name="adjustmentId" value={adjustment.id} />
          </ActionForm>
        </div>
      )}

      {isSubmitted && blockedBecause && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Decision</h2>
          <p className="empty">{blockedBecause}</p>
        </div>
      )}

      {isSubmitted && canDecide && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Decision</h2>
          <p className="empty">
            Approving posts these changes to the ledger immediately.
          </p>
          <ActionForm
            action={decideAdjustmentAction}
            submitLabel="Record decision"
            successMessage="Decision recorded."
            className="stack"
          >
            <input type="hidden" name="adjustmentId" value={adjustment.id} />
            <label>
              Decision
              <select name="decision" required defaultValue="approved">
                <option value="approved">Approve and post</option>
                <option value="rejected">Reject</option>
              </select>
            </label>
            <label>
              Reason
              <input name="reason" required minLength={3} />
            </label>
            {canOverride && (
              <label className="row">
                <input type="checkbox" name="allowNegative" />
                Allow balances to go below zero (recorded as an override)
              </label>
            )}
          </ActionForm>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Approval history</h2>
        {approvals.length === 0 ? (
          <p className="empty">No approval records yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Decided</th>
                  <th scope="col">Rule applied</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className={`badge status-${a.status}`}>{a.status}</span>
                    </td>
                    <td>{new Date(a.requested_at).toLocaleString()}</td>
                    <td>{a.decided_at ? new Date(a.decided_at).toLocaleString() : "—"}</td>
                    <td>{a.rule_applied ?? "—"}</td>
                    <td>{a.reason ?? "—"}</td>
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

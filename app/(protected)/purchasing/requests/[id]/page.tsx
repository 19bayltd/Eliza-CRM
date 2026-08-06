import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  addRequestLineAction,
  cancelRequestAction,
  decideRequestAction,
  submitRequestAction,
} from "@/server/actions/purchasing";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listProducts } from "@/server/services/products";
import {
  decisionBlockReason,
  getRequestDetail,
  resolveApprovalRule,
} from "@/server/services/purchase-requests";
import { listCompanies } from "@/server/services/organization";

export const dynamic = "force-dynamic";

/** Money reads as 25,000.00 everywhere, not 25000 in one place and
 *  25000.00 in another. Values arrive as decimal strings and are never
 *  converted to floats for arithmetic — this is display only. */
function money(value: string | number | null): string {
  if (value === null) return "—";
  const [int, frac = ""] = String(value).split(".");
  const grouped = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}.${(frac + "00").slice(0, 2)}`;
}

/**
 * One purchase request: its lines, the frozen total an approver judges,
 * and the decision controls. The approve/reject block only renders for a
 * user the approval rule actually authorizes — and the service enforces
 * the same rule regardless of what the page shows.
 */
export default async function PurchaseRequestPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  let detail: Awaited<ReturnType<typeof getRequestDetail>>;
  try {
    detail = await getRequestDetail(id);
  } catch (err) {
    if (err instanceof ServiceError && err.code === "not_found") notFound();
    throw err;
  }
  const { request, lines, currentTotal, approvals } = detail;

  const [companies, canManage, decisionBlock, rule] = await Promise.all([
    listCompanies(),
    hasPermission({
      permission: PERMISSIONS.purchasingRequestManage,
      companyId: request.company_id,
    }),
    decisionBlockReason(request),
    resolveApprovalRule({
      companyId: request.company_id,
      amount: String(request.submitted_total ?? currentTotal),
    }),
  ]);

  // A role holding request.view without products.view degrades to an
  // empty product list rather than crashing the page.
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  try {
    products = await listProducts(request.company_id);
  } catch (err) {
    if (!(err instanceof ServiceError && err.code === "forbidden")) throw err;
  }
  const selectable = products.filter((p) => p.status !== "archived");

  const canDecide = decisionBlock === null;
  // Two different reasons produce the same empty decision area, and
  // conflating them tells an approver something untrue about who did what.
  const blockedBecause =
    decisionBlock === "self"
      ? "You submitted this request, so you cannot decide it — the server refuses that regardless of permissions."
      : decisionBlock === "authority"
        ? `This amount requires ${rule?.required_permission ?? "a higher approval permission"}, which you do not hold. It is waiting for someone who does.`
        : decisionBlock === "no_rule"
          ? "No approval rule covers this amount, so nobody can decide it until one is configured."
          : null;

  const isDraft = request.status === "draft";
  const isSubmitted = request.status === "submitted";
  const currency =
    companies.find((c) => c.id === request.company_id)?.base_currency ?? "";

  return (
    <div>
      <p>
        <Link href="/purchasing">← All requests</Link>
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {request.title} <span className="badge">{request.number}</span>{" "}
          <span className={`badge status-${request.status}`}>{request.status}</span>
        </h2>
        <p>
          Needed by: {request.needed_by ?? "—"} · Lines: {lines.length}
        </p>
        {request.justification && <p>{request.justification}</p>}
        <p>
          <strong>
            {isDraft ? "Current total" : "Submitted total"}:{" "}
            {isDraft ? money(currentTotal) : money(request.submitted_total)} {currency}
          </strong>
          {!isDraft && (
            <>
              {" "}
              <span className="empty">
                (frozen at submission — the amount the approver judges)
              </span>
            </>
          )}
        </p>
        {request.decision_reason && (
          <p>
            Decision reason: <em>{request.decision_reason}</em>
          </p>
        )}
        {rule && (
          <p className="empty">
            Approval for this amount requires <code>{rule.required_permission}</code>.
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
                  <th scope="col">Quantity</th>
                  <th scope="col">Estimated unit price</th>
                  <th scope="col">Line total</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.productSku}</td>
                    <td>{l.variantSku ?? "—"}</td>
                    <td>{l.quantity}</td>
                    <td>
                      {money(l.estimated_unit_price)} {currency}
                    </td>
                    <td>
                      {money(l.lineTotal)} {currency}
                    </td>
                    <td>{l.notes ?? "—"}</td>
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
              action={addRequestLineAction}
              submitLabel="Add line"
              successMessage="Line added."
              className="stack"
            >
              <input type="hidden" name="requestId" value={request.id} />
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
                Estimated unit price ({currency})
                <input name="estimatedUnitPrice" required placeholder="120.00" />
              </label>
              <label>
                Notes
                <input name="notes" maxLength={500} />
              </label>
            </ActionForm>
          </details>
        )}
      </div>

      {canManage && (isDraft || isSubmitted) && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Request actions</h2>
          {isDraft && (
            <ActionForm
              // Remount when the lines change so a previous "add a line"
              // refusal does not linger once a line exists.
              key={`submit-${lines.length}`}
              action={submitRequestAction}
              submitLabel="Submit for approval"
              successMessage="Submitted."
              confirmMessage="Submit this request? The total will be frozen and lines can no longer be edited."
              className="row"
            >
              <input type="hidden" name="requestId" value={request.id} />
            </ActionForm>
          )}
          <details style={{ marginTop: "0.75rem" }}>
            <summary>Cancel request</summary>
            <ActionForm
              action={cancelRequestAction}
              submitLabel="Cancel request"
              buttonClassName="danger"
              className="row"
            >
              <input type="hidden" name="requestId" value={request.id} />
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </ActionForm>
          </details>
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
          <ActionForm
            action={decideRequestAction}
            submitLabel="Record decision"
            successMessage="Decision recorded."
            className="stack"
          >
            <input type="hidden" name="requestId" value={request.id} />
            <label>
              Decision
              <select name="decision" required defaultValue="approved">
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </label>
            <label>
              Reason
              <input name="reason" required minLength={3} />
            </label>
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

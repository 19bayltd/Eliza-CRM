import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  cancelCountAction,
  enterCountLineAction,
  postCountAction,
} from "@/server/actions/inventory";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { getCountDetail } from "@/server/services/stock-counts";

export const dynamic = "force-dynamic";

/**
 * One stock count. Each line shows the snapshot taken when the count
 * opened, what was counted, and the variance between them — the variance
 * is what posts, and only where it is non-zero.
 */
export default async function CountPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  let detail: Awaited<ReturnType<typeof getCountDetail>>;
  try {
    detail = await getCountDetail(id);
  } catch (err) {
    if (err instanceof ServiceError && err.code === "not_found") notFound();
    throw err;
  }
  const { count, lines } = detail;

  const canManage = await hasPermission({
    permission: PERMISSIONS.inventoryCountManage,
    companyId: count.company_id,
  });

  const isOpen = count.status === "counting";
  const counted = lines.filter((l) => l.counted_qty !== null).length;
  const withVariance = lines.filter((l) => l.variance !== null).length;

  return (
    <div>
      <p>
        <Link href="/inventory/counts">← All stock counts</Link>
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {count.number}{" "}
          <span className={`badge status-${count.status}`}>{count.status}</span>
        </h2>
        <p>
          Warehouse: {count.warehouseCode} · Lines: {lines.length} · Counted:{" "}
          {counted} · With variance: {withVariance}
        </p>
        {count.note && <p>{count.note}</p>}
        {count.cancel_reason && (
          <p>
            Cancellation reason: <em>{count.cancel_reason}</em>
          </p>
        )}
        {count.status === "posted" && (
          <p className="empty">
            Posted: {withVariance} correction{withVariance === 1 ? "" : "s"} were
            written to the ledger. Lines that matched wrote nothing.
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Lines</h2>
        {lines.length === 0 ? (
          <p className="empty">No lines.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Variant</th>
                  <th scope="col">System</th>
                  <th scope="col">Counted</th>
                  <th scope="col">Variance</th>
                  {canManage && isOpen && <th scope="col">Enter count</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.productSku}</td>
                    <td>{l.variantSku ?? "—"}</td>
                    <td>{l.system_qty}</td>
                    <td>{l.counted_qty ?? "—"}</td>
                    <td>
                      {l.variance === null ? (
                        l.counted_qty === null ? (
                          "—"
                        ) : (
                          <span className="empty">matches</span>
                        )
                      ) : (
                        <strong className={l.variance < 0 ? "msg-error" : undefined}>
                          {l.variance > 0 ? `+${l.variance}` : l.variance}
                        </strong>
                      )}
                    </td>
                    {canManage && isOpen && (
                      <td>
                        <ActionForm
                          action={enterCountLineAction}
                          submitLabel="Save"
                          className="row"
                        >
                          <input type="hidden" name="countId" value={count.id} />
                          <input type="hidden" name="lineId" value={l.id} />
                          <input
                            name="countedQty"
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={l.counted_qty ?? undefined}
                            required
                            aria-label={`Counted quantity for ${l.productSku}`}
                          />
                        </ActionForm>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage && isOpen && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Finish the count</h2>
          <ActionForm
            action={postCountAction}
            submitLabel="Post count"
            successMessage="Count posted."
            confirmMessage="Post this count? Variances become permanent ledger corrections."
            className="row"
          >
            <input type="hidden" name="countId" value={count.id} />
          </ActionForm>
          <details style={{ marginTop: "0.75rem" }}>
            <summary>Cancel count</summary>
            <ActionForm
              action={cancelCountAction}
              submitLabel="Cancel count"
              buttonClassName="danger"
              className="row"
            >
              <input type="hidden" name="countId" value={count.id} />
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </ActionForm>
          </details>
        </div>
      )}
    </div>
  );
}

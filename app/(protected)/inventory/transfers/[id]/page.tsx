import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  addTransferLineAction,
  cancelTransferAction,
  dispatchTransferAction,
  receiveTransferAction,
} from "@/server/actions/inventory";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listProducts } from "@/server/services/products";
import { getTransferDetail } from "@/server/services/stock-transfers";

export const dynamic = "force-dynamic";

/**
 * One transfer. Dispatch and receive are separate acts because the stock
 * genuinely is in neither warehouse in between — the page says so rather
 * than pretending the move is instantaneous.
 */
export default async function TransferPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  let detail: Awaited<ReturnType<typeof getTransferDetail>>;
  try {
    detail = await getTransferDetail(id);
  } catch (err) {
    if (err instanceof ServiceError && err.code === "not_found") notFound();
    throw err;
  }
  const { transfer, lines } = detail;

  const [canManage, canReceive] = await Promise.all([
    hasPermission({
      permission: PERMISSIONS.inventoryTransferManage,
      companyId: transfer.company_id,
    }),
    hasPermission({
      permission: PERMISSIONS.inventoryTransferReceive,
      companyId: transfer.company_id,
    }),
  ]);

  let products: Awaited<ReturnType<typeof listProducts>> = [];
  if (canManage && transfer.status === "draft") {
    try {
      products = await listProducts(transfer.company_id);
    } catch (err) {
      if (!(err instanceof ServiceError && err.code === "forbidden")) throw err;
    }
  }

  const isDraft = transfer.status === "draft";
  const isDispatched = transfer.status === "dispatched";

  return (
    <div>
      <p>
        <Link href="/inventory/transfers">← All transfers</Link>
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {transfer.number}{" "}
          <span className={`badge status-${transfer.status}`}>{transfer.status}</span>
        </h2>
        <p>
          {transfer.fromCode} → {transfer.toCode} · Lines: {lines.length}
        </p>
        {transfer.note && <p>{transfer.note}</p>}
        {isDispatched && (
          <p className="empty">
            In transit: these units have left {transfer.fromCode} and have not
            yet arrived at {transfer.toCode}, so they count in neither
            warehouse&apos;s stock.
          </p>
        )}
        {transfer.cancel_reason && (
          <p>
            Cancellation reason: <em>{transfer.cancel_reason}</em>
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
                  <th scope="col">Dispatched</th>
                  <th scope="col">Received</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.productSku}</td>
                    <td>{l.variantSku ?? "—"}</td>
                    <td>{l.quantity}</td>
                    <td>{l.received_qty}</td>
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
              action={addTransferLineAction}
              submitLabel="Add line"
              successMessage="Line added."
              className="stack"
            >
              <input type="hidden" name="transferId" value={transfer.id} />
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
                Quantity
                <input name="quantity" type="number" min={1} step={1} required />
              </label>
            </ActionForm>
          </details>
        )}
      </div>

      {canManage && isDraft && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Transfer actions</h2>
          <ActionForm
            action={dispatchTransferAction}
            submitLabel="Dispatch"
            successMessage="Dispatched."
            confirmMessage="Dispatch this transfer? Stock leaves the source warehouse immediately."
            className="row"
          >
            <input type="hidden" name="transferId" value={transfer.id} />
          </ActionForm>
          <details style={{ marginTop: "0.75rem" }}>
            <summary>Cancel transfer</summary>
            <ActionForm
              action={cancelTransferAction}
              submitLabel="Cancel transfer"
              buttonClassName="danger"
              className="row"
            >
              <input type="hidden" name="transferId" value={transfer.id} />
              <label>
                Reason
                <input name="reason" required minLength={3} />
              </label>
            </ActionForm>
          </details>
        </div>
      )}

      {canReceive && isDispatched && lines.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Receive at {transfer.toCode}</h2>
          <p className="empty">
            Record what actually arrived. Receiving less than was dispatched is
            allowed — the difference stays visible as a discrepancy between the
            two numbers.
          </p>
          <ActionForm
            action={receiveTransferAction}
            submitLabel="Receive transfer"
            successMessage="Received."
            className="stack"
          >
            <input type="hidden" name="transferId" value={transfer.id} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Dispatched</th>
                    <th scope="col">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.productSku}
                        <input type="hidden" name="lineId" value={l.id} />
                      </td>
                      <td>{l.quantity}</td>
                      <td>
                        <input
                          name={`received_${l.id}`}
                          type="number"
                          min={0}
                          max={l.quantity}
                          step={1}
                          defaultValue={l.quantity}
                          aria-label={`Received quantity for ${l.productSku}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ActionForm>
        </div>
      )}
    </div>
  );
}

import { ActionForm } from "@/components/action-form";
import { createLocationAction, postMovementAction } from "@/server/actions/inventory";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import {
  listBalances,
  listLocations,
  listWarehouses,
} from "@/server/services/inventory";
import { listCompanies } from "@/server/services/organization";
import { listProducts } from "@/server/services/products";

export const dynamic = "force-dynamic";

/**
 * Current stock per warehouse, and the forms for the movements a human
 * posts by hand. Every quantity here is derived from the ledger — nothing
 * on this page writes a balance directly, because nothing can.
 */
export default async function InventoryPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.inventoryView,
      companyId: company.id,
    });
    if (!canView) continue;

    const [balances, warehouses, locations, canPost, canOverride, canLocations] =
      await Promise.all([
        listBalances(company.id),
        listWarehouses(company.id),
        listLocations(company.id),
        hasPermission({
          permission: PERMISSIONS.inventoryMovementPost,
          companyId: company.id,
        }),
        hasPermission({
          permission: PERMISSIONS.inventoryNegativeOverride,
          companyId: company.id,
        }),
        hasPermission({
          permission: PERMISSIONS.inventoryLocationManage,
          companyId: company.id,
        }),
      ]);

    let products: Awaited<ReturnType<typeof listProducts>> = [];
    if (canPost) {
      try {
        products = await listProducts(company.id);
      } catch (err) {
        if (!(err instanceof ServiceError && err.code === "forbidden")) throw err;
      }
    }

    sections.push({
      company,
      balances,
      warehouses,
      locations,
      canPost,
      canOverride,
      canLocations,
      products: products.filter((p) => p.status !== "archived"),
    });
  }

  if (sections.length === 0) {
    return <p className="empty">You have no stock access.</p>;
  }

  return (
    <div>
      {sections.map(
        ({ company, balances, warehouses, locations, canPost, canOverride, canLocations, products }) => (
          <div className="card" key={company.id}>
            <h2 style={{ marginTop: 0 }}>
              {company.name} <span className="badge">{company.code}</span>
            </h2>

            {warehouses.length === 0 ? (
              <p className="empty">
                This company has no active warehouses. Create one in
                Administration → Organization before recording stock.
              </p>
            ) : balances.length === 0 ? (
              <p className="empty">
                No stock recorded yet. Post opening stock below, or receive a
                purchase order.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Warehouse</th>
                      <th scope="col">Product</th>
                      <th scope="col">Variant</th>
                      <th scope="col">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b) => (
                      <tr key={b.id}>
                        <td>{b.warehouseCode}</td>
                        <td>
                          {b.productSku} — {b.productName}
                        </td>
                        <td>{b.variantSku ?? "—"}</td>
                        <td>
                          <strong className={b.quantity < 0 ? "msg-error" : undefined}>
                            {b.quantity}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canPost && warehouses.length > 0 && (
              <details style={{ marginTop: "1rem" }}>
                <summary>Post a stock movement</summary>
                <ActionForm
                  action={postMovementAction}
                  submitLabel="Post movement"
                  successMessage="Movement posted."
                  className="stack"
                >
                  <input type="hidden" name="companyId" value={company.id} />
                  <label>
                    Warehouse
                    <select name="warehouseId" required defaultValue="">
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
                  <label>
                    Product
                    {products.length === 0 ? (
                      <p className="empty">No selectable products in this company.</p>
                    ) : (
                      <select name="productId" required defaultValue="">
                        <option value="" disabled>
                          Choose a product
                        </option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                  <label>
                    Movement
                    <select name="txnType" required defaultValue="opening_stock">
                      <option value="opening_stock">Opening stock (adds)</option>
                      <option value="damage">Damage (removes)</option>
                      <option value="supplier_return">Return to supplier (removes)</option>
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input name="quantity" type="number" min={1} step={1} required />
                  </label>
                  <label>
                    Reason
                    <input name="reason" required minLength={3} maxLength={500} />
                  </label>
                  {canOverride && (
                    <label className="row">
                      <input type="checkbox" name="allowNegative" />
                      Allow the balance to go below zero (recorded as an override)
                    </label>
                  )}
                </ActionForm>
              </details>
            )}

            {canLocations && warehouses.length > 0 && (
              <details style={{ marginTop: "0.75rem" }}>
                <summary>Locations ({locations.length})</summary>
                {locations.length > 0 && (
                  <ul>
                    {locations.map((l) => (
                      <li key={l.id}>
                        {l.warehouseCode} / {l.code} — {l.name}{" "}
                        <span className={`badge status-${l.status}`}>{l.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <ActionForm
                  action={createLocationAction}
                  submitLabel="Add location"
                  successMessage="Location added."
                  className="stack"
                >
                  <label>
                    Warehouse
                    <select name="warehouseId" required defaultValue="">
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
                  <label>
                    Code
                    <input name="code" required maxLength={30} placeholder="A1" />
                  </label>
                  <label>
                    Name
                    <input name="name" required maxLength={120} placeholder="Aisle 1, rack A" />
                  </label>
                </ActionForm>
              </details>
            )}
          </div>
        ),
      )}
    </div>
  );
}

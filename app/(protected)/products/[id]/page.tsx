import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import {
  createVariantAction,
  removeProductImageAction,
  setProductStatusAction,
  setVariantStatusAction,
  updateProductAction,
  uploadProductImageAction,
  upsertIntelligenceAction,
} from "@/server/actions/products";
import { ServiceError } from "@/server/errors";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listCatalog } from "@/server/services/catalog";
import { listProductImages } from "@/server/services/product-images";
import { getIntelligence, getProductDetail } from "@/server/services/products";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  let detail;
  try {
    detail = await getProductDetail(id);
  } catch (err) {
    if (err instanceof ServiceError && err.code === "not_found") notFound();
    throw err;
  }
  const { product, category, unit, variants } = detail;

  const [catalog, images, canUpdate, canArchive, canIntelligence, canCreate] =
    await Promise.all([
      listCatalog(product.company_id),
      listProductImages(product.id),
      hasPermission({
        permission: PERMISSIONS.productsUpdate,
        companyId: product.company_id,
      }),
      hasPermission({
        permission: PERMISSIONS.productsArchive,
        companyId: product.company_id,
      }),
      hasPermission({
        permission: PERMISSIONS.productsIntelligenceView,
        companyId: product.company_id,
      }),
      hasPermission({
        permission: PERMISSIONS.productsCreate,
        companyId: product.company_id,
      }),
    ]);

  // The read itself is permission-gated and audited inside the service.
  const intelligence = canIntelligence ? await getIntelligence(product.id) : null;

  const activeAttributes = catalog.attributes.filter((a) => a.status === "active");

  return (
    <div>
      <p>
        <Link href="/products">← All products</Link>
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {product.name}{" "}
          <span className="badge">{product.sku}</span>{" "}
          <span className={`badge status-${product.status}`}>{product.status}</span>
        </h2>
        <p className="muted">
          Category: {category ? `${category.name} (${category.code})` : "—"} ·
          Unit: {unit ? `${unit.name} (${unit.code})` : "—"}
        </p>
        {product.description && <p>{product.description}</p>}

        {canUpdate && product.status !== "archived" && (
          <details>
            <summary>Edit product</summary>
            <ActionForm
              action={updateProductAction}
              submitLabel="Save changes"
              successMessage="Product updated."
              className="stack"
            >
              <input type="hidden" name="productId" value={product.id} />
              <label>
                Name
                <input name="name" required maxLength={200} defaultValue={product.name} />
              </label>
              <div className="row">
                <label>
                  Category
                  <select name="categoryId" defaultValue={product.category_id ?? ""}>
                    <option value="">—</option>
                    {catalog.categories
                      .filter((c) => c.status === "active" || c.id === product.category_id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Unit
                  <select name="unitId" defaultValue={product.unit_id ?? ""}>
                    <option value="">—</option>
                    {catalog.units
                      .filter((u) => u.status === "active" || u.id === product.unit_id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code})
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label>
                Description
                <textarea
                  name="description"
                  rows={2}
                  maxLength={5000}
                  defaultValue={product.description ?? ""}
                />
              </label>
            </ActionForm>
          </details>
        )}

        {product.status === "draft" && canUpdate && (
          <ActionForm
            action={setProductStatusAction}
            submitLabel="Activate product"
            confirmMessage={`Activate ${product.sku}? It becomes usable across the system.`}
            successMessage="Product activated."
            className="row"
          >
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="status" value="active" />
            <label>
              Reason
              <input name="reason" required minLength={3} />
            </label>
          </ActionForm>
        )}
        {product.status === "active" && canArchive && (
          <ActionForm
            action={setProductStatusAction}
            submitLabel="Archive product"
            confirmMessage={`Archive ${product.sku}? Its variants are archived with it.`}
            successMessage="Product archived."
            buttonClassName="danger"
            className="row"
          >
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="status" value="archived" />
            <label>
              Reason
              <input name="reason" required minLength={3} />
            </label>
          </ActionForm>
        )}
        {product.status === "archived" && canUpdate && (
          <ActionForm
            action={setProductStatusAction}
            submitLabel="Reactivate product"
            confirmMessage={`Reactivate ${product.sku}?`}
            successMessage="Product reactivated."
            className="row"
          >
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="status" value="active" />
            <label>
              Reason
              <input name="reason" required minLength={3} />
            </label>
          </ActionForm>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Variants</h2>
        {variants.length === 0 ? (
          <p className="empty">No variants yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Variant SKU</th>
                  <th scope="col">Attributes</th>
                  <th scope="col">Status</th>
                  {(canUpdate || canArchive) && <th scope="col">Manage</th>}
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td>{v.sku}</td>
                    <td>
                      {v.attributes.length === 0
                        ? "—"
                        : v.attributes
                            .map((a) => `${a.attributeName}: ${a.value}`)
                            .join(", ")}
                    </td>
                    <td>
                      <span className={`badge status-${v.status}`}>{v.status}</span>
                    </td>
                    {(canUpdate || canArchive) && (
                      <td>
                        {v.status === "draft" && canUpdate && (
                          <ActionForm
                            action={setVariantStatusAction}
                            submitLabel="Activate"
                            successMessage="Variant activated."
                            className="row"
                          >
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="variantId" value={v.id} />
                            <input type="hidden" name="status" value="active" />
                            <input type="hidden" name="reason" value="Activated from product page" />
                          </ActionForm>
                        )}
                        {v.status === "active" && canArchive && (
                          <details>
                            <summary>Archive</summary>
                            <ActionForm
                              action={setVariantStatusAction}
                              submitLabel="Archive variant"
                              confirmMessage={`Archive variant ${v.sku}?`}
                              buttonClassName="danger"
                              className="stack"
                            >
                              <input type="hidden" name="productId" value={product.id} />
                              <input type="hidden" name="variantId" value={v.id} />
                              <input type="hidden" name="status" value="archived" />
                              <label>
                                Reason
                                <input name="reason" required minLength={3} />
                              </label>
                            </ActionForm>
                          </details>
                        )}
                        {v.status === "archived" && canUpdate && product.status !== "archived" && (
                          <ActionForm
                            action={setVariantStatusAction}
                            submitLabel="Reactivate"
                            successMessage="Variant reactivated."
                            className="row"
                          >
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="variantId" value={v.id} />
                            <input type="hidden" name="status" value="active" />
                            <input type="hidden" name="reason" value="Reactivated from product page" />
                          </ActionForm>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canCreate && product.status !== "archived" && (
          <details style={{ marginTop: "1rem" }}>
            <summary>Add variant</summary>
            <ActionForm
              action={createVariantAction}
              submitLabel="Add variant"
              successMessage="Variant added (status: draft)."
              className="stack"
            >
              <input type="hidden" name="productId" value={product.id} />
              <label>
                Variant SKU
                <input
                  name="sku"
                  required
                  placeholder={`${product.sku}-BLK-M`}
                  style={{ textTransform: "uppercase" }}
                />
              </label>
              {activeAttributes.map((a) => (
                <label key={a.id}>
                  {a.name}
                  <select name="attributeValueIds" defaultValue="">
                    <option value="">—</option>
                    {a.values
                      .filter((v) => v.status === "active")
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.value}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              {activeAttributes.length === 0 && (
                <p className="muted">
                  No attributes defined yet — add them under Products → Catalog
                  to give variants structured values (size, color, …).
                </p>
              )}
            </ActionForm>
          </details>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Images</h2>
        {images.length === 0 ? (
          <p className="empty">No images.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Preview</th>
                  <th scope="col">Name</th>
                  <th scope="col">Tier</th>
                  {canUpdate && <th scope="col">Manage</th>}
                </tr>
              </thead>
              <tbody>
                {images.map((img) => (
                  <tr key={img.id}>
                    <td>
                      {/* Signed URL expires in 300s — plain img, no optimizer cache. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.originalName}
                        style={{ maxWidth: "96px", maxHeight: "96px" }}
                      />
                    </td>
                    <td>{img.originalName}</td>
                    <td>
                      <span className="badge">{img.tier}</span>
                    </td>
                    {canUpdate && (
                      <td>
                        <ActionForm
                          action={removeProductImageAction}
                          submitLabel="Remove"
                          confirmMessage="Remove this image?"
                          buttonClassName="danger"
                          className="row"
                        >
                          <input type="hidden" name="productId" value={product.id} />
                          <input type="hidden" name="imageId" value={img.id} />
                        </ActionForm>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canUpdate && product.status !== "archived" && (
          <details style={{ marginTop: "1rem" }}>
            <summary>Upload image</summary>
            <ActionForm
              action={uploadProductImageAction}
              submitLabel="Upload"
              successMessage="Image uploaded."
              className="stack"
            >
              <input type="hidden" name="productId" value={product.id} />
              <label>
                File
                <input type="file" name="file" accept="image/*" required />
              </label>
              <label>
                Tier
                <select name="tier" defaultValue="public">
                  <option value="public">Public (visible to all company users)</option>
                  {canIntelligence && (
                    <option value="confidential">
                      Confidential (intelligence permission only)
                    </option>
                  )}
                </select>
              </label>
              <label>
                Variant (optional)
                <select name="variantId" defaultValue="">
                  <option value="">Whole product</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku}
                    </option>
                  ))}
                </select>
              </label>
            </ActionForm>
          </details>
        )}
      </div>

      {canIntelligence && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Confidential intelligence</h2>
          <p className="muted">
            Restricted to holders of the intelligence permission. Every view of
            this panel is recorded in the audit log.
          </p>
          {canUpdate && product.status !== "archived" ? (
            <ActionForm
              action={upsertIntelligenceAction}
              submitLabel="Save intelligence"
              successMessage="Intelligence saved."
              className="stack"
            >
              <input type="hidden" name="productId" value={product.id} />
              <label>
                Sourcing notes
                <textarea
                  name="sourcingNotes"
                  rows={3}
                  maxLength={5000}
                  defaultValue={intelligence?.sourcing_notes ?? ""}
                />
              </label>
              <div className="row">
                <label>
                  Target cost
                  <input
                    name="targetCost"
                    inputMode="decimal"
                    placeholder="142.50"
                    defaultValue={intelligence?.target_cost ?? ""}
                  />
                </label>
                <label>
                  Currency
                  <input
                    name="targetCostCurrency"
                    maxLength={3}
                    placeholder="BDT"
                    style={{ textTransform: "uppercase" }}
                    defaultValue={intelligence?.target_cost_currency ?? ""}
                  />
                </label>
              </div>
              <label>
                Remarks
                <textarea
                  name="remarks"
                  rows={2}
                  maxLength={5000}
                  defaultValue={intelligence?.remarks ?? ""}
                />
              </label>
            </ActionForm>
          ) : (
            <div>
              <p>
                <strong>Sourcing notes:</strong>{" "}
                {intelligence?.sourcing_notes || "—"}
              </p>
              <p>
                <strong>Target cost:</strong>{" "}
                {intelligence?.target_cost !== null && intelligence?.target_cost !== undefined
                  ? `${intelligence.target_cost} ${intelligence.target_cost_currency ?? ""}`
                  : "—"}
              </p>
              <p>
                <strong>Remarks:</strong> {intelligence?.remarks || "—"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

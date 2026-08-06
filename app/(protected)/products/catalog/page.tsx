import { ActionForm } from "@/components/action-form";
import {
  archiveCatalogAction,
  createAttributeAction,
  createAttributeValueAction,
  createCategoryAction,
  createUnitAction,
} from "@/server/actions/products";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listCatalog } from "@/server/services/catalog";
import { listCompanies } from "@/server/services/organization";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canManage = await hasPermission({
      permission: PERMISSIONS.productsCatalogManage,
      companyId: company.id,
    });
    const canView = await hasPermission({
      permission: PERMISSIONS.productsView,
      companyId: company.id,
    });
    if (!canView) continue;
    sections.push({
      company,
      catalog: await listCatalog(company.id),
      canManage,
    });
  }

  if (sections.length === 0) {
    return <p className="empty">No companies in your product scope.</p>;
  }

  return (
    <div>
      {sections.map(({ company, catalog, canManage }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>

          <section className="subsection">
          <h3>Units</h3>
          {catalog.units.length === 0 ? (
            <p className="empty">None yet.</p>
          ) : (
            <ul>
              {catalog.units.map((u) => (
                <li key={u.id}>
                  {/* Code first, matching the form's field order. */}
                  <span className="badge">{u.code}</span> {u.name}{" "}
                  <span className={`badge status-${u.status}`}>{u.status}</span>
                  {canManage && u.status === "active" && (
                    <details>
                      <summary>Archive {u.code}</summary>
                      <ActionForm
                        action={archiveCatalogAction}
                        submitLabel="Archive unit"
                        buttonClassName="danger"
                        className="row"
                      >
                        <input type="hidden" name="kind" value="unit" />
                        <input type="hidden" name="id" value={u.id} />
                        <label>
                          Reason
                          <input name="reason" required minLength={3} />
                        </label>
                      </ActionForm>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <ActionForm
              action={createUnitAction}
              submitLabel="Add unit"
              successMessage="Unit created."
              className="row"
            >
              <input type="hidden" name="companyId" value={company.id} />
              <label>
                Code
                <input name="code" required placeholder="PCS" style={{ textTransform: "uppercase" }} />
              </label>
              <label>
                Name
                <input name="name" required placeholder="Pieces" />
              </label>
            </ActionForm>
          )}
          </section>

          <section className="subsection">
          <h3>Categories</h3>
          {catalog.categories.length === 0 ? (
            <p className="empty">None yet.</p>
          ) : (
            <ul>
              {catalog.categories.map((c) => (
                <li key={c.id}>
                  {c.parent_id && "↳ "}
                  <span className="badge">{c.code}</span> {c.name}{" "}
                  <span className={`badge status-${c.status}`}>{c.status}</span>
                  {canManage && c.status === "active" && (
                    <details>
                      <summary>Archive {c.code}</summary>
                      <ActionForm
                        action={archiveCatalogAction}
                        submitLabel="Archive category"
                        buttonClassName="danger"
                        className="row"
                      >
                        <input type="hidden" name="kind" value="category" />
                        <input type="hidden" name="id" value={c.id} />
                        <label>
                          Reason
                          <input name="reason" required minLength={3} />
                        </label>
                      </ActionForm>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <ActionForm
              action={createCategoryAction}
              submitLabel="Add category"
              successMessage="Category created."
              className="row"
            >
              <input type="hidden" name="companyId" value={company.id} />
              <label>
                Code
                <input name="code" required placeholder="MENS-TSH" style={{ textTransform: "uppercase" }} />
              </label>
              <label>
                Name
                <input name="name" required placeholder="T-Shirts" />
              </label>
              <label>
                Parent (optional)
                <select name="parentId" defaultValue="">
                  <option value="">—</option>
                  {catalog.categories
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </label>
            </ActionForm>
          )}
          </section>

          <section className="subsection">
          <h3>Attributes</h3>
          {catalog.attributes.length === 0 ? (
            <p className="empty">None yet.</p>
          ) : (
            <ul>
              {catalog.attributes.map((a) => (
                <li key={a.id}>
                  <span className="badge">{a.code}</span> {a.name}{" "}
                  <span className={`badge status-${a.status}`}>{a.status}</span>
                  <br />
                  <span className="muted">
                    Values:{" "}
                    {a.values.length === 0
                      ? "none"
                      : a.values.map((v) => v.value).join(", ")}
                  </span>
                  {canManage && a.status === "active" && (
                    <>
                      <ActionForm
                        action={createAttributeValueAction}
                        submitLabel="Add value"
                        successMessage="Value added."
                        className="row"
                      >
                        <input type="hidden" name="attributeId" value={a.id} />
                        <label>
                          New value
                          <input name="value" required maxLength={80} placeholder="XL" />
                        </label>
                      </ActionForm>
                      <details>
                        <summary>Archive {a.code}</summary>
                        <ActionForm
                          action={archiveCatalogAction}
                          submitLabel="Archive attribute"
                          buttonClassName="danger"
                          className="row"
                        >
                          <input type="hidden" name="kind" value="attribute" />
                          <input type="hidden" name="id" value={a.id} />
                          <label>
                            Reason
                            <input name="reason" required minLength={3} />
                          </label>
                        </ActionForm>
                      </details>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <ActionForm
              action={createAttributeAction}
              submitLabel="Add attribute"
              successMessage="Attribute created."
              className="row"
            >
              <input type="hidden" name="companyId" value={company.id} />
              <label>
                Code
                <input name="code" required placeholder="SIZE" style={{ textTransform: "uppercase" }} />
              </label>
              <label>
                Name
                <input name="name" required placeholder="Size" />
              </label>
            </ActionForm>
          )}
          </section>
        </div>
      ))}
    </div>
  );
}

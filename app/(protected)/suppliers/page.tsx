import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createSupplierAction } from "@/server/actions/suppliers";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listCompanies } from "@/server/services/organization";
import { listSuppliers } from "@/server/services/suppliers";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canView = await hasPermission({
      permission: PERMISSIONS.suppliersView,
      companyId: company.id,
    });
    if (!canView) continue;
    const [suppliers, canManage] = await Promise.all([
      listSuppliers(company.id),
      hasPermission({
        permission: PERMISSIONS.suppliersManage,
        companyId: company.id,
      }),
    ]);
    sections.push({ company, suppliers, canManage });
  }

  if (sections.length === 0) {
    return <p className="empty">No companies in your supplier scope.</p>;
  }

  return (
    <div>
      {sections.map(({ company, suppliers, canManage }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>

          {suppliers.length === 0 ? (
            <p className="empty">No suppliers yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Name</th>
                    <th scope="col">Country</th>
                    <th scope="col">Capabilities</th>
                    <th scope="col">Contacts</th>
                    <th scope="col">Active quotes</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/suppliers/${s.id}`}>{s.code}</Link>
                      </td>
                      <td>{s.name}</td>
                      <td>{s.country}</td>
                      <td>{s.capabilities ?? "—"}</td>
                      <td>{s.contactCount}</td>
                      <td>{s.quotationCount}</td>
                      <td>
                        <span className={`badge status-${s.status}`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManage && (
            <details style={{ marginTop: "1rem" }}>
              <summary>New supplier</summary>
              <ActionForm
                action={createSupplierAction}
                submitLabel="Create supplier"
                successMessage="Supplier created."
                className="stack"
              >
                <input type="hidden" name="companyId" value={company.id} />
                <div className="row">
                  <label>
                    Code
                    <input
                      name="code"
                      required
                      placeholder="SUP-CN-001"
                      style={{ textTransform: "uppercase" }}
                    />
                  </label>
                  <label>
                    Name
                    <input name="name" required maxLength={200} placeholder="Guangzhou Textile Co." />
                  </label>
                  <label>
                    Country
                    <select name="country" defaultValue="BD">
                      <option value="BD">Bangladesh (BD)</option>
                      <option value="CN">China (CN)</option>
                      <option value="IN">India (IN)</option>
                      <option value="VN">Vietnam (VN)</option>
                      <option value="TR">Türkiye (TR)</option>
                    </select>
                  </label>
                </div>
                <label>
                  Capabilities
                  <input
                    name="capabilities"
                    maxLength={500}
                    placeholder="Knitwear, printing, embroidery"
                  />
                </label>
                <label>
                  Address
                  <input name="address" maxLength={500} />
                </label>
                <label>
                  Notes
                  <textarea name="notes" rows={2} maxLength={2000} />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

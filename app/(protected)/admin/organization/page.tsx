import { ActionForm } from "@/components/action-form";
import {
  archiveEntityAction,
  createBranchAction,
  createCompanyAction,
  createDepartmentAction,
  createWarehouseAction,
  updateCompanyAction,
} from "@/server/actions/organization";
import { getAccessContext, PERMISSIONS } from "@/server/permissions";
import { evaluatePermission } from "@/server/permissions/evaluate";
import {
  listCompanies,
  listCompanyChildren,
} from "@/server/services/organization";
import type { Tables } from "@/types/database";

export const dynamic = "force-dynamic";

function ArchiveForm(props: {
  kind: "company" | "branch" | "warehouse" | "department";
  id: string;
  label: string;
}) {
  return (
    <details>
      <summary>Archive {props.label}</summary>
      <ActionForm
        action={archiveEntityAction}
        submitLabel={`Archive ${props.kind}`}
        confirmMessage={`Archive ${props.label}? This is a controlled status change, not a delete.`}
        buttonClassName="danger"
        className="row"
      >
        <input type="hidden" name="kind" value={props.kind} />
        <input type="hidden" name="id" value={props.id} />
        <label>
          Reason
          <input name="reason" required minLength={3} maxLength={500} />
        </label>
      </ActionForm>
    </details>
  );
}

function ChildTable(props: {
  title: string;
  rows: { id: string; code: string; name: string; status: string }[];
  kind: "branch" | "warehouse" | "department";
  canManage: boolean;
}) {
  return (
    <div>
      <h3>{props.title}</h3>
      {props.rows.length === 0 ? (
        <p className="empty">None yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                {props.canManage && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.code}</td>
                  <td>{r.name}</td>
                  <td>
                    <span className={`badge status-${r.status}`}>{r.status}</span>
                  </td>
                  {props.canManage && (
                    <td>
                      {r.status === "active" && (
                        <ArchiveForm kind={props.kind} id={r.id} label={r.code} />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function CompanyCard({ company }: { company: Tables<"companies"> }) {
  const ctx = await getAccessContext();
  const can = (permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) =>
    evaluatePermission(ctx, { permission, companyId: company.id }).allowed;

  const children = await listCompanyChildren(company.id);
  const canUpdate = can(PERMISSIONS.companyUpdate);
  const canArchive = can(PERMISSIONS.companyArchive);
  const canBranch = can(PERMISSIONS.branchManage);
  const canWarehouse = can(PERMISSIONS.warehouseManage);
  const canDepartment = can(PERMISSIONS.departmentManage);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>
        {company.name}{" "}
        <span className="badge">{company.code}</span>{" "}
        <span className="badge">{company.base_currency}</span>{" "}
        <span className="badge">{company.timezone}</span>{" "}
        <span className={`badge status-${company.status}`}>{company.status}</span>
      </h2>

      {canUpdate && company.status === "active" && (
        <details>
          <summary>Edit company</summary>
          <ActionForm
            action={updateCompanyAction}
            submitLabel="Save changes"
            successMessage="Company updated."
            className="row"
          >
            <input type="hidden" name="companyId" value={company.id} />
            <label>
              Name
              <input name="name" defaultValue={company.name} required />
            </label>
            <label>
              Base currency
              <input
                name="baseCurrency"
                defaultValue={company.base_currency}
                pattern="[A-Za-z]{3}"
                required
              />
            </label>
            <label>
              Timezone
              <input name="timezone" defaultValue={company.timezone} required />
            </label>
          </ActionForm>
        </details>
      )}
      {canArchive && company.status === "active" && (
        <ArchiveForm kind="company" id={company.id} label={company.code} />
      )}

      <ChildTable
        title="Branches"
        rows={children.branches}
        kind="branch"
        canManage={canBranch}
      />
      {canBranch && company.status === "active" && (
        <ActionForm
          action={createBranchAction}
          submitLabel="Add branch"
          successMessage="Branch created."
          className="row"
        >
          <input type="hidden" name="companyId" value={company.id} />
          <label>
            Code
            <input name="code" placeholder="MAIN" required />
          </label>
          <label>
            Name
            <input name="name" placeholder="Main branch" required />
          </label>
        </ActionForm>
      )}

      <ChildTable
        title="Warehouses"
        rows={children.warehouses}
        kind="warehouse"
        canManage={canWarehouse}
      />
      {canWarehouse && company.status === "active" && (
        <ActionForm
          action={createWarehouseAction}
          submitLabel="Add warehouse"
          successMessage="Warehouse created."
          className="row"
        >
          <input type="hidden" name="companyId" value={company.id} />
          <label>
            Code
            <input name="code" placeholder="WH1" required />
          </label>
          <label>
            Name
            <input name="name" placeholder="Central warehouse" required />
          </label>
          <label>
            Branch (optional)
            <select name="branchId" defaultValue="">
              <option value="">—</option>
              {children.branches
                .filter((b) => b.status === "active")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
            </select>
          </label>
        </ActionForm>
      )}

      <ChildTable
        title="Departments"
        rows={children.departments}
        kind="department"
        canManage={canDepartment}
      />
      {canDepartment && company.status === "active" && (
        <ActionForm
          action={createDepartmentAction}
          submitLabel="Add department"
          successMessage="Department created."
          className="row"
        >
          <input type="hidden" name="companyId" value={company.id} />
          <label>
            Code
            <input name="code" placeholder="OPS" required />
          </label>
          <label>
            Name
            <input name="name" placeholder="Operations" required />
          </label>
          <label>
            Branch (optional)
            <select name="branchId" defaultValue="">
              <option value="">—</option>
              {children.branches
                .filter((b) => b.status === "active")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
            </select>
          </label>
        </ActionForm>
      )}
    </div>
  );
}

export default async function OrganizationAdminPage() {
  const [companies, ctx] = await Promise.all([
    listCompanies(),
    getAccessContext(),
  ]);
  const canCreateCompany = ctx.roleGrants.some(
    (g) =>
      g.companyId === null &&
      g.permissions.includes(PERMISSIONS.companyCreate),
  );

  return (
    <div>
      {canCreateCompany && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>New company</h2>
          <ActionForm
            action={createCompanyAction}
            submitLabel="Create company"
            successMessage="Company created."
            className="row"
          >
            <label>
              Code
              <input name="code" placeholder="ELIZA_SOURCE" required />
            </label>
            <label>
              Name
              <input name="name" placeholder="Eliza Source" required />
            </label>
            <label>
              Base currency
              <input name="baseCurrency" placeholder="BDT" pattern="[A-Za-z]{3}" required />
            </label>
            <label>
              Timezone
              <input name="timezone" defaultValue="Asia/Dhaka" required />
            </label>
          </ActionForm>
        </div>
      )}

      {companies.length === 0 ? (
        <p className="empty">No companies in your scope.</p>
      ) : (
        companies.map((c) => <CompanyCard key={c.id} company={c} />)
      )}
    </div>
  );
}

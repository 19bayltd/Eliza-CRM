import { ActionForm } from "@/components/action-form";
import {
  importApplyAction,
  importDiscardAction,
  importValidateAction,
} from "@/server/actions/products";
import { hasPermission, PERMISSIONS } from "@/server/permissions";
import { listCompanies } from "@/server/services/organization";
import {
  listImportIssues,
  listImportJobs,
} from "@/server/services/product-import";
import { IMPORT_COLUMNS } from "@/server/validation/products";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const companies = await listCompanies();
  const sections = [];
  for (const company of companies) {
    const canImport = await hasPermission({
      permission: PERMISSIONS.productsImport,
      companyId: company.id,
    });
    if (!canImport) continue;
    const jobs = await listImportJobs(company.id);
    const issuesByJob = new Map<string, Awaited<ReturnType<typeof listImportIssues>>>();
    for (const job of jobs
      .filter((j) => j.status === "validated" || j.status === "applied")
      .slice(0, 3)) {
      issuesByJob.set(job.id, await listImportIssues(job.id));
    }
    sections.push({ company, jobs, issuesByJob });
  }

  if (sections.length === 0) {
    return <p className="empty">You do not hold the import permission in any company.</p>;
  }

  return (
    <div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>CSV template</h2>
        <p className="muted">
          Header row (any column order): <code>{IMPORT_COLUMNS.join(",")}</code>.
          One row per product or per variant (repeat the product columns).
          Validation previews everything; nothing is written until you apply.
        </p>
      </div>

      {sections.map(({ company, jobs, issuesByJob }) => (
        <div className="card" key={company.id}>
          <h2 style={{ marginTop: 0 }}>
            {company.name} <span className="badge">{company.code}</span>
          </h2>

          <ActionForm
            action={importValidateAction}
            submitLabel="Validate CSV"
            successMessage="Validated — review the plan below, then apply."
            className="stack"
          >
            <input type="hidden" name="companyId" value={company.id} />
            <label>
              CSV file
              <input type="file" name="file" accept=".csv,text/csv" required />
            </label>
          </ActionForm>

          <h3>Import jobs</h3>
          {jobs.length === 0 ? (
            <p className="empty">No imports yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">File</th>
                    <th scope="col">When (UTC)</th>
                    <th scope="col">Status</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td>{job.filename}</td>
                      <td>{job.created_at.slice(0, 19).replace("T", " ")}</td>
                      <td>
                        <span className={`badge status-${job.status}`}>{job.status}</span>
                      </td>
                      <td>
                        {job.rows_total} rows: {job.rows_create} create,{" "}
                        {job.rows_update} update, {job.rows_reject} reject
                      </td>
                      <td>
                        {job.status === "validated" && (
                          <>
                            <ActionForm
                              action={importApplyAction}
                              submitLabel="Apply"
                              confirmMessage={`Apply ${job.filename}? ${job.rows_create} creations and ${job.rows_update} updates will be written; ${job.rows_reject} rejected rows are skipped.`}
                              successMessage="Import applied."
                              className="row"
                            >
                              <input type="hidden" name="jobId" value={job.id} />
                            </ActionForm>
                            <ActionForm
                              action={importDiscardAction}
                              submitLabel="Discard"
                              confirmMessage="Discard this validated import?"
                              buttonClassName="danger"
                              className="row"
                            >
                              <input type="hidden" name="jobId" value={job.id} />
                            </ActionForm>
                          </>
                        )}
                        {(issuesByJob.get(job.id) ?? []).length > 0 && (
                          <details>
                            <summary>
                              {issuesByJob.get(job.id)!.length}{" "}
                              {job.status === "applied"
                                ? "row issue(s)"
                                : "rejected row(s)"}
                            </summary>
                            <ul>
                              {issuesByJob.get(job.id)!.map((row) => (
                                <li key={row.id}>
                                  Row {row.row_number}:{" "}
                                  {row.message ?? row.planned_action}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

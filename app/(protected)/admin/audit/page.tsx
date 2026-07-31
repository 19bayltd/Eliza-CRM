import { listAuditEvents } from "@/server/services/audit-view";
import { listCompanies } from "@/server/services/organization";

export const dynamic = "force-dynamic";

export default async function AuditAdminPage(props: {
  searchParams: Promise<{ companyId?: string; module?: string }>;
}) {
  const searchParams = await props.searchParams;
  const [events, companies] = await Promise.all([
    listAuditEvents({
      companyId: searchParams.companyId || undefined,
      module: searchParams.module || undefined,
      limit: 100,
    }),
    listCompanies(),
  ]);
  const companyCode = new Map(companies.map((c) => [c.id, c.code]));
  const modules = ["auth", "organization", "storage", "audit"];

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Audit log</h2>
      <p className="muted">
        Append-only record of sensitive actions. Showing the {events.length}{" "}
        most recent events in your scope
        {searchParams.companyId || searchParams.module ? " (filtered)" : ""}.
      </p>
      <form method="get" className="row">
        <label>
          Company
          <select name="companyId" defaultValue={searchParams.companyId ?? ""}>
            <option value="">All in scope</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Module
          <select name="module" defaultValue={searchParams.module ?? ""}>
            <option value="">All</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="secondary">
          Filter
        </button>
      </form>

      {events.length === 0 ? (
        <p className="empty">No audit events match.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Time (UTC)</th>
                <th scope="col">Actor</th>
                <th scope="col">Company</th>
                <th scope="col">Event</th>
                <th scope="col">Entity</th>
                <th scope="col">Result</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.occurred_at).toISOString().replace("T", " ").slice(0, 19)}</td>
                  <td>{e.actor_email ?? "system"}</td>
                  <td>{e.company_id ? (companyCode.get(e.company_id) ?? "…") : "—"}</td>
                  <td>
                    {e.module}.{e.action}
                  </td>
                  <td>
                    {e.entity_type ? `${e.entity_type} ${e.entity_id ?? ""}` : "—"}
                  </td>
                  <td>
                    <span
                      className={`badge ${e.result === "success" ? "status-active" : "status-suspended"}`}
                    >
                      {e.result}
                    </span>
                  </td>
                  <td>
                    {e.reason && <div className="muted">reason: {e.reason}</div>}
                    {e.failure_reason && (
                      <div className="muted">failure: {e.failure_reason}</div>
                    )}
                    {(e.previous_value !== null || e.new_value !== null) && (
                      <details>
                        <summary>values</summary>
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem" }}>
                          {JSON.stringify(
                            { previous: e.previous_value, new: e.new_value },
                            null,
                            1,
                          )}
                        </pre>
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
  );
}

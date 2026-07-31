import { listCompanies } from "@/server/services/organization";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const companies = await listCompanies();

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Your companies</h2>
        {companies.length === 0 ? (
          <p className="empty">
            No companies are in your scope yet. An administrator must grant
            you access.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Base currency</th>
                  <th scope="col">Timezone</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>{c.name}</td>
                    <td>{c.base_currency}</td>
                    <td>{c.timezone}</td>
                    <td>
                      <span className={`badge status-${c.status}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted">
        Module dashboards arrive with their phases. Phase 01 provides the
        secure platform foundation only.
      </p>
    </div>
  );
}

import { ActionForm } from "@/components/action-form";
import {
  assignRoleAction,
  deleteInvitationAction,
  grantCompanyScopeAction,
  inviteUserAction,
  resendInvitationAction,
  revokeCompanyScopeAction,
  revokeRoleAction,
  setAccountStatusAction,
} from "@/server/actions/users";
import { getAccessContext, PERMISSIONS } from "@/server/permissions";
import { listCompanies } from "@/server/services/organization";
import { listRoles, listUsers } from "@/server/services/users";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["active", "suspended", "locked", "disabled", "exited"] as const;

export default async function UsersAdminPage() {
  const [users, roles, companies, ctx] = await Promise.all([
    listUsers(),
    listRoles(),
    listCompanies(),
    getAccessContext(),
  ]);
  const grants = ctx.roleGrants.flatMap((g) => g.permissions);
  const canInvite = grants.includes(PERMISSIONS.usersInvite);
  const canSuspend = grants.includes(PERMISSIONS.usersSuspend);
  const canRoles = grants.includes(PERMISSIONS.usersRoleAssign);
  const canScopes = grants.includes(PERMISSIONS.usersScopeAssign);
  const companyByIdName = new Map(companies.map((c) => [c.id, c.code]));
  const assignableRoles = roles.filter((r) => r.key !== "owner");

  return (
    <div>
      {canInvite && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Invite user</h2>
          <p className="muted">
            Every operational user gets an individual account — shared
            accounts are prohibited.
          </p>
          <ActionForm
            action={inviteUserAction}
            submitLabel="Send invitation"
            successMessage="Invitation sent."
            className="row"
          >
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Full name
              <input name="fullName" required />
            </label>
            <label>
              Role
              <select name="roleKey" required defaultValue="employee">
                {assignableRoles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend className="muted">Companies</legend>
              {companies.map((c) => (
                <label
                  key={c.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: "0.35rem" }}
                >
                  <input type="checkbox" name="companyIds" value={c.id} />
                  {c.code}
                </label>
              ))}
            </fieldset>
          </ActionForm>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Users</h2>
        {users.length === 0 ? (
          <p className="empty">No users visible in your scope.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Status</th>
                  <th scope="col">Roles</th>
                  <th scope="col">Company scopes</th>
                  {(canSuspend || canRoles || canScopes) && (
                    <th scope="col">Manage</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.profile.id}>
                    <td>
                      <strong>{u.profile.full_name || "—"}</strong>
                      <br />
                      <span className="muted">{u.profile.email}</span>
                    </td>
                    <td>
                      <span className={`badge status-${u.profile.account_status}`}>
                        {u.profile.account_status}
                      </span>
                    </td>
                    <td>
                      {u.roles.length === 0 ? (
                        <span className="empty">none</span>
                      ) : (
                        u.roles.map((r) => (
                          <div key={r.userRoleId}>
                            <span className="badge">
                              {r.roleName}
                              {r.companyId
                                ? ` @ ${companyByIdName.get(r.companyId) ?? "?"}`
                                : " (global)"}
                            </span>
                            {canRoles && (
                              <ActionForm
                                action={revokeRoleAction}
                                submitLabel="Revoke"
                                confirmMessage={`Revoke ${r.roleName} from ${u.profile.email}?`}
                                buttonClassName="danger"
                                className="row"
                              >
                                <input
                                  type="hidden"
                                  name="userRoleId"
                                  value={r.userRoleId}
                                />
                              </ActionForm>
                            )}
                          </div>
                        ))
                      )}
                    </td>
                    <td>
                      {u.companyIds.length === 0 ? (
                        <span className="empty">none</span>
                      ) : (
                        u.companyIds.map((cid) => (
                          <div key={cid}>
                            <span className="badge">
                              {companyByIdName.get(cid) ?? cid}
                            </span>
                            {canScopes && (
                              <ActionForm
                                action={revokeCompanyScopeAction}
                                submitLabel="Revoke"
                                confirmMessage={`Remove ${u.profile.email} from ${companyByIdName.get(cid) ?? "company"}?`}
                                buttonClassName="danger"
                                className="row"
                              >
                                <input type="hidden" name="userId" value={u.profile.id} />
                                <input type="hidden" name="companyId" value={cid} />
                              </ActionForm>
                            )}
                          </div>
                        ))
                      )}
                    </td>
                    {(canSuspend || canRoles || canScopes) && (
                      <td>
                        {canInvite && u.profile.account_status === "invited" && (
                          <>
                            <ActionForm
                              action={resendInvitationAction}
                              submitLabel="Resend invitation"
                              successMessage="Invitation re-sent."
                              confirmMessage={`Send a fresh invitation email to ${u.profile.email}? The previous link will stop working.`}
                              className="row"
                            >
                              <input type="hidden" name="userId" value={u.profile.id} />
                            </ActionForm>
                            <ActionForm
                              action={deleteInvitationAction}
                              submitLabel="Delete invitation"
                              successMessage="Invitation deleted."
                              confirmMessage={`Delete the pending invitation for ${u.profile.email}? Their roles and scopes will be removed.`}
                              buttonClassName="danger"
                              className="row"
                            >
                              <input type="hidden" name="userId" value={u.profile.id} />
                            </ActionForm>
                          </>
                        )}
                        {canSuspend && (
                          <details>
                            <summary>Change status</summary>
                            <ActionForm
                              action={setAccountStatusAction}
                              submitLabel="Apply"
                              confirmMessage="Change this user's account status?"
                              className="stack"
                            >
                              <input type="hidden" name="userId" value={u.profile.id} />
                              <label>
                                New status
                                <select name="status" required>
                                  {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Reason
                                <input name="reason" required minLength={3} />
                              </label>
                            </ActionForm>
                          </details>
                        )}
                        {canRoles && (
                          <details>
                            <summary>Add role</summary>
                            <ActionForm
                              action={assignRoleAction}
                              submitLabel="Assign role"
                              className="stack"
                            >
                              <input type="hidden" name="userId" value={u.profile.id} />
                              <label>
                                Role
                                <select name="roleKey" required>
                                  {assignableRoles.map((r) => (
                                    <option key={r.key} value={r.key}>
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Company
                                <select name="companyId" required>
                                  {companies.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.code}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </ActionForm>
                          </details>
                        )}
                        {canScopes && (
                          <details>
                            <summary>Grant company scope</summary>
                            <ActionForm
                              action={grantCompanyScopeAction}
                              submitLabel="Grant scope"
                              className="stack"
                            >
                              <input type="hidden" name="userId" value={u.profile.id} />
                              <label>
                                Company
                                <select name="companyId" required>
                                  {companies
                                    .filter((c) => !u.companyIds.includes(c.id))
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.code}
                                      </option>
                                    ))}
                                </select>
                              </label>
                            </ActionForm>
                          </details>
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
    </div>
  );
}

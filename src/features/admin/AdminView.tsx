import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";

export type ApiUser = components["schemas"]["User"];
export type ApiReferenceItem = components["schemas"]["ReferenceItem"];
export type Role = components["schemas"]["Role"];

type AdminSubTab = "users" | "locations" | "departments" | "categories" | "subcategories" | "impactTypes";

export function AdminView() {
  const { user, meta, refresh } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminSubTab>("users");

  // Données utilisateurs
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Formulaire création utilisateur
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<Role>("employee");
  const [newLocationId, setNewLocationId] = useState<number | "">("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  // Données référentiels
  const [refItems, setRefItems] = useState<ApiReferenceItem[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  // Formulaire création référentiel
  const [showCreateRef, setShowCreateRef] = useState(false);
  const [newRefCode, setNewRefCode] = useState("");
  const [newRefLabel, setNewRefLabel] = useState("");
  const [newRefSortOrder, setNewRefSortOrder] = useState<number>(100);
  const [newRefParentId, setNewRefParentId] = useState<number | "">("");
  const [creatingRef, setCreatingRef] = useState(false);
  const [createRefError, setCreateRefError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUserError(null);
    try {
      const res = await fetch("/api/admin/users", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Erreur de chargement des utilisateurs (${res.status}).`);
      const body = (await res.json()) as components["schemas"]["UserListResponse"];
      if (body.ok && Array.isArray(body.data)) setUsers(body.data);
    } catch (err: any) {
      setUserError(err.message || "Impossible de charger les utilisateurs.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchRefTable = useCallback(async (tabName: AdminSubTab) => {
    if (tabName === "users") return;
    setLoadingRefs(true);
    setRefError(null);

    const pathMapping: Record<string, string> = {
      locations: "locations",
      departments: "departments",
      categories: "categories",
      subcategories: "subcategories",
      impactTypes: "impact-types",
    };

    try {
      const res = await fetch(`/api/admin/${pathMapping[tabName]}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Erreur de chargement (${res.status}).`);
      const body = (await res.json()) as components["schemas"]["ReferenceListResponse"];
      if (body.ok && Array.isArray(body.data)) setRefItems(body.data);
    } catch (err: any) {
      setRefError(err.message || "Impossible de charger le référentiel.");
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    } else {
      fetchRefTable(activeTab);
    }
  }, [activeTab, fetchUsers, fetchRefTable]);

  // Actions Utilisateurs
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newDisplayName.trim()) return;

    setCreatingUser(true);
    setCreateUserError(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          displayName: newDisplayName.trim(),
          role: newRole,
          active: true,
          defaultLocationId: newLocationId ? Number(newLocationId) : null,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Erreur lors de la création.");
      }

      setShowCreateUser(false);
      setNewEmail("");
      setNewDisplayName("");
      setNewRole("employee");
      setNewLocationId("");
      await fetchUsers();
    } catch (err: any) {
      setCreateUserError(err.message || "Échec de la création.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUserRole = async (targetUserId: number, updatedRole: Role) => {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ role: updatedRole }),
      });
      if (res.ok) await fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleUserActive = async (targetUserId: number, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (res.ok) await fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  // Actions Référentiels
  const handleCreateRef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefCode.trim() || !newRefLabel.trim()) return;

    setCreatingRef(true);
    setCreateRefError(null);

    const pathMapping: Record<string, string> = {
      locations: "locations",
      departments: "departments",
      categories: "categories",
      subcategories: "subcategories",
      impactTypes: "impact-types",
    };

    const payload: any = {
      code: newRefCode.trim(),
      label: newRefLabel.trim(),
      sortOrder: Number(newRefSortOrder),
    };

    if (activeTab === "subcategories") {
      if (!newRefParentId) {
        setCreateRefError("Veuillez sélectionner une catégorie parente.");
        setCreatingRef(false);
        return;
      }
      payload.categoryId = Number(newRefParentId);
    }

    try {
      const res = await fetch(`/api/admin/${pathMapping[activeTab]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Erreur lors de la création.");
      }

      setShowCreateRef(false);
      setNewRefCode("");
      setNewRefLabel("");
      setNewRefSortOrder(100);
      setNewRefParentId("");
      await Promise.all([fetchRefTable(activeTab), refresh()]);
    } catch (err: any) {
      setCreateRefError(err.message || "Échec de la création.");
    } finally {
      setCreatingRef(false);
    }
  };

  const handleToggleRefActive = async (targetId: number, currentActive: boolean) => {
    const pathMapping: Record<string, string> = {
      locations: "locations",
      departments: "departments",
      categories: "categories",
      subcategories: "subcategories",
      impactTypes: "impact-types",
    };

    try {
      const res = await fetch(`/api/admin/${pathMapping[activeTab]}/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (res.ok) {
        await Promise.all([fetchRefTable(activeTab), refresh()]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="card state-container" data-testid="admin-forbidden">
        <div style={{ fontSize: "2rem" }}>⛔</div>
        <div className="state-title">Accès restreint</div>
        <p className="state-message">Cette section est réservée aux administrateurs du système.</p>
      </div>
    );
  }

  return (
    <div data-testid="admin-view">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.35rem", color: "var(--color-primary)" }}>
          ⚙️ Administration & Référentiels
        </h1>
      </div>

      {/* Barre de navigation des sous-onglets d'administration */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
          data-testid="admintab-users"
        >
          👥 Utilisateurs ({users.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "locations" ? "active" : ""}`}
          onClick={() => setActiveTab("locations")}
          data-testid="admintab-locations"
        >
          📍 Succursales
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "departments" ? "active" : ""}`}
          onClick={() => setActiveTab("departments")}
          data-testid="admintab-departments"
        >
          🏢 Départements
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
          data-testid="admintab-categories"
        >
          🏷️ Catégories
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "subcategories" ? "active" : ""}`}
          onClick={() => setActiveTab("subcategories")}
          data-testid="admintab-subcategories"
        >
          🔖 Sous-catégories
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "impactTypes" ? "active" : ""}`}
          onClick={() => setActiveTab("impactTypes")}
          data-testid="admintab-impactTypes"
        >
          💥 Types d'impact
        </button>
      </div>

      {/* 1. Sous-vue Utilisateurs */}
      {activeTab === "users" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 className="card-title" style={{ margin: 0, fontSize: "1.1rem" }}>Comptes Utilisateurs</h2>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
              onClick={() => setShowCreateUser(true)}
              data-testid="btn-open-create-user"
            >
              ➕ Nouvel utilisateur
            </button>
          </div>

          {userError && <div className="alert alert-danger">{userError}</div>}

          {loadingUsers ? (
            <p style={{ color: "var(--color-text-muted)" }}>Chargement des utilisateurs...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {users.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    backgroundColor: u.active ? "var(--color-bg)" : "#f8fafc",
                    opacity: u.active ? 1 : 0.65,
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                  data-testid={`user-row-${u.id}`}
                >
                  <div>
                    <strong>{u.displayName}</strong> <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>({u.email})</span>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
                      <span className={`role-badge ${u.role}`}>{u.role}</span>
                      {!u.active && <span style={{ fontSize: "0.75rem", color: "var(--color-danger)" }}>Désactivé</span>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      className="form-control"
                      style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", minHeight: "auto" }}
                      value={u.role}
                      onChange={(e) => handleUpdateUserRole(u.id, e.target.value as Role)}
                    >
                      <option value="employee">Employé</option>
                      <option value="manager">Gestionnaire</option>
                      <option value="admin">Administrateur</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", minHeight: "auto" }}
                      onClick={() => handleToggleUserActive(u.id, u.active)}
                    >
                      {u.active ? "Désactiver" : "Activer"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modale création utilisateur */}
          {showCreateUser && (
            <div className="modal-overlay" data-testid="modal-create-user">
              <div className="modal-card">
                <h3 style={{ marginTop: 0 }}>Créer un utilisateur</h3>
                {createUserError && <div className="alert alert-danger">{createUserError}</div>}
                <form onSubmit={handleCreateUser}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="u-email">Adresse courriel</label>
                    <input
                      id="u-email"
                      type="email"
                      className="form-control"
                      placeholder="prenom.nom@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      data-testid="input-user-email"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="u-name">Nom complet</label>
                    <input
                      id="u-name"
                      type="text"
                      className="form-control"
                      placeholder="Ex : Marie Tremblay"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      required
                      data-testid="input-user-name"
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div className="form-group">
                      <label className="form-label required" htmlFor="u-role">Rôle</label>
                      <select
                        id="u-role"
                        className="form-control"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as Role)}
                        data-testid="select-user-role"
                      >
                        <option value="employee">Employé</option>
                        <option value="manager">Gestionnaire</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="u-loc">Succursale par défaut</label>
                      <select
                        id="u-loc"
                        className="form-control"
                        value={newLocationId}
                        onChange={(e) => setNewLocationId(e.target.value ? Number(e.target.value) : "")}
                      >
                        <option value="">-- Aucune --</option>
                        {meta?.locations.map((l) => (
                          <option key={l.id} value={l.id}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreateUser(false)} disabled={creatingUser}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={creatingUser || !newEmail.trim() || !newDisplayName.trim()} data-testid="btn-submit-user">
                      {creatingUser ? "Création..." : "Créer l'utilisateur"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Sous-vues Référentiels (Succursales, Départements, Catégories, Sous-catégories, Types d'impact) */}
      {activeTab !== "users" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 className="card-title" style={{ margin: 0, fontSize: "1.1rem" }}>
              Éléments du référentiel ({refItems.length})
            </h2>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
              onClick={() => setShowCreateRef(true)}
              data-testid="btn-open-create-ref"
            >
              ➕ Ajouter un élément
            </button>
          </div>

          {refError && <div className="alert alert-danger">{refError}</div>}

          {loadingRefs ? (
            <p style={{ color: "var(--color-text-muted)" }}>Chargement du référentiel...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {refItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.65rem 0.85rem",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius)",
                    backgroundColor: item.active ? "var(--color-bg)" : "#f8fafc",
                    opacity: item.active ? 1 : 0.65,
                  }}
                  data-testid={`ref-item-${item.id}`}
                >
                  <div>
                    <strong>{item.label}</strong> <code>({item.code})</code>
                    {item.parentId && (
                      <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                        Parent Cat #{item.parentId}
                      </span>
                    )}
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                      Ordre : {item.sortOrder}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", minHeight: "auto" }}
                    onClick={() => handleToggleRefActive(item.id, item.active)}
                  >
                    {item.active ? "Désactiver" : "Activer"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Modale création élément de référentiel */}
          {showCreateRef && (
            <div className="modal-overlay" data-testid="modal-create-ref">
              <div className="modal-card">
                <h3 style={{ marginTop: 0 }}>Ajouter au référentiel</h3>
                {createRefError && <div className="alert alert-danger">{createRefError}</div>}
                <form onSubmit={handleCreateRef}>
                  {activeTab === "subcategories" && (
                    <div className="form-group">
                      <label className="form-label required" htmlFor="ref-parent">Catégorie parente</label>
                      <select
                        id="ref-parent"
                        className="form-control"
                        value={newRefParentId}
                        onChange={(e) => setNewRefParentId(e.target.value ? Number(e.target.value) : "")}
                        required
                        data-testid="select-ref-parent"
                      >
                        <option value="">-- Choisir la catégorie parente --</option>
                        {meta?.categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div className="form-group">
                      <label className="form-label required" htmlFor="ref-code">Code technique unique</label>
                      <input
                        id="ref-code"
                        type="text"
                        className="form-control"
                        placeholder="Ex : price_error"
                        value={newRefCode}
                        onChange={(e) => setNewRefCode(e.target.value)}
                        required
                        data-testid="input-ref-code"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label required" htmlFor="ref-order">Ordre d'affichage</label>
                      <input
                        id="ref-order"
                        type="number"
                        className="form-control"
                        value={newRefSortOrder}
                        onChange={(e) => setNewRefSortOrder(Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label required" htmlFor="ref-label">Libellé affiché</label>
                    <input
                      id="ref-label"
                      type="text"
                      className="form-control"
                      placeholder="Ex : Erreur de prix en caisse"
                      value={newRefLabel}
                      onChange={(e) => setNewRefLabel(e.target.value)}
                      required
                      data-testid="input-ref-label"
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreateRef(false)} disabled={creatingRef}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={creatingRef || !newRefCode.trim() || !newRefLabel.trim()} data-testid="btn-submit-ref">
                      {creatingRef ? "Ajout..." : "Ajouter au référentiel"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

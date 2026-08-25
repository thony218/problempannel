import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";
import { apiFetch } from "../../shared/apiClient";

export type ApiCorrectiveAction = components["schemas"]["CorrectiveAction"];
export type CorrectiveActionStatus = components["schemas"]["CorrectiveActionStatus"];
export type EffectivenessStatus = components["schemas"]["EffectivenessStatus"];

interface CorrectiveActionsSectionProps {
  publicId: string;
}

export function CorrectiveActionsSection({ publicId }: CorrectiveActionsSectionProps) {
  const { user } = useAuth();
  const [actions, setActions] = useState<ApiCorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Création modale
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createOwnerUserId, setCreateOwnerUserId] = useState<number>(user?.id || 1);
  const [createDueDate, setCreateDueDate] = useState("");
  const [createStatus, setCreateStatus] = useState<CorrectiveActionStatus>("todo");
  const [createBlocksClosure, setCreateBlocksClosure] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Édition modale
  const [editAction, setEditAction] = useState<ApiCorrectiveAction | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editOwnerUserId, setEditOwnerUserId] = useState<number>(1);
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<CorrectiveActionStatus>("todo");
  const [editBlocksClosure, setEditBlocksClosure] = useState(false);
  const [editResult, setEditResult] = useState("");
  const [editEffectiveness, setEditEffectiveness] = useState<EffectivenessStatus | "">("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/issues/${publicId}/corrective-actions`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Erreur lors du chargement des actions (${res.status}).`);
      }
      const body = (await res.json()) as components["schemas"]["CorrectiveActionListResponse"];
      if (body.ok && Array.isArray(body.data)) {
        setActions(body.data);
      }
    } catch (err: any) {
      setError(err.message || "Impossible de charger les actions correctives.");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createDueDate) return;

    setCreating(true);
    setCreateError(null);

    try {
      const res = await apiFetch(`/api/issues/${publicId}/corrective-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createDescription.trim() || null,
          ownerUserId: Number(createOwnerUserId),
          dueDate: createDueDate,
          status: createStatus,
          blocksIssueClosure: createBlocksClosure,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Erreur lors de la création de l'action.");
      }

      setShowCreateModal(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreateDueDate("");
      setCreateStatus("todo");
      setCreateBlocksClosure(false);
      await fetchActions();
    } catch (err: any) {
      setCreateError(err.message || "Échec de la création.");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (act: ApiCorrectiveAction) => {
    setEditAction(act);
    setEditTitle(act.title);
    setEditDescription(act.description || "");
    setEditOwnerUserId(act.ownerUserId);
    setEditDueDate(act.dueDate);
    setEditStatus(act.status);
    setEditBlocksClosure(act.blocksIssueClosure);
    setEditResult(act.result || "");
    setEditEffectiveness(act.effectivenessStatus || "");
    setUpdateError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAction) return;

    setUpdating(true);
    setUpdateError(null);

    const isManager = user?.role === "manager" || user?.role === "admin";
    const payload: any = {
      status: editStatus,
      result: editResult.trim() || null,
    };

    if (isManager) {
      payload.title = editTitle.trim();
      payload.description = editDescription.trim() || null;
      payload.ownerUserId = Number(editOwnerUserId);
      payload.dueDate = editDueDate;
      payload.blocksIssueClosure = editBlocksClosure;
      payload.effectivenessStatus = editEffectiveness || null;
    }

    try {
      const res = await apiFetch(`/api/corrective-actions/${editAction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Erreur lors de la mise à jour.");
      }

      setEditAction(null);
      await fetchActions();
    } catch (err: any) {
      setUpdateError(err.message || "Échec de la mise à jour.");
    } finally {
      setUpdating(false);
    }
  };

  const isManager = user?.role === "manager" || user?.role === "admin";

  const getStatusBadge = (st: CorrectiveActionStatus) => {
    switch (st) {
      case "todo":
        return <span className="role-badge" style={{ backgroundColor: "#f1f5f9", color: "#475569" }}>À faire</span>;
      case "inProgress":
        return <span className="role-badge" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>En cours</span>;
      case "waiting":
        return <span className="role-badge" style={{ backgroundColor: "#ede9fe", color: "#5b21b6" }}>En attente</span>;
      case "done":
        return <span className="role-badge" style={{ backgroundColor: "#dcfce7", color: "#166534" }}>Terminé</span>;
    }
  };

  return (
    <div className="card" data-testid="corrective-actions-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h2 className="card-title" style={{ fontSize: "1.1rem", margin: 0 }}>
          🛠️ Actions correctives ({actions.length})
        </h2>
        {isManager && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: "0.4rem 0.85rem", minHeight: "auto", fontSize: "0.85rem" }}
            onClick={() => setShowCreateModal(true)}
            data-testid="btn-open-create-action"
          >
            ➕ Nouvelle action
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div style={{ padding: "1rem 0", color: "var(--color-text-muted)" }}>Chargement des actions...</div>
      ) : actions.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", margin: "0.5rem 0" }}>
          Aucune action corrective enregistrée pour ce dossier.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {actions.map((act) => {
            const canEditThisAction = isManager || act.ownerUserId === user?.id;

            return (
              <div
                key={act.id}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  padding: "0.85rem",
                  backgroundColor: "var(--color-bg)",
                }}
                data-testid={`action-card-${act.id}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: "0 0 0.35rem 0", fontSize: "0.95rem" }}>{act.title}</h3>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      {getStatusBadge(act.status)}
                      {act.blocksIssueClosure && (
                        <span style={{ fontSize: "0.75rem", color: "var(--color-danger)", fontWeight: 600 }}>
                          🔒 Bloque la clôture
                        </span>
                      )}
                    </div>
                  </div>
                  {canEditThisAction && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "0.25rem 0.5rem", minHeight: "auto", fontSize: "0.75rem" }}
                      onClick={() => openEditModal(act)}
                      data-testid={`btn-edit-action-${act.id}`}
                    >
                      ✏️ Mettre à jour
                    </button>
                  )}
                </div>

                {act.description && (
                  <p style={{ margin: "0.5rem 0", fontSize: "0.85rem", color: "var(--color-text)" }}>{act.description}</p>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem", fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                  <div>Responsable : <strong style={{ color: "var(--color-text)" }}>Utilisateur #{act.ownerUserId}</strong></div>
                  <div>Échéance : <strong style={{ color: "var(--color-text)" }}>{act.dueDate}</strong></div>
                  {act.completedAt && <div>Terminé le : {new Date(act.completedAt).toLocaleDateString("fr-CA")}</div>}
                </div>

                {act.result && (
                  <div style={{ marginTop: "0.5rem", padding: "0.5rem", backgroundColor: "#f8fafc", borderRadius: 4, fontSize: "0.85rem" }}>
                    <strong>Résultat :</strong> {act.result}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modale de création d'action */}
      {showCreateModal && (
        <div className="modal-overlay" data-testid="modal-create-action">
          <div className="modal-card">
            <h3 style={{ marginTop: 0 }}>Créer une action corrective</h3>
            {createError && <div className="alert alert-danger">{createError}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label required" htmlFor="act-title">Titre de l'action</label>
                <input
                  id="act-title"
                  type="text"
                  className="form-control"
                  placeholder="Ex : Mettre à jour la procédure de validation"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  required
                  data-testid="input-create-action-title"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="act-desc">Description</label>
                <textarea
                  id="act-desc"
                  className="form-control"
                  rows={2}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label className="form-label required" htmlFor="act-owner">ID Responsable</label>
                  <input
                    id="act-owner"
                    type="number"
                    min={1}
                    className="form-control"
                    value={createOwnerUserId}
                    onChange={(e) => setCreateOwnerUserId(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required" htmlFor="act-due">Échéance</label>
                  <input
                    id="act-due"
                    type="date"
                    className="form-control"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                    required
                    data-testid="input-create-action-due"
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={createBlocksClosure}
                    onChange={(e) => setCreateBlocksClosure(e.target.checked)}
                  />
                  <span>Bloque la clôture du dossier jusqu'à réalisation</span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={creating}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating || !createTitle.trim() || !createDueDate} data-testid="btn-submit-create-action">
                  {creating ? "Création..." : "Créer l'action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editAction && (
        <div className="modal-overlay" data-testid="modal-edit-action">
          <div className="modal-card">
            <h3 style={{ marginTop: 0 }}>Mettre à jour l'action</h3>
            {updateError && <div className="alert alert-danger">{updateError}</div>}
            <form onSubmit={handleUpdate}>
              {isManager && (
                <>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="edit-act-title">Titre</label>
                    <input
                      id="edit-act-title"
                      type="text"
                      className="form-control"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-act-desc">Description</label>
                    <textarea
                      id="edit-act-desc"
                      className="form-control"
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div className="form-group">
                      <label className="form-label required" htmlFor="edit-act-owner">ID Responsable</label>
                      <input
                        id="edit-act-owner"
                        type="number"
                        min={1}
                        className="form-control"
                        value={editOwnerUserId}
                        onChange={(e) => setEditOwnerUserId(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label required" htmlFor="edit-act-due">Échéance</label>
                      <input
                        id="edit-act-due"
                        type="date"
                        className="form-control"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label required" htmlFor="edit-act-status">Statut de l'action</label>
                <select
                  id="edit-act-status"
                  className="form-control"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as CorrectiveActionStatus)}
                  data-testid="select-edit-action-status"
                >
                  <option value="todo">À faire</option>
                  <option value="inProgress">En cours</option>
                  <option value="waiting">En attente</option>
                  <option value="done">Terminé</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-act-result">Résultat / Note de réalisation</label>
                <textarea
                  id="edit-act-result"
                  className="form-control"
                  rows={2}
                  placeholder="Expliquez ce qui a été fait..."
                  value={editResult}
                  onChange={(e) => setEditResult(e.target.value)}
                  data-testid="input-edit-action-result"
                />
              </div>

              {isManager && (
                <div style={{ marginBottom: "1rem" }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editBlocksClosure}
                      onChange={(e) => setEditBlocksClosure(e.target.checked)}
                    />
                    <span>Bloque la clôture du dossier</span>
                  </label>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditAction(null)} disabled={updating}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={updating} data-testid="btn-submit-edit-action">
                  {updating ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

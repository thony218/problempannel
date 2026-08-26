import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";
import { CommentsSection } from "../comments/CommentsSection";
import { AttachmentsSection } from "../attachments/AttachmentsSection";
import { CorrectiveActionsSection } from "../corrective-actions/CorrectiveActionsSection";
import { HistoryTimelineSection } from "../history/HistoryTimelineSection";
import { LinksSection } from "../links/LinksSection";
import { EditIssueModal } from "./EditIssueModal";
import { RedactModal } from "../admin/RedactModal";
import { apiFetch } from "../../shared/apiClient";
import { useNavigate, useParams } from "react-router";
import { PATHS, issueDetailPath } from "../../routes/paths";
import { responseIssueEtag } from "../../shared/issueEtag";

export type IssueDetail = components["schemas"]["IssueDetail"];
export type IssueStatus = components["schemas"]["IssueStatus"];
export type Priority = components["schemas"]["Priority"];

type DetailTab = "details" | "comments" | "attachments" | "actions" | "links" | "history";

/**
 * Détail d'un dossier, adressé par son URL (`/dossiers/INC-000042`).
 *
 * L'identifiant vient de la route : l'URL est partageable et un lien profond
 * ouvre directement le dossier après authentification
 * (01_produit/ux/01_NAVIGATION_ET_ARBORESCENCE.md §Deep links).
 */
export function IssueDetailView() {
  const { user, meta } = useAuth();
  const navigate = useNavigate();
  const { publicId = "" } = useParams<{ publicId: string }>();

  /**
   * Retour au Registre en **restituant ses filtres** (S39).
   *
   * `navigate(-1)` rejoue l'entrée d'historique précédente, donc l'URL filtrée
   * telle qu'elle était. Sur un lien profond ouvert directement — pas
   * d'historique à remonter — on retombe sur le Registre non filtré.
   */
  const onBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(PATHS.registry);
  };

  const onSelectIssue = (targetPublicId: string) => navigate(issueDetailPath(targetPublicId));

  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<DetailTab>("details");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRedactModal, setShowRedactModal] = useState(false);

  const fetchIssue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/issues/${publicId}`, {
        headers: { Accept: "application/json" },
      });

      if (res.status === 404) {
        throw new Error(`Le dossier "${publicId}" est introuvable.`);
      }

      if (!res.ok) {
        throw new Error(`Erreur lors de la récupération du dossier (${res.status}).`);
      }

      const responseEtag = res.headers.get("ETag");
      const body = (await res.json()) as components["schemas"]["IssueDetailResponse"];
      if (!body.ok || !body.data) {
        throw new Error("Réponse inattendue du serveur.");
      }

      setEtag(responseIssueEtag(responseEtag, body.data.issue.publicId, body.data.issue.rowVersion));
      setDetail(body.data);
    } catch (err: any) {
      setError(err.message || "Impossible de charger le dossier.");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  if (loading) {
    return (
      <div className="card state-container" data-testid="detail-loading">
        <div className="state-title">Chargement du dossier {publicId}...</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="card state-container" data-testid="detail-error">
        <div style={{ fontSize: "2rem" }}>⚠️</div>
        <div className="state-title">Erreur</div>
        <p className="state-message">{error || "Dossier introuvable."}</p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Retour au registre
          </button>
          <button type="button" className="btn btn-primary" onClick={fetchIssue}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const { issue, impacts } = detail;

  const isManager = user?.role === "manager" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const isCreatorInNew = user?.role === "employee" && issue.createdByUserId === user?.id && issue.status === "new";
  const isOwnerEmployee = user?.role === "employee" && issue.ownerUserId === user?.id;
  const canEdit = isManager || isCreatorInNew || isOwnerEmployee;

  // Helpers de libellés
  const getLocationLabel = (locId?: number) => {
    if (!locId) return "Succursale non définie";
    return meta?.locations.find((l) => l.id === locId)?.label || `Succursale #${locId}`;
  };

  const getCategoryLabel = (catId: number) => {
    return meta?.categories.find((c) => c.id === catId)?.label || `Catégorie #${catId}`;
  };

  const getSubcategoryLabel = (subId?: number | null) => {
    if (!subId) return "Non définie";
    return meta?.subcategories.find((s) => s.id === subId)?.label || `Sous-catégorie #${subId}`;
  };

  const getDepartmentLabel = (depId?: number | null) => {
    if (!depId) return "Non spécifié";
    return meta?.departments.find((d) => d.id === depId)?.label || `Département #${depId}`;
  };

  const getImpactTypeLabel = (typeId: number) => {
    return meta?.impactTypes.find((it) => it.id === typeId)?.label || `Impact #${typeId}`;
  };

  const getUserLabel = (userId?: number | null, emptyLabel = "Non assigné") => {
    if (!userId) return emptyLabel;
    const directoryUser = meta?.users.find((candidate) => candidate.id === userId);
    return directoryUser
      ? `${directoryUser.displayName}${directoryUser.active ? "" : " (inactif)"}`
      : `Utilisateur #${userId}`;
  };

  const getStatusBadge = (st: IssueStatus) => {
    switch (st) {
      case "new":
        return <span className="role-badge" style={{ backgroundColor: "#dbeafe", color: "#1e40af" }}>Nouveau</span>;
      case "inProgress":
        return <span className="role-badge" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>En cours</span>;
      case "waiting":
        return <span className="role-badge" style={{ backgroundColor: "#ede9fe", color: "#5b21b6" }}>En attente</span>;
      case "resolved":
        return <span className="role-badge" style={{ backgroundColor: "#dcfce7", color: "#166534" }}>Résolu</span>;
    }
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case "urgent":
        return <span style={{ color: "var(--color-danger)", fontWeight: "bold" }}>🔴 Urgente</span>;
      case "important":
        return <span style={{ color: "var(--color-warning)", fontWeight: "bold" }}>🟠 Importante</span>;
      case "normal":
        return <span style={{ color: "var(--color-text-muted)" }}>⚪ Normale</span>;
    }
  };

  return (
    <div data-testid="issue-detail-container">
      {/* Barre d'action supérieure */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" className="btn btn-secondary" onClick={onBack} data-testid="btn-back-to-list">
          ← Retour au registre
        </button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowEditModal(true)}
              data-testid="btn-open-edit-issue"
            >
              ✏️ Modifier le dossier
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ color: "var(--color-danger-text)" }}
              onClick={() => setShowRedactModal(true)}
              data-testid="btn-open-redact"
            >
              🛡️ Caviarder
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={fetchIssue} style={{ fontSize: "0.85rem" }}>
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* En-tête principal */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem", color: "var(--color-primary)" }}>
              {issue.publicId}
            </h1>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <span data-testid="issue-status-badge" data-status={issue.status}>
                {getStatusBadge(issue.status)}
              </span>
              {getPriorityBadge(issue.priority)}
            </div>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", textAlign: "right" }}>
            <div>Créé le {new Date(issue.createdAt).toLocaleDateString("fr-CA")}</div>
            <div>Mis à jour le {new Date(issue.updatedAt).toLocaleDateString("fr-CA")}</div>
          </div>
        </div>
      </div>

      {/* Bannière de caviardage de sécurité (V3-PRIV-01) */}
      {issue.redactedAt && (
        <div className="alert alert-warning" style={{ fontSize: "0.85rem", marginBottom: "1rem" }} data-testid="banner-redacted">
          🛡️ <strong>Dossier caviardé :</strong> Des informations personnelles ou confidentielles ont été caviardées le {new Date(issue.redactedAt).toLocaleDateString("fr-CA")} (Motif : {issue.redactionReason}).
        </div>
      )}

      {/* Onglets de sections */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === "details" ? "active" : ""}`}
          onClick={() => setActiveTab("details")}
          data-testid="tab-details"
        >
          📄 Détails & Analyse
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "comments" ? "active" : ""}`}
          onClick={() => setActiveTab("comments")}
          data-testid="tab-comments"
        >
          💬 Commentaires
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "attachments" ? "active" : ""}`}
          onClick={() => setActiveTab("attachments")}
          data-testid="tab-attachments"
        >
          📎 Pièces jointes
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "actions" ? "active" : ""}`}
          onClick={() => setActiveTab("actions")}
          data-testid="tab-actions"
        >
          🛠️ Actions correctives
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "links" ? "active" : ""}`}
          onClick={() => setActiveTab("links")}
          data-testid="tab-links"
        >
          🔗 Liens & Récurrences
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
          data-testid="tab-history"
        >
          📜 Historique
        </button>
      </div>

      {/* Contenu de l'onglet actif */}
      {activeTab === "details" && (
        <>
          {/* Section 1 : Informations générales */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2 className="card-title" style={{ fontSize: "1.1rem" }}>📍 Informations générales</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", fontSize: "0.9rem" }}>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Date de survenance :</span>
                <strong>{issue.occurredOn}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Succursale :</span>
                <strong>{getLocationLabel(issue.locationId)}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Département :</span>
                <strong>{getDepartmentLabel(issue.departmentId)}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Catégorie :</span>
                <strong>{getCategoryLabel(issue.categoryId)}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Sous-catégorie :</span>
                <strong>{getSubcategoryLabel(issue.subcategoryId)}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Responsable assigné :</span>
                <strong>{getUserLabel(issue.ownerUserId)}</strong>
              </div>
              <div data-testid="issue-error-actor">
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Employé concerné par l'erreur :</span>
                <strong>{getUserLabel(issue.errorActorUserId, "Attribution inconnue")}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Date d'échéance :</span>
                <strong>{issue.dueDate || "Aucune"}</strong>
              </div>
            </div>
          </div>

          {/* Section 2 : Description des faits & Impacts */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2 className="card-title" style={{ fontSize: "1.1rem" }}>📝 Description des faits</h2>
            <p style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 1rem 0" }}>
              {issue.description}
            </p>

            <h3 style={{ fontSize: "0.95rem", margin: "1rem 0 0.5rem 0", color: "var(--color-text-muted)" }}>
              Impacts constatés :
            </h3>
            {impacts.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Aucun impact spécifié.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem" }}>
                {impacts.map((imp) => (
                  <li key={imp.impactTypeId} style={{ marginBottom: "0.25rem" }}>
                    <strong>{getImpactTypeLabel(imp.impactTypeId)}</strong>
                    {imp.details && <span> — {imp.details}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Section 3 : Attente (si waiting) */}
          {issue.status === "waiting" && issue.waitingOn && (
            <div className="card" style={{ marginBottom: "1rem", backgroundColor: "#faf5ff", borderColor: "#e9d5ff" }}>
              <h2 className="card-title" style={{ fontSize: "1.1rem", color: "#5b21b6" }}>⏳ Dossier en attente</h2>
              <div style={{ fontSize: "0.9rem" }}>
                <p style={{ margin: "0 0 0.25rem 0" }}>
                  <strong>Type d'attente :</strong>{" "}
                  {issue.waitingOn.type === "customer"
                    ? "Client"
                    : issue.waitingOn.type === "supplier"
                    ? "Fournisseur"
                    : "Utilisateur interne"}
                </p>
                {issue.waitingOn.type === "user" && (
                  <p style={{ margin: 0 }}>
                    <strong>Utilisateur attendu :</strong> {getUserLabel(issue.waitingOn.userId, "Non défini")}
                  </p>
                )}
                {(issue.waitingOn.type === "customer" || issue.waitingOn.type === "supplier") && (
                  <p style={{ margin: 0 }}>
                    <strong>Précision :</strong> {issue.waitingOn.label}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Section 4 : Analyse, Causes & Résolution */}
          {(issue.causeStatus || issue.permanentCorrectionType || issue.status === "resolved") && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h2 className="card-title" style={{ fontSize: "1.1rem" }}>🔍 Analyse de cause & Solutions</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", fontSize: "0.9rem" }}>
                {issue.causeStatus && (
                  <div>
                    <span style={{ color: "var(--color-text-muted)", display: "block" }}>Statut de la cause :</span>
                    <strong>{issue.causeStatus === "known" ? "Connue" : "À vérifier"}</strong>
                  </div>
                )}
                {issue.causeSummary && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "var(--color-text-muted)", display: "block" }}>Résumé de la cause :</span>
                    <p style={{ margin: "0.25rem 0 0 0" }}>{issue.causeSummary}</p>
                  </div>
                )}
                {issue.immediateSolution && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "var(--color-text-muted)", display: "block" }}>Solution immédiate :</span>
                    <p style={{ margin: "0.25rem 0 0 0" }}>{issue.immediateSolution}</p>
                  </div>
                )}
                {issue.permanentCorrectionType && (
                  <div>
                    <span style={{ color: "var(--color-text-muted)", display: "block" }}>Type de correction permanente :</span>
                    <strong>{issue.permanentCorrectionType}</strong>
                  </div>
                )}
                {issue.permanentCorrectionSummary && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "var(--color-text-muted)", display: "block" }}>Résumé de la correction permanente :</span>
                    <p style={{ margin: "0.25rem 0 0 0" }}>{issue.permanentCorrectionSummary}</p>
                  </div>
                )}
                {issue.finalResult && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "var(--color-text-muted)", display: "block" }}>Résultat final :</span>
                    <p style={{ margin: "0.25rem 0 0 0" }}>{issue.finalResult}</p>
                  </div>
                )}
                {issue.preventionLearning && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "var(--color-text-muted)", display: "block" }}>Apprentissages pour la prévention :</span>
                    <p style={{ margin: "0.25rem 0 0 0" }}>{issue.preventionLearning}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 5 : Efficacité & Clôture */}
          {issue.status === "resolved" && (
            <div className="card" style={{ marginBottom: "1rem", backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <h2 className="card-title" style={{ fontSize: "1.1rem", color: "#166534" }}>✅ Clôture & Efficacité</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", fontSize: "0.9rem" }}>
                <div>
                  <span style={{ color: "var(--color-text-muted)", display: "block" }}>Résolu le :</span>
                  <strong>{issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString("fr-CA") : "N/A"}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--color-text-muted)", display: "block" }}>Résolu par :</span>
                  <strong>{getUserLabel(issue.resolvedByUserId, "N/A")}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--color-text-muted)", display: "block" }}>Évaluation d'efficacité :</span>
                  <strong>
                    {issue.effectivenessStatus === "effective"
                      ? "Efficace"
                      : issue.effectivenessStatus === "ineffective"
                      ? "Inefficace"
                      : "En attente (Pending)"}
                  </strong>
                </div>
                {issue.effectivenessReviewDate && (
                  <div>
                    <span style={{ color: "var(--color-text-muted)", display: "block" }}>Date de révision prévue :</span>
                    <strong>{issue.effectivenessReviewDate}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "comments" && <CommentsSection publicId={publicId} />}

      {activeTab === "attachments" && <AttachmentsSection publicId={publicId} />}

      {activeTab === "actions" && <CorrectiveActionsSection publicId={publicId} />}

      {activeTab === "links" && (
        <LinksSection
          publicId={publicId}
          subcategoryId={issue.subcategoryId}
          locationId={issue.locationId}
          onSelectIssue={onSelectIssue}
        />
      )}

      {activeTab === "history" && <HistoryTimelineSection publicId={publicId} />}

      {/* Modal d'édition du dossier */}
      {showEditModal && (
        <EditIssueModal
          issue={issue}
          etag={etag}
          onClose={() => setShowEditModal(false)}
          onSuccess={fetchIssue}
          onReload={fetchIssue}
        />
      )}

      {/* Modal de caviardage de sécurité (Admin) */}
      {showRedactModal && (
        <RedactModal
          issue={issue}
          onClose={() => setShowRedactModal(false)}
          onSuccess={fetchIssue}
        />
      )}
    </div>
  );
}

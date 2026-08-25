import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";

export type ApiIssueLink = components["schemas"]["IssueLink"];
export type ApiRecurringGroup = components["schemas"]["RecurringGroup"];

interface LinksSectionProps {
  publicId: string;
  subcategoryId?: number | null;
  locationId?: number | null;
  onSelectIssue?: (publicId: string) => void;
}

export function LinksSection({ publicId, subcategoryId, locationId, onSelectIssue }: LinksSectionProps) {
  const { user, meta } = useAuth();
  const [links, setLinks] = useState<ApiIssueLink[]>([]);
  const [recurringInfo, setRecurringInfo] = useState<ApiRecurringGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [relatedPublicId, setRelatedPublicId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLinksAndRecurrence = useCallback(async () => {
    try {
      const [linksRes, recRes] = await Promise.all([
        fetch(`/api/issues/${publicId}/links`, { headers: { Accept: "application/json" } }),
        subcategoryId ? fetch(`/api/analytics/recurring`, { headers: { Accept: "application/json" } }) : null,
      ]);

      if (linksRes.ok) {
        const data = (await linksRes.json()) as components["schemas"]["LinkListResponse"];
        if (data.ok && Array.isArray(data.data)) {
          setLinks(data.data);
        }
      }

      if (recRes && recRes.ok) {
        const recData = (await recRes.json()) as components["schemas"]["RecurringResponse"];
        if (recData.ok && Array.isArray(recData.data)) {
          const matching = recData.data.filter((g) => g.subcategoryId === subcategoryId);
          setRecurringInfo(matching);
        }
      }
    } catch (err: any) {
      setError(err.message || "Impossible de charger les liens.");
    } finally {
      setLoading(false);
    }
  }, [publicId, subcategoryId]);

  useEffect(() => {
    fetchLinksAndRecurrence();
  }, [fetchLinksAndRecurrence]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relatedPublicId.trim()) return;

    setAdding(true);
    setAddError(null);

    try {
      const res = await fetch(`/api/issues/${publicId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ relatedPublicId: relatedPublicId.trim().toUpperCase() }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Erreur lors de la création du lien.");
      }

      setRelatedPublicId("");
      await fetchLinksAndRecurrence();
    } catch (err: any) {
      setAddError(err.message || "Échec de l'ajout du lien.");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteLink = async (relId: string) => {
    if (!window.confirm(`Retirer le lien avec le dossier ${relId} ?`)) return;

    setDeletingId(relId);
    try {
      const res = await fetch(`/api/issues/${publicId}/links/${relId}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Erreur lors du retrait du lien.");
      }

      await fetchLinksAndRecurrence();
    } catch (err: any) {
      alert(err.message || "Échec du retrait.");
    } finally {
      setDeletingId(null);
    }
  };

  const isManager = user?.role === "manager" || user?.role === "admin";
  const subcategoryLabel = subcategoryId
    ? meta?.subcategories.find((s) => s.id === subcategoryId)?.label || `Sous-catégorie #${subcategoryId}`
    : null;

  return (
    <div className="card" data-testid="links-section">
      <h2 className="card-title" style={{ fontSize: "1.1rem" }}>
        🔗 Dossiers similaires & Récurrences
      </h2>

      {/* Alerte de récurrence (LINK-03) */}
      {recurringInfo.length > 0 && (
        <div
          className="alert alert-warning"
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1.25rem" }}
          data-testid="recurrence-alert"
        >
          <strong>⚠️ Alerte de récurrence active (Seuil ≥3 sur 90 jours)</strong>
          {recurringInfo.map((g, idx) => (
            <div key={idx} style={{ fontSize: "0.85rem" }}>
              {g.scope === "location"
                ? `• Récurrence locale dans votre succursale (${g.count} incidents pour "${subcategoryLabel}").`
                : `• Récurrence organisationnelle à l'échelle de l'entreprise (${g.count} incidents pour "${subcategoryLabel}").`}
            </div>
          ))}
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Liste des dossiers liés */}
      <h3 style={{ fontSize: "0.95rem", margin: "0.75rem 0 0.5rem 0", color: "var(--color-text-muted)" }}>
        Dossiers liés ({links.length})
      </h3>

      {loading ? (
        <div style={{ padding: "0.5rem 0", color: "var(--color-text-muted)" }}>Chargement des liens...</div>
      ) : links.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", margin: "0.25rem 0 1rem 0" }}>
          Aucun dossier similaire lié pour le moment.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {links.map((link) => (
            <div
              key={link.relatedPublicId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.65rem 0.85rem",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                backgroundColor: "var(--color-bg)",
              }}
              data-testid={`link-item-${link.relatedPublicId}`}
            >
              <div>
                <button
                  type="button"
                  onClick={() => onSelectIssue && onSelectIssue(link.relatedPublicId)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--color-primary)",
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontSize: "0.95rem",
                  }}
                >
                  {link.relatedPublicId}
                </button>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                  (Lié le {new Date(link.createdAt).toLocaleDateString("fr-CA")})
                </span>
              </div>

              {isManager && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "0.2rem 0.5rem", minHeight: "auto", fontSize: "0.75rem", color: "var(--color-danger)" }}
                  onClick={() => handleDeleteLink(link.relatedPublicId)}
                  disabled={deletingId === link.relatedPublicId}
                  data-testid={`btn-delete-link-${link.relatedPublicId}`}
                >
                  {deletingId === link.relatedPublicId ? "..." : "🗑️ Retirer"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout pour les gestionnaires */}
      {isManager && (
        <form onSubmit={handleAddLink} data-testid="form-add-link">
          {addError && <div className="alert alert-danger">{addError}</div>}
          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label" htmlFor="link-public-id">
              Lier un autre dossier similaire (ex: INC-000002)
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                id="link-public-id"
                type="text"
                className="form-control"
                placeholder="INC-XXXXXX"
                value={relatedPublicId}
                onChange={(e) => setRelatedPublicId(e.target.value)}
                disabled={adding}
                style={{ flex: 1 }}
                data-testid="input-link-public-id"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={adding || !relatedPublicId.trim()}
                data-testid="btn-submit-link"
              >
                {adding ? "Liaison..." : "🔗 Lier"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";
import { apiFetch } from "../../shared/apiClient";

export type ApiComment = components["schemas"]["Comment"];

interface CommentsSectionProps {
  publicId: string;
}

export function CommentsSection({ publicId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newBody, setNewBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Soft-delete modal/state
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/issues/${publicId}/comments`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Erreur lors du chargement des commentaires (${res.status}).`);
      }
      const data = (await res.json()) as components["schemas"]["CommentListResponse"];
      if (data.ok && data.data) {
        setComments(data.data.items);
      }
    } catch (err: any) {
      setError(err.message || "Impossible de charger les commentaires.");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBody.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiFetch(`/api/issues/${publicId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ body: newBody.trim() }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Erreur lors de l'ajout du commentaire.");
      }

      setNewBody("");
      await fetchComments();
    } catch (err: any) {
      setSubmitError(err.message || "Échec de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSoftDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTargetId || deleteReason.trim().length < 5) {
      setDeleteError("Le motif doit comporter au moins 5 caractères.");
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await apiFetch(`/api/comments/${deleteTargetId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Erreur lors de la suppression.");
      }

      setDeleteTargetId(null);
      setDeleteReason("");
      await fetchComments();
    } catch (err: any) {
      setDeleteError(err.message || "Échec de la suppression.");
    } finally {
      setDeleting(false);
    }
  };

  const canSoftDelete = user?.role === "manager" || user?.role === "admin";

  return (
    <div className="card" data-testid="comments-section">
      <h2 className="card-title" style={{ fontSize: "1.1rem" }}>
        💬 Commentaires ({comments.length})
      </h2>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div style={{ padding: "1rem 0", color: "var(--color-text-muted)" }}>Chargement des commentaires...</div>
      ) : comments.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", margin: "0.5rem 0 1rem" }}>
          Aucun commentaire pour le moment.
        </p>
      ) : (
        <div style={{ marginBottom: "1.5rem" }}>
          {comments.map((comment) => (
            <div key={comment.id} className="comment-item" data-testid={`comment-${comment.id}`}>
              <div className="comment-header">
                <div>
                  <strong>Utilisateur #{comment.userId}</strong>
                  <span style={{ color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                    {new Date(comment.createdAt).toLocaleString("fr-CA")}
                  </span>
                </div>
                {canSoftDelete && !comment.deleted && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "0.2rem 0.5rem", minHeight: "auto", fontSize: "0.75rem", color: "var(--color-danger)" }}
                    onClick={() => {
                      setDeleteTargetId(comment.id);
                      setDeleteReason("");
                      setDeleteError(null);
                    }}
                    data-testid={`btn-delete-comment-${comment.id}`}
                  >
                    🗑️ Supprimer
                  </button>
                )}
              </div>
              <div className="comment-body">
                {comment.deleted ? (
                  <span className="comment-deleted">
                    [Commentaire supprimé le {comment.deletedAt ? new Date(comment.deletedAt).toLocaleString("fr-CA") : ""}]
                  </span>
                ) : (
                  comment.body
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout */}
      <form onSubmit={handleAddComment} data-testid="form-add-comment">
        {submitError && <div className="alert alert-danger">{submitError}</div>}
        <div className="form-group" style={{ marginBottom: "0.75rem" }}>
          <label className="form-label" htmlFor="new-comment-body">
            Ajouter un commentaire
          </label>
          <textarea
            id="new-comment-body"
            className="form-control"
            rows={3}
            placeholder="Écrivez un commentaire ou une précision..."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            disabled={submitting}
            maxLength={4000}
            data-testid="input-comment-body"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !newBody.trim()}
            data-testid="btn-submit-comment"
          >
            {submitting ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </form>

      {/* Modale de soft-delete */}
      {deleteTargetId !== null && (
        <div className="modal-overlay" data-testid="modal-delete-comment">
          <div className="modal-card">
            <h3 style={{ marginTop: 0, color: "var(--color-danger)" }}>Supprimer le commentaire</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
              Veuillez saisir le motif obligatoire de suppression (minimum 5 caractères).
            </p>
            {deleteError && <div className="alert alert-danger">{deleteError}</div>}
            <form onSubmit={handleSoftDelete}>
              <div className="form-group">
                <label className="form-label required" htmlFor="delete-reason">
                  Motif de suppression
                </label>
                <input
                  id="delete-reason"
                  type="text"
                  className="form-control"
                  placeholder="Ex : Erreur de frappe, information confidentielle, doublon..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  disabled={deleting}
                  data-testid="input-delete-reason"
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeleteTargetId(null)}
                  disabled={deleting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={deleting || deleteReason.trim().length < 5}
                  data-testid="btn-confirm-delete-comment"
                >
                  {deleting ? "Suppression..." : "Confirmer la suppression"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

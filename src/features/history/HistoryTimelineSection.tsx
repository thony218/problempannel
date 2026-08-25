import React, { useState, useEffect, useCallback } from "react";
import type { components } from "../../shared/api-types.generated";
import { apiFetch } from "../../shared/apiClient";

export type ApiHistoryEvent = components["schemas"]["HistoryEvent"];

interface HistoryTimelineSectionProps {
  publicId: string;
}

const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
  issue_created: { label: "Création du dossier", icon: "🆕" },
  issue_updated: { label: "Modification du dossier", icon: "✏️" },
  issue_reopened: { label: "Réouverture du dossier", icon: "🔄" },
  comment_created: { label: "Commentaire ajouté", icon: "💬" },
  comment_deleted: { label: "Commentaire supprimé", icon: "🗑️" },
  attachment_uploaded: { label: "Pièce jointe ajoutée", icon: "📎" },
  attachment_deleted: { label: "Pièce jointe supprimée", icon: "🗑️" },
  corrective_action_created: { label: "Action corrective créée", icon: "🛠️" },
  corrective_action_updated: { label: "Action corrective modifiée", icon: "⚙️" },
};

export function HistoryTimelineSection({ publicId }: HistoryTimelineSectionProps) {
  const [events, setEvents] = useState<ApiHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/issues/${publicId}/history?limit=50`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Erreur lors du chargement de l'historique (${res.status}).`);
      }
      const body = (await res.json()) as components["schemas"]["HistoryListResponse"];
      if (body.ok && body.data) {
        setEvents(body.data.items);
        setNextCursor(body.data.nextCursor);
        setHasMore(body.data.hasMore);
      }
    } catch (err: any) {
      setError(err.message || "Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const res = await apiFetch(`/api/issues/${publicId}/history?limit=50&cursor=${encodeURIComponent(nextCursor)}`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const body = (await res.json()) as components["schemas"]["HistoryListResponse"];
        if (body.ok && body.data) {
          setEvents((prev) => [...prev, ...body.data.items]);
          setNextCursor(body.data.nextCursor);
          setHasMore(body.data.hasMore);
        }
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="card" data-testid="history-timeline-section">
      <h2 className="card-title" style={{ fontSize: "1.1rem" }}>
        📜 Historique d'audit ({events.length})
      </h2>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div style={{ padding: "1rem 0", color: "var(--color-text-muted)" }}>Chargement de l'historique...</div>
      ) : events.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", margin: "0.5rem 0" }}>
          Aucun événement d'historique consigné.
        </p>
      ) : (
        <div>
          <ul className="timeline-list">
            {events.map((evt) => {
              const metaInfo = EVENT_LABELS[evt.eventType] || { label: evt.eventType, icon: "📌" };
              const payloadKeys = Object.keys(evt.payload || {});

              return (
                <li key={evt.id} className="timeline-item" data-testid={`history-item-${evt.id}`}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600 }}>
                        {metaInfo.icon} {metaInfo.label}
                      </span>
                      <span className="timeline-time">{new Date(evt.createdAt).toLocaleString("fr-CA")}</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
                      Par <strong>Utilisateur #{evt.actorUserId}</strong>
                    </div>

                    {payloadKeys.length > 0 && (
                      <div
                        style={{
                          marginTop: "0.35rem",
                          padding: "0.35rem 0.5rem",
                          backgroundColor: "var(--color-bg)",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          fontFamily: "monospace",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {JSON.stringify(evt.payload)}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ fontSize: "0.85rem" }}
              >
                {loadingMore ? "Chargement..." : "⬇️ Charger plus d'historique"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

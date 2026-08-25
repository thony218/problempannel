import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";
import { apiFetch } from "../../shared/apiClient";

export type Issue = components["schemas"]["Issue"];
export type IssueStatus = components["schemas"]["IssueStatus"];
export type Priority = components["schemas"]["Priority"];

export interface IssueListProps {
  onSelectIssue: (publicId: string) => void;
  onNewIssue: () => void;
}

export function IssueList({ onSelectIssue, onNewIssue }: IssueListProps) {
  const { meta } = useAuth();

  const [items, setItems] = useState<Issue[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [locationId, setLocationId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [priority, setPriority] = useState<string>("all");
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Debounce de la recherche textuelle
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchIssues = useCallback(
    async (cursorParam?: string | null, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", "20");

        if (cursorParam) {
          params.set("cursor", cursorParam);
        }
        if (debouncedQuery) {
          params.set("q", debouncedQuery);
        }
        if (status !== "all") {
          params.set("status", status);
        }
        if (locationId !== "") {
          params.set("locationId", String(locationId));
        }
        if (categoryId !== "") {
          params.set("categoryId", String(categoryId));
        }
        if (priority !== "all") {
          params.set("priority", priority);
        }

        const res = await apiFetch(`/api/issues?${params.toString()}`, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          throw new Error(`Erreur lors de la récupération des incidents (${res.status}).`);
        }

        const body = (await res.json()) as components["schemas"]["IssueListResponse"];
        if (!body.ok) {
          throw new Error("Réponse inattendue du serveur.");
        }

        if (append) {
          setItems((prev) => [...prev, ...body.data.items]);
        } else {
          setItems(body.data.items);
        }

        setNextCursor(body.data.nextCursor);
        setHasMore(body.data.hasMore);
      } catch (err: any) {
        setError(err.message || "Impossible de charger les incidents.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, status, locationId, categoryId, priority]
  );

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchIssues(nextCursor, true);
    }
  };

  const handleResetFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setStatus("all");
    setLocationId("");
    setCategoryId("");
    setPriority("all");
  };

  const hasActiveFilters =
    debouncedQuery !== "" || status !== "all" || locationId !== "" || categoryId !== "" || priority !== "all";

  // Helpers de rendu
  const getLocationLabel = (locId?: number) => {
    if (!locId) return "Succursale non définie";
    return meta?.locations.find((l) => l.id === locId)?.label || `Succursale #${locId}`;
  };


  const getCategoryLabel = (catId: number) => {
    return meta?.categories.find((c) => c.id === catId)?.label || `Catégorie #${catId}`;
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
        return <span style={{ color: "var(--color-danger)", fontWeight: "bold", fontSize: "0.8rem" }}>🔴 Urgente</span>;
      case "important":
        return <span style={{ color: "var(--color-warning)", fontWeight: "bold", fontSize: "0.8rem" }}>🟠 Importante</span>;
      case "normal":
        return <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>⚪ Normale</span>;
    }
  };

  return (
    <div data-testid="issue-list-container">
      {/* Barre d'outils supérieure */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.35rem" }}>Registre des incidents</h2>
        <button type="button" className="btn btn-primary" onClick={onNewIssue} data-testid="btn-new-from-list">
          ➕ Nouveau
        </button>
      </div>

      {/* Barre de recherche et bouton de filtres */}
      <div className="card" style={{ padding: "0.875rem 1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="search"
            className="form-control"
            placeholder="Rechercher par mot-clé, numéro (INC-...), description..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Recherche textuelle"
            data-testid="search-input"
          />
          <button
            type="button"
            className={`btn ${showFilters ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "0.5rem 0.85rem", whiteSpace: "nowrap" }}
            onClick={() => setShowFilters(!showFilters)}
            data-testid="toggle-filters-btn"
          >
            Filtres {hasActiveFilters ? "●" : ""}
          </button>
        </div>

        {/* Panneau rétractable de filtres */}
        {showFilters && (
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
              {/* Statut */}
              <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="filter-status" className="form-label">Statut</label>
                <select
                  id="filter-status"
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">Tous les statuts</option>
                  <option value="new">Nouveau</option>
                  <option value="inProgress">En cours</option>
                  <option value="waiting">En attente</option>
                  <option value="resolved">Résolu</option>
                </select>
              </div>

              {/* Succursale */}
              <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="filter-location" className="form-label">Succursale</label>
                <select
                  id="filter-location"
                  className="form-control"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Toutes les succursales</option>
                  {meta?.locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.label}</option>
                  ))}
                </select>
              </div>

              {/* Catégorie */}
              <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="filter-category" className="form-label">Catégorie</label>
                <select
                  id="filter-category"
                  className="form-control"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Toutes les catégories</option>
                  {meta?.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Priorité */}
              <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="filter-priority" className="form-label">Priorité</label>
                <select
                  id="filter-priority"
                  className="form-control"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="all">Toutes les priorités</option>
                  <option value="urgent">Urgente</option>
                  <option value="important">Importante</option>
                  <option value="normal">Normale</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" style={{ fontSize: "0.85rem", minHeight: "36px" }} onClick={handleResetFilters}>
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <p style={{ margin: "0 0 0.5rem 0" }}>{error}</p>
          <button type="button" className="btn btn-secondary" style={{ fontSize: "0.85rem" }} onClick={() => fetchIssues()}>
            Réessayer
          </button>
        </div>
      )}

      {/* Liste des incidents */}
      {loading ? (
        <div className="state-container" data-testid="list-loading">
          <div className="state-title">Chargement des dossiers...</div>
        </div>
      ) : items.length === 0 ? (
        <div className="card state-container" data-testid="list-empty">
          <div style={{ fontSize: "2.5rem" }}>📭</div>
          <div className="state-title">Aucun incident trouvé</div>
          <p className="state-message">
            {hasActiveFilters
              ? "Aucun dossier ne correspond à vos critères de recherche ou de filtrage."
              : "Le registre ne contient aucun incident pour l'instant."}
          </p>
          {hasActiveFilters && (
            <button type="button" className="btn btn-secondary" onClick={handleResetFilters}>
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} data-testid="issues-cards-list">
          {items.map((issue) => (
            <div
              key={issue.publicId}
              className="card"
              style={{
                cursor: "pointer",
                padding: "1rem",
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
                borderLeft: issue.priority === "urgent" ? "4px solid var(--color-danger)" : issue.priority === "important" ? "4px solid var(--color-warning)" : undefined,
              }}
              onClick={() => onSelectIssue(issue.publicId)}
              data-testid={`issue-card-${issue.publicId}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectIssue(issue.publicId);
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--color-primary)" }}>
                    {issue.publicId}
                  </span>
                  {getStatusBadge(issue.status)}
                </div>
                <div>{getPriorityBadge(issue.priority)}</div>
              </div>

              <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <span>📅 {issue.occurredOn}</span>
                <span>📍 {getLocationLabel(issue.locationId)}</span>
                <span>🏷️ {getCategoryLabel(issue.categoryId)}</span>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  color: "var(--color-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {issue.description}
              </p>

              {issue.status === "waiting" && issue.waitingOn && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#5b21b6", background: "#f5f3ff", padding: "0.25rem 0.5rem", borderRadius: "4px", display: "inline-block" }}>
                  ⏳ Attente : {issue.waitingOn.type === "customer" ? "Client" : issue.waitingOn.type === "supplier" ? "Fournisseur" : "Utilisateur"}
                </div>
              )}
            </div>
          ))}

          {/* Bouton de pagination par curseur */}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: "1rem", marginBottom: "2rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minWidth: "200px" }}
                onClick={handleLoadMore}
                disabled={loadingMore}
                data-testid="load-more-btn"
              >
                {loadingMore ? "Chargement..." : "⬇️ Charger plus d'incidents"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

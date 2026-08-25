import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { PATHS, issueDetailPath } from "../../routes/paths";
import { businessToday } from "../../shared/businessDate";
import type { components } from "../../shared/api-types.generated";
import { apiFetch } from "../../shared/apiClient";

export type Issue = components["schemas"]["Issue"];
export type IssueStatus = components["schemas"]["IssueStatus"];
export type Priority = components["schemas"]["Priority"];

/**
 * Registre.
 *
 * Les filtres vivent dans l'URL, pas dans un état local
 * (01_produit/ux/01_NAVIGATION_ET_ARBORESCENCE.md : « les filtres du Registre
 * doivent vivre dans l'URL afin que refresh/retour navigateur ne les perde
 * pas »). C'est ce qui satisfait S39 — revenir d'un dossier restitue la liste
 * telle qu'elle était — et ce qui rend une vue filtrée partageable entre
 * collègues.
 */
export function IssueList() {
  const { meta, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /** Lit un filtre depuis l'URL, avec sa valeur par défaut. */
  const param = (key: string, fallback = "") => searchParams.get(key) ?? fallback;

  /**
   * Écrit un filtre dans l'URL. `replace: true` : ajuster un filtre ne doit pas
   * empiler une entrée d'historique par frappe, sinon le bouton Retour du
   * navigateur devient inutilisable.
   */
  const setParam = (key: string, value: string, emptyValue = "") => {
    const next = new URLSearchParams(searchParams);
    if (value === emptyValue || value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const [items, setItems] = useState<Issue[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filtres — source unique : l'URL.
  const query = param("q");
  const status = param("status", "all");
  const priority = param("priority", "all");
  const locationId: number | "" = param("locationId") ? Number(param("locationId")) : "";
  const categoryId: number | "" = param("categoryId") ? Number(param("categoryId")) : "";
  const ownerUserId: number | "" = param("ownerUserId") ? Number(param("ownerUserId")) : "";
  const errorActorUserId: number | "" = param("errorActorUserId") ? Number(param("errorActorUserId")) : "";
  const sort = param("sort", "newest");

  const setQuery = (value: string) => setParam("q", value);
  const setStatus = (value: string) => setParam("status", value, "all");
  const setPriority = (value: string) => setParam("priority", value, "all");
  const setLocationId = (value: number | "") => setParam("locationId", value === "" ? "" : String(value));
  const setCategoryId = (value: number | "") => setParam("categoryId", value === "" ? "" : String(value));
  const setOwnerUserId = (value: number | "") => setParam("ownerUserId", value === "" ? "" : String(value));
  const setErrorActorUserId = (value: number | "") => setParam("errorActorUserId", value === "" ? "" : String(value));
  const setSort = (value: string) => setParam("sort", value, "newest");

  // Ouvrir le panneau d'emblée si l'URL porte déjà des filtres : sur un lien
  // partagé ou un retour depuis un dossier, l'utilisateur doit voir de quoi la
  // liste est filtrée sans avoir à déplier quoi que ce soit.
  const [showFilters, setShowFilters] = useState<boolean>(
    () => status !== "all" || priority !== "all" || locationId !== "" || categoryId !== "" || ownerUserId !== "" || errorActorUserId !== ""
  );

  // La recherche est dé-rebondie avant l'appel réseau, pas avant l'écriture
  // dans l'URL : le champ doit rester réactif à la frappe.
  const [debouncedQuery, setDebouncedQuery] = useState<string>(query.trim());
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
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
        if (ownerUserId !== "") params.set("ownerUserId", String(ownerUserId));
        if (errorActorUserId !== "") params.set("errorActorUserId", String(errorActorUserId));
        params.set("sort", sort);

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
    [debouncedQuery, status, locationId, categoryId, priority, ownerUserId, errorActorUserId, sort]
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
    setDebouncedQuery("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters =
    debouncedQuery !== "" || status !== "all" || locationId !== "" || categoryId !== "" || priority !== "all" || ownerUserId !== "" || errorActorUserId !== "";

  // Helpers de rendu
  const getLocationLabel = (locId?: number) => {
    if (!locId) return "Succursale non définie";
    return meta?.locations.find((l) => l.id === locId)?.label || `Succursale #${locId}`;
  };


  /**
   * 03_ECRAN_REGISTRE.md §Carte dossier : le responsable est « toujours
   * affiché », y compris quand il n'y en a pas — c'est précisément
   * l'information utile pour un gestionnaire qui balaie la liste à la
   * recherche de ce qui n'a été pris en charge par personne.
   */
  const getOwnerLabel = (ownerUserId?: number | null) => {
    if (!ownerUserId) return "Non assigné";
    const directoryUser = meta?.users.find((candidate) => candidate.id === ownerUserId);
    if (user && user.id === ownerUserId) return `${user.displayName} (vous)`;
    return directoryUser
      ? `${directoryUser.displayName}${directoryUser.active ? "" : " (inactif)"}`
      : `Responsable #${ownerUserId}`;
  };

  const getErrorActorLabel = (errorActorUserId?: number | null) => {
    if (!errorActorUserId) return "Attribution inconnue";
    const directoryUser = meta?.users.find((candidate) => candidate.id === errorActorUserId);
    return directoryUser
      ? `${directoryUser.displayName}${directoryUser.active ? "" : " (inactif)"}`
      : `Employé #${errorActorUserId}`;
  };

  /** Échéance dépassée = date métier strictement postérieure, cf. 08_DEFINITIONS_ANALYTIQUES.md. */
  const isOverdue = (issue: Issue) =>
    issue.dueDate != null &&
    issue.status !== "resolved" &&
    issue.dueDate < businessToday(meta?.config.businessTimeZone ?? "America/Toronto");

  const getCategoryLabel = (catId: number) => {
    return meta?.categories.find((c) => c.id === catId)?.label || `Catégorie #${catId}`;
  };

  const getStatusBadge = (st: IssueStatus) => {
    switch (st) {
      case "new":
        return <span className="role-badge" style={{ backgroundColor: "var(--st-new-bg)", color: "var(--st-new-fg)" }}>Nouveau</span>;
      case "inProgress":
        return <span className="role-badge" style={{ backgroundColor: "var(--st-prog-bg)", color: "var(--st-prog-fg)" }}>En cours</span>;
      case "waiting":
        return <span className="role-badge" style={{ backgroundColor: "var(--st-wait-bg)", color: "var(--st-wait-fg)" }}>En attente</span>;
      case "resolved":
        return <span className="role-badge" style={{ backgroundColor: "var(--st-done-bg)", color: "var(--st-done-fg)" }}>Résolu</span>;
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
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor="issue-sort" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Trier</label>
          <select id="issue-sort" className="form-control" value={sort} onChange={(e) => setSort(e.target.value)} data-testid="issue-sort" style={{ minWidth: "145px" }}>
            <option value="newest">Plus récents</option>
            <option value="oldest">Plus anciens</option>
            <option value="priority">Priorité</option>
            <option value="dueDate">Échéance</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => navigate(PATHS.newIssue)} data-testid="btn-new-from-list">
            ➕ Nouveau
          </button>
        </div>
      </div>

      {/* Barre de recherche et bouton de filtres */}
      <div className="card" style={{ padding: "0.875rem 1rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
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

              <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="filter-owner" className="form-label">Responsable</label>
                <select id="filter-owner" className="form-control" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Tous les responsables</option>
                  {meta?.users.map((directoryUser) => (
                    <option key={directoryUser.id} value={directoryUser.id}>{directoryUser.displayName}{directoryUser.active ? "" : " (inactif)"}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="filter-error-actor" className="form-label">Employé concerné</label>
                <select id="filter-error-actor" className="form-control" value={errorActorUserId} onChange={(e) => setErrorActorUserId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Tous les employés</option>
                  {meta?.users.map((directoryUser) => (
                    <option key={directoryUser.id} value={directoryUser.id}>{directoryUser.displayName}{directoryUser.active ? "" : " (inactif)"}</option>
                  ))}
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
              onClick={() => navigate(issueDetailPath(issue.publicId))}
              data-testid={`issue-card-${issue.publicId}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(issueDetailPath(issue.publicId));
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
                <span data-testid={`issue-owner-${issue.publicId}`}>
                  👤 {getOwnerLabel(issue.ownerUserId)}
                </span>
                <span data-testid={`issue-error-actor-${issue.publicId}`}>
                  🎯 Employé : {getErrorActorLabel(issue.errorActorUserId)}
                </span>
                {issue.dueDate && (
                  <span
                    data-testid={`issue-due-${issue.publicId}`}
                    style={isOverdue(issue) ? { color: "var(--color-danger)", fontWeight: 600 } : undefined}
                  >
                    ⏳ Échéance : {issue.dueDate}
                    {isOverdue(issue) ? " (en retard)" : ""}
                  </span>
                )}
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
                <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--st-wait-fg)", background: "var(--st-wait-bg)", padding: "0.25rem 0.5rem", borderRadius: "4px", display: "inline-block" }}>
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

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";
import { apiFetch } from "../../shared/apiClient";
import { useNavigate, useSearchParams } from "react-router";
import { issueDetailPath } from "../../routes/paths";
import { businessToday } from "../../shared/businessDate";

export type ApiAnalyticsSummary = components["schemas"]["AnalyticsSummary"];
export type ApiRecurringGroup = components["schemas"]["RecurringGroup"];
export type ApiEffectiveness = components["schemas"]["Effectiveness"];
export type ApiEmployeeErrorStat = components["schemas"]["EmployeeErrorStat"];
export type ApiIssue = components["schemas"]["Issue"];

type AnalyticsSubView = "summary" | "recurring" | "employees" | "effectiveness" | "reviews";

/**
 * Tableau de bord analytique.
 *
 * Comme pour le Registre, les filtres et l'onglet actif vivent dans l'URL :
 * un tableau de bord filtré n'a d'intérêt que s'il se partage tel quel avec
 * un collègue, et l'export CSV doit correspondre à ce que son destinataire
 * verra en ouvrant le lien.
 */
export function AnalyticsView() {
  const { meta, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const onSelectIssue = (publicId: string) => navigate(issueDetailPath(publicId));

  const param = (key: string, fallback = "") => searchParams.get(key) ?? fallback;
  const setParam = (key: string, value: string, emptyValue = "") => {
    const next = new URLSearchParams(searchParams);
    if (value === emptyValue || value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const requestedSubView = param("vue", "summary") as AnalyticsSubView;
  const canViewEmployeeErrors = user?.role === "manager" || user?.role === "admin";
  // Un lien partagé vers la vue protégée ne doit pas laisser un employé sur
  // un tableau vide : l'API reste protégée et l'interface revient à Synthèse.
  const activeSubView = requestedSubView === "employees" && !canViewEmployeeErrors
    ? "summary"
    : requestedSubView;
  const setActiveSubView = (value: AnalyticsSubView) => setParam("vue", value, "summary");

  // Filtres globaux
  const dateFrom = param("dateFrom");
  const dateTo = param("dateTo");
  const locationId: number | "" = param("locationId") ? Number(param("locationId")) : "";
  const categoryId: number | "" = param("categoryId") ? Number(param("categoryId")) : "";
  const reviewDueBefore = param(
    "effectivenessReviewDueBefore",
    businessToday(meta?.config.businessTimeZone ?? "America/Toronto")
  );

  const setDateFrom = (value: string) => setParam("dateFrom", value);
  const setDateTo = (value: string) => setParam("dateTo", value);
  const setLocationId = (value: number | "") => setParam("locationId", value === "" ? "" : String(value));
  const setCategoryId = (value: number | "") => setParam("categoryId", value === "" ? "" : String(value));

  // Données
  const [summary, setSummary] = useState<ApiAnalyticsSummary | null>(null);
  const [recurring, setRecurring] = useState<ApiRecurringGroup[]>([]);
  const [effectiveness, setEffectiveness] = useState<ApiEffectiveness | null>(null);
  const [employeeErrors, setEmployeeErrors] = useState<ApiEmployeeErrorStat[]>([]);
  const [pendingReviewIssues, setPendingReviewIssues] = useState<ApiIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const query = new URLSearchParams();
    if (dateFrom) query.set("from", dateFrom);
    if (dateTo) query.set("to", dateTo);
    if (locationId) query.set("locationId", String(locationId));
    if (categoryId) query.set("categoryId", String(categoryId));

    const qs = query.toString() ? `?${query.toString()}` : "";

    try {
      const [sumRes, recRes, effRes, issuesRes, employeeRes] = await Promise.all([
        apiFetch(`/api/analytics/summary${qs}`, { headers: { Accept: "application/json" } }),
        apiFetch(`/api/analytics/recurring${qs}`, { headers: { Accept: "application/json" } }),
        apiFetch(`/api/analytics/effectiveness${qs}`, { headers: { Accept: "application/json" } }),
        apiFetch(`/api/issues?effectivenessReviewDueBefore=${encodeURIComponent(reviewDueBefore)}&limit=50`, { headers: { Accept: "application/json" } }),
        canViewEmployeeErrors
          ? apiFetch(`/api/analytics/errors-by-employee${qs}`, { headers: { Accept: "application/json" } })
          : Promise.resolve(null),
      ]);

      if (sumRes.ok) {
        const sumData = (await sumRes.json()) as components["schemas"]["AnalyticsSummaryResponse"];
        if (sumData.ok) setSummary(sumData.data);
      }

      if (recRes.ok) {
        const recData = (await recRes.json()) as components["schemas"]["RecurringResponse"];
        if (recData.ok) setRecurring(recData.data);
      }

      if (effRes.ok) {
        const effData = (await effRes.json()) as components["schemas"]["EffectivenessResponse"];
        if (effData.ok) setEffectiveness(effData.data);
      }

      if (issuesRes.ok) {
        const issuesData = (await issuesRes.json()) as components["schemas"]["IssueListResponse"];
        if (issuesData.ok && Array.isArray(issuesData.data.items)) {
          const pending = issuesData.data.items.filter((it) => it.effectivenessStatus === "pending");
          setPendingReviewIssues(pending);
        }
      }

      if (employeeRes?.ok) {
        const employeeData = (await employeeRes.json()) as components["schemas"]["EmployeeErrorStatsResponse"];
        if (employeeData.ok) setEmployeeErrors(employeeData.data);
      } else if (!canViewEmployeeErrors) {
        setEmployeeErrors([]);
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement des données d'analyse.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, locationId, categoryId, reviewDueBefore, canViewEmployeeErrors]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Export CSV
  const handleExportCSV = () => {
    if (!summary) return;

    const rows = [
      ["Indicateur", "Valeur"],
      ["Dossiers ouverts", summary.open],
      ["Dossiers urgents", summary.urgent],
      ["Dossiers en retard", summary.overdue],
      ["Dossiers en attente", summary.waiting],
      ["Dossiers résolus", summary.resolved],
      ["Efficacité en attente", summary.pendingEffectiveness],
      ["Temps moyen de résolution (heures)", summary.averageResolutionHours ?? "N/A"],
      [],
      ["Récurrences locales", recurring.filter((r) => r.scope === "location").length],
      ["Récurrences organisation", recurring.filter((r) => r.scope === "organization").length],
      [],
      ["Taux d'efficacité", effectiveness?.effectivenessRate ? `${(effectiveness.effectivenessRate * 100).toFixed(0)}%` : "N/A"],
      ["Corrections effectives", effectiveness?.effective ?? 0],
      ["Corrections inefficaces", effectiveness?.ineffective ?? 0],
      ["Corrections en attente", effectiveness?.pending ?? 0],
      [],
      ["Erreurs attribuées par employé et type", employeeErrors.length],
      ...employeeErrors.map((item) => [
        item.displayName,
        getSubcategoryLabel(item.subcategoryId),
        item.count,
        item.latestIssuePublicId,
      ]),
    ];

    const csvContent = "\uFEFF" + rows.map((e) => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
        // Date métier, pas `toISOString()` : en soirée à Montréal l'UTC est déjà
    // au lendemain et l'export porterait la date du jour suivant.
    link.setAttribute(
      "download",
      `registre_analyse_${businessToday(meta?.config.businessTimeZone ?? "America/Toronto")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getLocationLabel = (locId?: number | null) => {
    if (!locId) return "Organisation entière";
    return meta?.locations.find((l) => l.id === locId)?.label || `Succursale #${locId}`;
  };

  const getSubcategoryLabel = (subId: number) => {
    return meta?.subcategories.find((s) => s.id === subId)?.label || `Sous-catégorie #${subId}`;
  };

  const localRecurring = recurring.filter((g) => g.scope === "location");
  const orgRecurring = recurring.filter((g) => g.scope === "organization");

  return (
    <div data-testid="analytics-view">
      {/* En-tête avec bouton Export */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.35rem", color: "var(--color-primary)" }}>
          📊 Tableau de bord & Analytique
        </h1>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleExportCSV}
          disabled={loading || !summary}
          data-testid="btn-export-csv"
        >
          📥 Exporter en CSV
        </button>
      </div>

      {/* Barre de filtres */}
      <div className="card" style={{ marginBottom: "1rem", padding: "0.85rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", alignItems: "end" }}>
          <div>
            <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.2rem" }}>Date du</label>
            <input
              type="date"
              className="form-control"
              style={{ padding: "0.4rem", minHeight: "38px", fontSize: "0.85rem" }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.2rem" }}>Au</label>
            <input
              type="date"
              className="form-control"
              style={{ padding: "0.4rem", minHeight: "38px", fontSize: "0.85rem" }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.2rem" }}>Succursale</label>
            <select
              className="form-control"
              style={{ padding: "0.4rem", minHeight: "38px", fontSize: "0.85rem" }}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Toutes</option>
              {meta?.locations.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.2rem" }}>Catégorie</label>
            <select
              className="form-control"
              style={{ padding: "0.4rem", minHeight: "38px", fontSize: "0.85rem" }}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Toutes</option>
              {meta?.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Navigation des sous-vues */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeSubView === "summary" ? "active" : ""}`}
          onClick={() => setActiveSubView("summary")}
          data-testid="subtab-summary"
        >
          📈 Synthèse
        </button>
        <button
          type="button"
          className={`tab-btn ${activeSubView === "recurring" ? "active" : ""}`}
          onClick={() => setActiveSubView("recurring")}
          data-testid="subtab-recurring"
        >
          🔄 Récurrences ({recurring.length})
        </button>
        {(user?.role === "manager" || user?.role === "admin") && (
          <button
            type="button"
            className={`tab-btn ${activeSubView === "employees" ? "active" : ""}`}
            onClick={() => setActiveSubView("employees")}
            data-testid="subtab-employees"
          >
            👥 Erreurs par employé ({employeeErrors.length})
          </button>
        )}
        <button
          type="button"
          className={`tab-btn ${activeSubView === "effectiveness" ? "active" : ""}`}
          onClick={() => setActiveSubView("effectiveness")}
          data-testid="subtab-effectiveness"
        >
          🎯 Efficacité
        </button>
        <button
          type="button"
          className={`tab-btn ${activeSubView === "reviews" ? "active" : ""}`}
          onClick={() => setActiveSubView("reviews")}
          data-testid="subtab-reviews"
        >
          ⏳ Révisions dues ({pendingReviewIssues.length})
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="card state-container">
          <div className="state-title">Chargement des données analytiques...</div>
        </div>
      ) : (
        <>
          {/* 1. Vue Synthèse */}
          {activeSubView === "summary" && summary && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                <div className="card" style={{ margin: 0, padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-primary)" }}>{summary.open}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Dossiers ouverts</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-danger)" }}>{summary.urgent}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Urgents</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-warning)" }}>{summary.overdue}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>En retard</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--st-wait-fg)" }}>{summary.waiting}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>En attente</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-success)" }}>{summary.resolved}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Résolus</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--info)" }}>{summary.pendingEffectiveness}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Évaluation pending</div>
                </div>
              </div>

              {summary.averageResolutionHours !== null && summary.averageResolutionHours !== undefined && (
                <div className="card" style={{ backgroundColor: "var(--info-bg)", borderColor: "var(--info)" }}>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "var(--info)" }}>⏱️ Temps moyen de résolution (MTTR)</h3>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--info)" }}>
                    {summary.averageResolutionHours} heures
                  </div>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                    Calculé en heures calendaires entre la création et la clôture des dossiers résolus.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 2. Vue Récurrences */}
          {activeSubView === "recurring" && (
            <div>
              {/* Bloc 1 : Dans une succursale */}
              <div className="card" style={{ marginBottom: "1rem" }}>
                <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", color: "var(--color-primary)" }}>
                  📍 Récurrences dans une succursale (Scope: Locale)
                </h3>
                {localRecurring.length === 0 ? (
                  <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", margin: 0 }}>
                    Aucun groupe local n'atteint le seuil de 3 incidents sur 90 jours.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {localRecurring.map((g, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.65rem 0.85rem",
                          border: "var(--bw) solid var(--warn)",
                          backgroundColor: "var(--warn-bg)",
                          borderRadius: "var(--radius)",
                        }}
                      >
                        <div>
                          <strong>{getLocationLabel(g.locationId)}</strong> — {getSubcategoryLabel(g.subcategoryId)}
                          <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                            Dernier incident : {g.latestIssuePublicId}
                          </div>
                        </div>
                        <span className="role-badge" style={{ backgroundColor: "var(--warn)", color: "var(--surface)", fontSize: "0.85rem" }}>
                          {g.count} incidents / 90j
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bloc 2 : Dans l'organisation */}
              <div className="card">
                <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", color: "var(--st-wait-fg)" }}>
                  🏢 Récurrences dans l'organisation (Scope: Entreprise)
                </h3>
                {orgRecurring.length === 0 ? (
                  <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", margin: 0 }}>
                    Aucune récurrence globale identifiée sur 90 jours.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {orgRecurring.map((g, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.65rem 0.85rem",
                          border: "var(--bw) solid var(--line)",
                          backgroundColor: "var(--surface-2)",
                          borderRadius: "var(--radius)",
                        }}
                      >
                        <div>
                          <strong>{getSubcategoryLabel(g.subcategoryId)}</strong>
                          <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                            Dernier incident : {g.latestIssuePublicId}
                          </div>
                        </div>
                        <span className="role-badge" style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)", fontSize: "0.85rem" }}>
                          {g.count} incidents / 90j
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Erreurs par employé — manager/admin seulement */}
          {activeSubView === "employees" && (user?.role === "manager" || user?.role === "admin") && (
            <div className="card" data-testid="employee-error-stats">
              <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem" }}>👥 Types d'erreurs par employé</h3>
              <p style={{ margin: "0 0 1rem 0", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                Donnée opérationnelle destinée à orienter la formation et l'amélioration des processus. Aucun courriel n'est affiché.
              </p>
              {employeeErrors.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", margin: 0 }}>Aucune erreur attribuée dans la période sélectionnée.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "0.5rem" }}>Employé</th>
                        <th style={{ textAlign: "left", padding: "0.5rem" }}>Type d'erreur</th>
                        <th style={{ textAlign: "right", padding: "0.5rem" }}>Nombre</th>
                        <th style={{ textAlign: "left", padding: "0.5rem" }}>Dernier dossier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeErrors.map((item) => (
                        <tr key={`${item.userId}-${item.subcategoryId}`} style={{ borderTop: "1px solid var(--color-border)" }}>
                          <td style={{ padding: "0.5rem" }}>{item.displayName}{item.active ? "" : " (inactif)"}</td>
                          <td style={{ padding: "0.5rem" }}>{getSubcategoryLabel(item.subcategoryId)}</td>
                          <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 700 }}>{item.count}</td>
                          <td style={{ padding: "0.5rem" }}>
                            <button type="button" className="btn btn-secondary" style={{ minHeight: "32px", padding: "0.25rem 0.5rem" }} onClick={() => onSelectIssue(item.latestIssuePublicId)}>
                              {item.latestIssuePublicId}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. Vue Efficacité */}
          {activeSubView === "effectiveness" && effectiveness && (
            <div>
              <div className="card" style={{ marginBottom: "1rem", textAlign: "center", padding: "1.5rem" }}>
                <div style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                  Taux d'efficacité des corrections
                </div>
                <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--color-success)" }}>
                  {effectiveness.effectivenessRate !== null && effectiveness.effectivenessRate !== undefined
                    ? `${(effectiveness.effectivenessRate * 100).toFixed(0)}%`
                    : "N/A"}
                </div>
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                  Les corrections en attente de validation ne sont pas incluses dans le taux.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
                <div className="card" style={{ margin: 0, padding: "1rem", backgroundColor: "var(--ok-bg)", borderColor: "var(--ok)" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ok)" }}>{effectiveness.effective}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Corrections efficaces</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", backgroundColor: "var(--crit-bg)", borderColor: "var(--crit)" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--crit)" }}>{effectiveness.ineffective}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Corrections inefficaces</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", backgroundColor: "var(--surface-2)" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-muted)" }}>{effectiveness.pending}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>En attente d'évaluation</div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Vue Révisions dues */}
          {activeSubView === "reviews" && (
            <div className="card">
              <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem" }}>
                ⏳ Dossiers en attente d'évaluation d'efficacité ({pendingReviewIssues.length})
              </h3>
              {pendingReviewIssues.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", margin: 0 }}>
                  Aucune révision d'efficacité en attente pour le moment.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {pendingReviewIssues.map((iss) => (
                    <div
                      key={iss.publicId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius)",
                        backgroundColor: "var(--color-bg)",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                      data-testid={`review-item-${iss.publicId}`}
                    >
                      <div>
                        <strong>{iss.publicId}</strong> — {iss.permanentCorrectionType || "Correction permanente"}
                        <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                          Date de révision : {iss.effectivenessReviewDate || "Non définie"} • Responsable : Utilisateur #{iss.ownerUserId || "N/A"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: "0.3rem 0.75rem", minHeight: "auto", fontSize: "0.85rem" }}
                        onClick={() => onSelectIssue && onSelectIssue(iss.publicId)}
                        data-testid={`btn-evaluate-${iss.publicId}`}
                      >
                        Évaluer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

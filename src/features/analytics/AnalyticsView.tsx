import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";

export type ApiAnalyticsSummary = components["schemas"]["AnalyticsSummary"];
export type ApiRecurringGroup = components["schemas"]["RecurringGroup"];
export type ApiEffectiveness = components["schemas"]["Effectiveness"];
export type ApiIssue = components["schemas"]["Issue"];

type AnalyticsSubView = "summary" | "recurring" | "effectiveness" | "reviews";

interface AnalyticsViewProps {
  onSelectIssue?: (publicId: string) => void;
}

export function AnalyticsView({ onSelectIssue }: AnalyticsViewProps) {
  const { meta } = useAuth();

  const [activeSubView, setActiveSubView] = useState<AnalyticsSubView>("summary");

  // Filtres globaux
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");

  // Données
  const [summary, setSummary] = useState<ApiAnalyticsSummary | null>(null);
  const [recurring, setRecurring] = useState<ApiRecurringGroup[]>([]);
  const [effectiveness, setEffectiveness] = useState<ApiEffectiveness | null>(null);
  const [pendingReviewIssues, setPendingReviewIssues] = useState<ApiIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const query = new URLSearchParams();
    if (dateFrom) query.set("dateFrom", dateFrom);
    if (dateTo) query.set("dateTo", dateTo);
    if (locationId) query.set("locationId", String(locationId));
    if (categoryId) query.set("categoryId", String(categoryId));

    const qs = query.toString() ? `?${query.toString()}` : "";

    try {
      const [sumRes, recRes, effRes, issuesRes] = await Promise.all([
        fetch(`/api/analytics/summary${qs}`, { headers: { Accept: "application/json" } }),
        fetch(`/api/analytics/recurring${qs}`, { headers: { Accept: "application/json" } }),
        fetch(`/api/analytics/effectiveness${qs}`, { headers: { Accept: "application/json" } }),
        fetch(`/api/issues?status=resolved&limit=50`, { headers: { Accept: "application/json" } }),
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
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement des données d'analyse.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, locationId, categoryId]);

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
    ];

    const csvContent = "\uFEFF" + rows.map((e) => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `registre_analyse_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#7c3aed" }}>{summary.waiting}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>En attente</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-success)" }}>{summary.resolved}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Résolus</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0891b2" }}>{summary.pendingEffectiveness}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Évaluation pending</div>
                </div>
              </div>

              {summary.averageResolutionHours !== null && summary.averageResolutionHours !== undefined && (
                <div className="card" style={{ backgroundColor: "#f0f9ff", borderColor: "#bae6fd" }}>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", color: "#0369a1" }}>⏱️ Temps moyen de résolution (MTTR)</h3>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0284c7" }}>
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
                          border: "1px solid #fed7aa",
                          backgroundColor: "#fff7ed",
                          borderRadius: "var(--radius)",
                        }}
                      >
                        <div>
                          <strong>{getLocationLabel(g.locationId)}</strong> — {getSubcategoryLabel(g.subcategoryId)}
                          <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                            Dernier incident : {g.latestIssuePublicId}
                          </div>
                        </div>
                        <span className="role-badge" style={{ backgroundColor: "#ea580c", color: "#ffffff", fontSize: "0.85rem" }}>
                          {g.count} incidents / 90j
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bloc 2 : Dans l'organisation */}
              <div className="card">
                <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", color: "#7c3aed" }}>
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
                          border: "1px solid #e9d5ff",
                          backgroundColor: "#faf5ff",
                          borderRadius: "var(--radius)",
                        }}
                      >
                        <div>
                          <strong>{getSubcategoryLabel(g.subcategoryId)}</strong>
                          <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                            Dernier incident : {g.latestIssuePublicId}
                          </div>
                        </div>
                        <span className="role-badge" style={{ backgroundColor: "#9333ea", color: "#ffffff", fontSize: "0.85rem" }}>
                          {g.count} incidents / 90j
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Vue Efficacité */}
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
                <div className="card" style={{ margin: 0, padding: "1rem", backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#166534" }}>{effectiveness.effective}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Corrections efficaces</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", backgroundColor: "#fef2f2", borderColor: "#fecaca" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#991b1b" }}>{effectiveness.ineffective}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Corrections inefficaces</div>
                </div>
                <div className="card" style={{ margin: 0, padding: "1rem", backgroundColor: "#f8fafc" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-muted)" }}>{effectiveness.pending}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>En attente d'évaluation</div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Vue Révisions dues */}
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

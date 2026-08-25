import React, { useState } from "react";
import type { components } from "../../shared/api-types.generated";

export type ApiIssue = components["schemas"]["Issue"];

interface RedactModalProps {
  issue: ApiIssue;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function RedactModal({ issue, onClose, onSuccess }: RedactModalProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableFields: { key: string; label: string; value: string | null }[] = [
    { key: "description", label: "Description des faits", value: issue.description },
    { key: "causeSummary", label: "Résumé de la cause", value: issue.causeSummary || null },
    { key: "immediateSolution", label: "Solution immédiate", value: issue.immediateSolution || null },
    { key: "permanentCorrectionSummary", label: "Résumé de la correction permanente", value: issue.permanentCorrectionSummary || null },
    { key: "finalResult", label: "Résultat final", value: issue.finalResult || null },
    { key: "preventionLearning", label: "Apprentissages pour la prévention", value: issue.preventionLearning || null },
  ].filter((f) => f.value !== null && f.value !== "[CAVIARDÉ]");

  const toggleField = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((k) => k !== fieldKey) : [...prev, fieldKey]
    );
  };

  const handleRedact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFields.length === 0) {
      setError("Veuillez sélectionner au moins un champ à caviarder.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Le motif de caviardage doit comporter au moins 5 caractères.");
      return;
    }

    if (!window.confirm("Action irréversible : Les données sélectionnées seront définitivement remplacées par '[CAVIARDÉ]'. Confirmer le caviardage ?")) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/issues/${issue.publicId}/redact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          issueTextFields: selectedFields,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Erreur lors du caviardage.");
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Échec de l'opération de caviardage.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" data-testid="modal-redact-issue">
      <div className="modal-card" style={{ maxWidth: "550px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--color-danger)" }}>
            🛡️ Caviardage de sécurité — {issue.publicId}
          </h2>
          <button type="button" className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem" }} onClick={onClose}>
            ✕
          </button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
          Cette opération de confidentialité remplace définitivement les données personnelles ou sensibles par <code>[CAVIARDÉ]</code> sans enregistrer les anciennes valeurs dans l'historique d'audit.
        </p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleRedact} data-testid="form-redact">
          <div className="form-group">
            <label className="form-label required">Champs texte à caviarder</label>
            {availableFields.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Tous les champs texte sont déjà caviardés ou vides.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.5rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}>
                {availableFields.map((f) => (
                  <label key={f.key} className="checkbox-label" style={{ fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(f.key)}
                      onChange={() => toggleField(f.key)}
                      data-testid={`checkbox-redact-${f.key}`}
                    />
                    <span><strong>{f.label}</strong> : {f.value && f.value.length > 50 ? `${f.value.slice(0, 50)}...` : f.value}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="redact-reason">
              Motif du caviardage (min 5 caractères)
            </label>
            <input
              id="redact-reason"
              type="text"
              className="form-control"
              placeholder="Ex : Demande de suppression de données personnelles (Loi 25 / RGPD)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              data-testid="input-redact-reason"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={submitting || selectedFields.length === 0 || reason.trim().length < 5}
              data-testid="btn-confirm-redact"
            >
              {submitting ? "Caviardage en cours..." : "Confirmer le caviardage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

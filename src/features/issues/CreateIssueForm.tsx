import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";

export type Priority = components["schemas"]["Priority"];
export type CreateIssueRequest = components["schemas"]["CreateIssueRequest"];
export type IssueDetail = components["schemas"]["IssueDetail"];
export type Issue = components["schemas"]["Issue"];

interface FormErrors {
  occurredOn?: string;
  locationId?: string;
  categoryId?: string;
  subcategoryId?: string;
  departmentId?: string;
  description?: string;
  priority?: string;
  impacts?: string;
  general?: string;
}

export interface CreateIssueFormProps {
  onSuccess?: (createdIssue: components["schemas"]["Issue"]) => void;
}

export function CreateIssueForm({ onSuccess }: CreateIssueFormProps) {
  const { user, meta } = useAuth();

  const todayStr = new Date().toISOString().slice(0, 10);

  const [occurredOn, setOccurredOn] = useState<string>(todayStr);
  const [locationId, setLocationId] = useState<number | "">(user?.defaultLocationId ?? "");
  const [departmentId, setDepartmentId] = useState<number | "">(user?.defaultDepartmentId ?? "");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [subcategoryId, setSubcategoryId] = useState<number | "">("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [selectedImpacts, setSelectedImpacts] = useState<Record<number, { selected: boolean; details: string }>>({});

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [createdIssue, setCreatedIssue] = useState<components["schemas"]["Issue"] | null>(null);


  // Initialiser les succursales / départements par défaut dès que le profil utilisateur est chargé
  useEffect(() => {
    if (user?.defaultLocationId && locationId === "") {
      setLocationId(user.defaultLocationId);
    }
    if (user?.defaultDepartmentId && departmentId === "") {
      setDepartmentId(user.defaultDepartmentId);
    }
  }, [user]);

  // Réinitialiser la sous-catégorie si la catégorie parente change
  const handleCategoryChange = (newCatId: number | "") => {
    setCategoryId(newCatId);
    setSubcategoryId("");
  };

  const handleImpactToggle = (typeId: number) => {
    setSelectedImpacts((prev) => {
      const current = prev[typeId] || { selected: false, details: "" };
      return {
        ...prev,
        [typeId]: {
          ...current,
          selected: !current.selected,
        },
      };
    });
  };

  const handleImpactDetailsChange = (typeId: number, details: string) => {
    setSelectedImpacts((prev) => ({
      ...prev,
      [typeId]: {
        selected: true,
        details,
      },
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!occurredOn) {
      newErrors.occurredOn = "La date de survenance est obligatoire.";
    }

    if (!locationId) {
      newErrors.locationId = "Veuillez sélectionner une succursale.";
    }

    if (!categoryId) {
      newErrors.categoryId = "Veuillez sélectionner une catégorie.";
    }

    if (!description || description.trim().length < 10) {
      newErrors.description = "La description doit comporter au moins 10 caractères.";
    } else if (description.length > 5000) {
      newErrors.description = "La description ne peut dépasser 5000 caractères.";
    }

    const activeSelectedImpacts = Object.entries(selectedImpacts).filter(([_, val]) => val.selected);
    if (activeSelectedImpacts.length === 0) {
      newErrors.impacts = "Veuillez sélectionner au moins un impact.";
    } else {
      // Vérifier si un impact "Autre" a été sélectionné sans précision
      const otherImpactType = meta?.impactTypes.find((it) => it.code === "other");
      if (otherImpactType && selectedImpacts[otherImpactType.id]?.selected) {
        const details = selectedImpacts[otherImpactType.id]?.details?.trim();
        if (!details) {
          newErrors.impacts = "Veuillez préciser le détail de l'impact 'Autre'.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const impactsPayload = Object.entries(selectedImpacts)
        .filter(([_, val]) => val.selected)
        .map(([idStr, val]) => ({
          impactTypeId: Number(idStr),
          details: val.details.trim() || null,
        }));

      const payload: CreateIssueRequest = {
        occurredOn,
        locationId: Number(locationId),
        categoryId: Number(categoryId),
        description: description.trim(),
        priority,
        impacts: impactsPayload,
      };

      if (departmentId !== "") {
        payload.departmentId = Number(departmentId);
      }
      if (subcategoryId !== "") {
        payload.subcategoryId = Number(subcategoryId);
      }

      const res = await fetch("/api/issues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        if (res.status === 422 && data.error?.fields) {
          setErrors(data.error.fields);
        } else {
          setErrors({ general: data.error?.message || `Erreur serveur (${res.status}).` });
        }
        return;
      }

      setCreatedIssue(data.data);
      if (onSuccess) {
        onSuccess(data.data);
      }
    } catch (err: any) {
      setErrors({ general: err.message || "Erreur réseau lors de l'enregistrement." });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCreatedIssue(null);
    setDescription("");
    setCategoryId("");
    setSubcategoryId("");
    setSelectedImpacts({});
    setPriority("normal");
    setErrors({});
  };

  if (createdIssue) {
    return (
      <div className="card" data-testid="creation-success-card">
        <div className="alert alert-success">
          <h3 style={{ margin: "0 0 0.5rem 0" }}>Dossier créé avec succès !</h3>
          <p style={{ margin: 0 }}>
            Numéro de dossier : <strong>{createdIssue.publicId}</strong>
          </p>
        </div>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
          Le dossier a été enregistré au statut <strong>Nouveau</strong>. Un gestionnaire pourra désormais procéder
          au triage et à l'assignation.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={resetForm} data-testid="btn-create-another">
            ➕ Déclarer un autre dossier
          </button>
        </div>
      </div>
    );
  }

  // Filtrer les sous-catégories pour n'afficher que celles associées à la catégorie choisie
  const availableSubcategories =
    categoryId !== ""
      ? meta?.subcategories.filter((sub) => sub.parentId === Number(categoryId) && sub.active) || []
      : [];

  return (
    <form className="card" onSubmit={handleSubmit} noValidate data-testid="create-issue-form">
      <h2 className="card-title">Déclarer un nouvel incident</h2>

      {errors.general && (
        <div className="alert alert-danger" role="alert">
          {errors.general}
        </div>
      )}

      {/* Date de survenance */}
      <div className="form-group">
        <label htmlFor="occurredOn" className="form-label required">
          Date de l'incident
        </label>
        <input
          type="date"
          id="occurredOn"
          className={`form-control ${errors.occurredOn ? "error" : ""}`}
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          max={todayStr}
          required
        />
        {errors.occurredOn && <div className="field-error">{errors.occurredOn}</div>}
      </div>

      {/* Succursale */}
      <div className="form-group">
        <label htmlFor="locationId" className="form-label required">
          Succursale
        </label>
        <select
          id="locationId"
          className={`form-control ${errors.locationId ? "error" : ""}`}
          value={locationId}
          onChange={(e) => setLocationId(e.target.value === "" ? "" : Number(e.target.value))}
          required
        >
          <option value="">-- Sélectionner une succursale --</option>
          {meta?.locations
            .filter((loc) => loc.active)
            .map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label} ({loc.code})
              </option>
            ))}
        </select>
        {errors.locationId && <div className="field-error">{errors.locationId}</div>}
      </div>

      {/* Département (facultatif) */}
      <div className="form-group">
        <label htmlFor="departmentId" className="form-label">
          Département (optionnel)
        </label>
        <select
          id="departmentId"
          className="form-control"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">-- Aucun département spécifique --</option>
          {meta?.departments
            .filter((dep) => dep.active)
            .map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.label}
              </option>
            ))}
        </select>
      </div>

      {/* Catégorie */}
      <div className="form-group">
        <label htmlFor="categoryId" className="form-label required">
          Catégorie
        </label>
        <select
          id="categoryId"
          className={`form-control ${errors.categoryId ? "error" : ""}`}
          value={categoryId}
          onChange={(e) => handleCategoryChange(e.target.value === "" ? "" : Number(e.target.value))}
          required
        >
          <option value="">-- Sélectionner une catégorie --</option>
          {meta?.categories
            .filter((cat) => cat.active)
            .map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
        </select>
        {errors.categoryId && <div className="field-error">{errors.categoryId}</div>}
      </div>

      {/* Sous-catégorie (facultatif au dépôt) */}
      {categoryId !== "" && availableSubcategories.length > 0 && (
        <div className="form-group">
          <label htmlFor="subcategoryId" className="form-label">
            Sous-catégorie (optionnelle lors de la déclaration)
          </label>
          <select
            id="subcategoryId"
            className="form-control"
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">-- Non spécifiée pour l'instant --</option>
            {availableSubcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.label}
              </option>
            ))}
          </select>
          <div className="form-hint">Peut être précisée lors du triage par le gestionnaire.</div>
        </div>
      )}

      {/* Priorité */}
      <div className="form-group">
        <span className="form-label required">Priorité</span>
        <div className="radio-group" role="radiogroup" aria-label="Niveau de priorité">
          {(
            [
              { value: "normal", label: "Normale" },
              { value: "important", label: "Importante" },
              { value: "urgent", label: "Urgente" },
            ] as const
          ).map((p) => (
            <label
              key={p.value}
              className={`radio-btn-label ${priority === p.value ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="priority"
                value={p.value}
                checked={priority === p.value}
                onChange={() => setPriority(p.value)}
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="form-group">
        <label htmlFor="description" className="form-label required">
          Description des faits
        </label>
        <textarea
          id="description"
          className={`form-control ${errors.description ? "error" : ""}`}
          placeholder="Décrivez précisément ce qui s'est produit (au moins 10 caractères)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        {errors.description && <div className="field-error">{errors.description}</div>}
        <div className="form-hint">{description.length} / 5000 caractères</div>
      </div>

      {/* Impacts */}
      <div className="form-group">
        <span className="form-label required">Impacts constatés</span>
        {errors.impacts && <div className="field-error" style={{ marginBottom: "0.5rem" }}>{errors.impacts}</div>}
        <div className="checkbox-grid">
          {meta?.impactTypes
            .filter((it) => it.active)
            .map((it) => {
              const isSelected = !!selectedImpacts[it.id]?.selected;
              return (
                <div key={it.id}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleImpactToggle(it.id)}
                    />
                    <span>{it.label}</span>
                  </label>
                  {isSelected && it.code === "other" && (
                    <div style={{ marginTop: "0.35rem", paddingLeft: "1.5rem" }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Précisez l'impact autre..."
                        value={selectedImpacts[it.id]?.details || ""}
                        onChange={(e) => handleImpactDetailsChange(it.id, e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={submitting}
          data-testid="btn-submit-issue"
        >
          {submitting ? "Enregistrement en cours..." : "📤 Déclarer l'incident"}
        </button>
      </div>
    </form>
  );
}

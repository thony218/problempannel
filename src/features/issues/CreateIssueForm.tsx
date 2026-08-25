import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";
import {
  clearEditingDraft,
  loadEditingDraft,
  promoteToPendingUpload,
  saveEditingDraft,
  updatePendingFile,
  type DraftFile,
} from "./draftStorage";
import { formatBytes, optimizeImage } from "./imageOptimizer";
import { apiFetch } from "../../shared/apiClient";
import { useNavigate } from "react-router";
import { issueDetailPath } from "../../routes/paths";
import { businessToday } from "../../shared/businessDate";

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
  attachments?: string;
  general?: string;
}

export interface CreateIssueFormProps {
  onSuccess?: (createdIssue: components["schemas"]["Issue"]) => void;
}

/**
 * Envoie les fichiers d'un brouillon `pendingUpload`, un par un.
 *
 * Séquentiel et non parallèle : sur un lien mobile faible, plusieurs envois
 * simultanés se gênent et échouent ensemble. Chaque fichier réussi disparaît
 * immédiatement du brouillon, si bien qu'une reprise ne renvoie que ce qui
 * manque encore. Retourne le nombre d'échecs.
 */
async function uploadDraftFiles(publicId: string, files: DraftFile[]): Promise<number> {
  let failures = 0;

  for (const file of files) {
    if (file.uploadState === "uploaded") continue;

    try {
      const formData = new FormData();
      formData.append("file", new File([file.blob], file.name, { type: file.type }));

      const res = await apiFetch(`/api/issues/${publicId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await updatePendingFile(publicId, file.id, { uploadState: "uploaded" });
      } else {
        failures += 1;
        const body = (await res.json().catch(() => null)) as any;
        await updatePendingFile(publicId, file.id, {
          uploadState: "failed",
          lastError: body?.error?.message ?? `Échec du téléversement (${res.status}).`,
        });
      }
    } catch (err: any) {
      failures += 1;
      await updatePendingFile(publicId, file.id, {
        uploadState: "failed",
        lastError: err?.message ?? "Erreur réseau.",
      });
    }
  }

  return failures;
}

export function CreateIssueForm({ onSuccess }: CreateIssueFormProps) {
  const navigate = useNavigate();
  const { user, meta } = useAuth();

  // `new Date().toISOString()` donne la date **UTC** : passé 19 h ou 20 h à
  // Montréal, elle vaut déjà le lendemain — le formulaire proposerait alors une
  // date de survenance dans le futur et `max` la laisserait passer. Le fuseau
  // métier vient de /api/meta (`config.businessTimeZone`).
  const todayStr = businessToday(meta?.config.businessTimeZone ?? "America/Toronto");

  const [occurredOn, setOccurredOn] = useState<string>(todayStr);
  const [locationId, setLocationId] = useState<number | "">(user?.defaultLocationId ?? "");
  const [departmentId, setDepartmentId] = useState<number | "">(user?.defaultDepartmentId ?? "");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [subcategoryId, setSubcategoryId] = useState<number | "">("");
  const [description, setDescription] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [selectedImpacts, setSelectedImpacts] = useState<Record<number, { selected: boolean; details: string }>>({});
  const [attachments, setAttachments] = useState<DraftFile[]>([]);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const [draftRestored, setDraftRestored] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [createdIssue, setCreatedIssue] = useState<components["schemas"]["Issue"] | null>(null);

  const isInitialMount = useRef(true);

  // 1. Restaurer le brouillon IndexedDB au chargement
  useEffect(() => {
    let isMounted = true;
    loadEditingDraft().then((draft) => {
      if (!isMounted || !draft) {
        if (user?.defaultLocationId && locationId === "") {
          setLocationId(user.defaultLocationId);
        }
        if (user?.defaultDepartmentId && departmentId === "") {
          setDepartmentId(user.defaultDepartmentId);
        }
        return;
      }
      const { fields } = draft;
      if (fields.occurredOn) setOccurredOn(fields.occurredOn);
      if (fields.locationId !== undefined) setLocationId(fields.locationId);
      if (fields.departmentId !== undefined) setDepartmentId(fields.departmentId);
      if (fields.categoryId !== undefined) setCategoryId(fields.categoryId);
      if (fields.subcategoryId !== undefined) setSubcategoryId(fields.subcategoryId);
      if (fields.description) setDescription(fields.description);
      if (fields.priority) setPriority(fields.priority);
      if (fields.selectedImpacts) setSelectedImpacts(fields.selectedImpacts);
      setAttachments(draft.files);
      setDraftRestored(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Sauvegarder automatiquement le brouillon lors des modifications
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (createdIssue) return;

    const timer = setTimeout(() => {
      saveEditingDraft(
        {
          occurredOn,
          locationId,
          departmentId,
          categoryId,
          subcategoryId,
          description,
          priority,
          selectedImpacts,
        },
        attachments
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [occurredOn, locationId, departmentId, categoryId, subcategoryId, description, priority, selectedImpacts, attachments, createdIssue]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: DraftFile[] = [...attachments];
    const maxFiles = meta?.config.maxAttachmentsPerIssue ?? 10;
    const maxBytes = meta?.config.maxAttachmentBytes ?? 10485760;

    for (let i = 0; i < files.length; i++) {
      if (newAttachments.length >= maxFiles) {
        setErrors((prev) => ({
          ...prev,
          attachments: `Limite maximale atteinte (${maxFiles} fichiers max).`,
        }));
        break;
      }

      // Réduction avant tout contrôle de taille (V4-IMG-01) : une photo de
      // téléphone dépasse souvent 10 Mo à la prise de vue mais repasse
      // largement sous la limite une fois ramenée à 2048 px.
      const { file, optimized, originalBytes, finalBytes } = await optimizeImage(files[i]);

      if (file.size > maxBytes) {
        setErrors((prev) => ({
          ...prev,
          attachments: `Cette photo est trop volumineuse. Choisissez une photo plus petite ou réduisez sa taille.`,
        }));
        continue;
      }

      if (optimized) {
        setUploadNotice(
          `« ${files[i].name} » réduite de ${formatBytes(originalBytes)} à ${formatBytes(finalBytes)}.`
        );
      }

      newAttachments.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        blob: file,
        uploadState: "pending",
      });
    }

    setAttachments(newAttachments);
    e.target.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const handleClearDraft = async () => {
    await clearEditingDraft();
    setDraftRestored(false);
    setDescription("");
    setCategoryId("");
    setSubcategoryId("");
    setSelectedImpacts({});
    setAttachments([]);
    setPriority("normal");
    setOccurredOn(todayStr);
    setLocationId(user?.defaultLocationId ?? "");
    setDepartmentId(user?.defaultDepartmentId ?? "");
    setErrors({});
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

      const res = await apiFetch("/api/issues", {
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

      const created = data.data as components["schemas"]["Issue"];

      // S45 : la transition vers `pendingUpload` a lieu **avant** le premier
      // envoi de fichier. Si le réseau tombe pendant les téléversements, le
      // brouillon porte déjà le publicId et l'écran Détail proposera de
      // reprendre — au lieu de perdre les photos avec un message de succès.
      // Sans fichier, le brouillon est simplement supprimé (S24).
      await promoteToPendingUpload(created.publicId, attachments);

      setCreatedIssue(created);
      if (onSuccess) onSuccess(created);

      if (attachments.length > 0) {
        const failed = await uploadDraftFiles(created.publicId, attachments);
        setUploadNotice(
          failed === 0
            ? `${attachments.length} fichier(s) joint(s) au dossier.`
            : `${failed} fichier(s) n'ont pas pu être envoyés. Reprenez-les depuis le dossier.`
        );
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
    setAttachments([]);
    setPriority("normal");
    setDraftRestored(false);
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
        {uploadNotice && (
          <div
            className="alert alert-success"
            style={{ fontSize: "0.9rem" }}
            data-testid="upload-result-notice"
          >
            {uploadNotice}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          {/* 01_produit/ux/01_NAVIGATION_ET_ARBORESCENCE.md : « Nouveau → Détail
              après création réussie ». Le déclarant doit pouvoir enchaîner sur
              son dossier, typiquement pour y joindre une photo. */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate(issueDetailPath(createdIssue.publicId))}
            data-testid="btn-open-created-issue"
          >
            📄 Ouvrir le dossier
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetForm} data-testid="btn-create-another">
            ➕ Déclarer un autre dossier
          </button>
        </div>
      </div>
    );
  }

  const availableSubcategories =
    categoryId !== ""
      ? meta?.subcategories.filter((sub) => sub.parentId === Number(categoryId) && sub.active) || []
      : [];

  return (
    <form className="card" onSubmit={handleSubmit} noValidate data-testid="create-issue-form">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <h2 className="card-title" style={{ margin: 0 }}>Déclarer un nouvel incident</h2>
        {draftRestored && (
          <button type="button" className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", minHeight: "36px" }} onClick={handleClearDraft}>
            🗑️ Effacer le brouillon
          </button>
        )}
      </div>

      {draftRestored && (
        <div className="alert alert-warning" style={{ fontSize: "0.85rem", padding: "0.5rem 0.75rem" }}>
          💾 Brouillon automatique restauré.
        </div>
      )}

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

      {/* Sous-catégorie */}
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

      {/* Photos / Pièces jointes locales (ISSUE-06) */}
      <div className="form-group">
        <span className="form-label">Photos & Pièces jointes (optionnel)</span>
        <div style={{ marginBottom: "0.5rem" }}>
          <input
            type="file"
            id="attachment-input"
            multiple
            accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <label htmlFor="attachment-input" className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-flex" }}>
            📎 Ajouter des photos / documents
          </label>
        </div>
        {errors.attachments && <div className="field-error">{errors.attachments}</div>}
        {uploadNotice && (
          <div
            className="alert alert-success"
            style={{ marginTop: "0.5rem", fontSize: "0.85rem", padding: "0.5rem 0.75rem" }}
            data-testid="image-optimisation-notice"
          >
            {uploadNotice}
          </div>
        )}

        {attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
            {attachments.map((att) => (
              <div
                key={att.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.35rem 0.65rem",
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius)",
                  fontSize: "0.85rem",
                }}
              >
                {/* Taille **finale**, après réduction éventuelle (V4-IMG-01, règle 5). */}
                <span>📄 {att.name} ({formatBytes(att.size)})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-danger)",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "1rem",
                    padding: "0 0.25rem",
                  }}
                  title="Supprimer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
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

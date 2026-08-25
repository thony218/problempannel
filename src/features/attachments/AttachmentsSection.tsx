import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import type { components } from "../../shared/api-types.generated";
import { apiFetch } from "../../shared/apiClient";
import {
  loadPendingUpload,
  removePendingFile,
  updatePendingFile,
  type DraftFile,
} from "../issues/draftStorage";
import { formatBytes } from "../issues/imageOptimizer";

export type ApiAttachment = components["schemas"]["Attachment"];

interface AttachmentsSectionProps {
  publicId: string;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

export function AttachmentsSection({ publicId }: AttachmentsSectionProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  // S47 : fichiers restés en attente d'envoi après la création du dossier.
  const [pendingFiles, setPendingFiles] = useState<DraftFile[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    const draft = await loadPendingUpload(publicId);
    setPendingFiles(draft?.files ?? []);
  }, [publicId]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  /**
   * Reprend l'envoi d'un fichier laissé en attente. Le brouillon est la source
   * de vérité : un envoi réussi en retire le fichier, et l'enregistrement
   * disparaît de lui-même quand il ne reste plus rien.
   */
  const handleRetryPending = async (file: DraftFile) => {
    setRetryingId(file.id);
    try {
      const formData = new FormData();
      formData.append("file", new File([file.blob], file.name, { type: file.type }));
      const res = await apiFetch(`/api/issues/${publicId}/attachments`, { method: "POST", body: formData });

      if (res.ok) {
        await updatePendingFile(publicId, file.id, { uploadState: "uploaded" });
        await fetchAttachments();
      } else {
        const body = (await res.json().catch(() => null)) as any;
        await updatePendingFile(publicId, file.id, {
          uploadState: "failed",
          lastError: body?.error?.message ?? `Échec du téléversement (${res.status}).`,
        });
      }
    } catch (err: any) {
      await updatePendingFile(publicId, file.id, {
        uploadState: "failed",
        lastError: err?.message ?? "Erreur réseau.",
      });
    } finally {
      setRetryingId(null);
      await refreshPending();
    }
  };

  const handleDiscardPending = async (fileId: string) => {
    await removePendingFile(publicId, fileId);
    await refreshPending();
  };

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/issues/${publicId}/attachments`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Erreur lors du chargement des pièces jointes (${res.status}).`);
      }
      const body = (await res.json()) as components["schemas"]["AttachmentListResponse"];
      if (body.ok && Array.isArray(body.data)) {
        setAttachments(body.data);
      }
    } catch (err: any) {
      setError(err.message || "Impossible de charger les pièces jointes.");
    } finally {
      setLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadError(null);

    if (file) {
      if (file.size > MAX_BYTES) {
        setUploadError("Le fichier dépasse la taille maximale autorisée (10 Mo).");
        setSelectedFile(null);
        return;
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
        setUploadError("Format non supporté. Formats acceptés : JPEG, PNG, WebP, HEIC, HEIF, PDF.");
        setSelectedFile(null);
        return;
      }
    }
    setSelectedFile(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    if (attachments.length >= 10) {
      setUploadError("Limite maximale de 10 pièces jointes par dossier atteinte.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await apiFetch(`/api/issues/${publicId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Échec du téléversement.");
      }

      setSelectedFile(null);
      const fileInput = document.getElementById("attachment-upload-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      await fetchAttachments();
    } catch (err: any) {
      setUploadError(err.message || "Erreur lors de l'envoi du fichier.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette pièce jointe ?")) return;

    setDeletingId(attachmentId);
    try {
      const res = await apiFetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const errData = (await res.json()) as any;
        throw new Error(errData?.error?.message || "Échec de la suppression.");
      }

      await fetchAttachments();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  const canDelete = user?.role === "manager" || user?.role === "admin";

  return (
    <div className="card" data-testid="attachments-section">
      <h2 className="card-title" style={{ fontSize: "1.1rem" }}>
        📎 Pièces jointes & Photos ({attachments.length} / 10)
      </h2>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* S47 : « Détail reprend les pendingUpload du même publicId ». Ces
          fichiers ont été choisis à la déclaration mais n'ont pas pu partir —
          sans ce bandeau, ils resteraient invisibles dans IndexedDB. */}
      {pendingFiles.length > 0 && (
        <div className="alert alert-warning" data-testid="pending-uploads" style={{ marginBottom: "1rem" }}>
          <strong>Fichiers à compléter ({pendingFiles.length})</strong>
          <p style={{ margin: "0.25rem 0 0.75rem", fontSize: "0.85rem" }}>
            Ces fichiers ont été choisis lors de la déclaration mais n'ont pas encore été envoyés.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pendingFiles.map((file) => (
              <div
                key={file.id}
                data-testid={`pending-file-${file.id}`}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.85rem" }}
              >
                <span style={{ flex: 1, minWidth: "10rem" }}>
                  📄 {file.name} ({formatBytes(file.size)})
                  {file.lastError && (
                    <span style={{ color: "var(--color-danger)", display: "block" }}>{file.lastError}</span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: "0.25rem 0.6rem", minHeight: "auto", fontSize: "0.8rem" }}
                  disabled={retryingId === file.id}
                  onClick={() => handleRetryPending(file)}
                  data-testid={`btn-retry-${file.id}`}
                >
                  {retryingId === file.id ? "Envoi…" : "🔄 Réessayer"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "0.25rem 0.6rem", minHeight: "auto", fontSize: "0.8rem" }}
                  onClick={() => handleDiscardPending(file.id)}
                  data-testid={`btn-discard-${file.id}`}
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "1rem 0", color: "var(--color-text-muted)" }}>Chargement des pièces jointes...</div>
      ) : attachments.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", margin: "0.5rem 0 1rem" }}>
          Aucune pièce jointe pour ce dossier.
        </p>
      ) : (
        <div className="attachment-grid" style={{ marginBottom: "1.5rem" }}>
          {attachments.map((att) => {
            const isImage = att.contentType.startsWith("image/");
            return (
              <div key={att.id} className="attachment-card" data-testid={`attachment-${att.id}`}>
                <div className="attachment-preview">
                  {isImage ? (
                    <img src={`/api/attachments/${att.id}`} alt={att.originalName} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: "2rem" }}>📄</span>
                  )}
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, wordBreak: "break-word", marginBottom: "0.25rem" }}>
                  {att.originalName}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                  {formatSize(att.sizeBytes)} • {new Date(att.createdAt).toLocaleDateString("fr-CA")}
                </div>
                <div style={{ display: "flex", gap: "0.25rem", marginTop: "auto" }}>
                  <a
                    href={`/api/attachments/${att.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: "0.25rem 0.5rem", minHeight: "auto", fontSize: "0.75rem", textDecoration: "none" }}
                    download={att.originalName}
                  >
                    ⬇️ Ouvrir
                  </a>
                  {canDelete && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "0.25rem 0.5rem", minHeight: "auto", fontSize: "0.75rem", color: "var(--color-danger)" }}
                      onClick={() => handleDelete(att.id)}
                      disabled={deletingId === att.id}
                      data-testid={`btn-delete-attachment-${att.id}`}
                    >
                      {deletingId === att.id ? "..." : "🗑️"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulaire d'upload */}
      {attachments.length < 10 && (
        <form onSubmit={handleUpload} data-testid="form-upload-attachment">
          {uploadError && <div className="alert alert-danger">{uploadError}</div>}
          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
            <label className="form-label" htmlFor="attachment-upload-input">
              Ajouter une photo ou un document (PDF / Images, max 10 Mo)
            </label>
            <input
              id="attachment-upload-input"
              type="file"
              className="form-control"
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              onChange={handleFileChange}
              disabled={uploading}
              data-testid="input-attachment-file"
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !selectedFile}
              data-testid="btn-submit-attachment"
            >
              {uploading ? "Téléversement..." : "Téléverser"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

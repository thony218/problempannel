/**
 * Brouillons IndexedDB — machine d'état V4
 * (V4-DRAFT-01, `03_execution/07_BROUILLONS_INDEXEDDB.md`, scénarios S23-S25 et S45-S47).
 *
 * Deux états, jamais confondus :
 *
 * - `editing` : le dossier n'existe pas encore côté serveur. C'est le seul
 *   état que l'écran Nouveau restaure.
 * - `pendingUpload` : `POST /issues` a réussi, il ne reste que des fichiers à
 *   envoyer. Cet état ne doit **jamais** être proposé par l'écran Nouveau,
 *   sinon un employé recréerait un dossier déjà existant (S46).
 *
 * La transition se fait **avant le premier envoi de fichier** : c'est ce qui
 * garantit qu'un dossier créé puis un réseau qui tombe laisse un brouillon
 * rattaché à son `publicId`, reprenable depuis le Détail (S45, S47), au lieu
 * de photos perdues avec un message de succès.
 *
 * Les fichiers sont conservés en `Blob`. IndexedDB les stocke nativement ;
 * une base64 les gonflerait d'un tiers pour rien, et le quota mobile est vite
 * atteint avec quelques photos.
 */

export type DraftFileUploadState = "pending" | "uploading" | "failed" | "uploaded";

export interface DraftFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  uploadState: DraftFileUploadState;
  /** Dernière erreur d'envoi, affichée pour expliquer une reprise. */
  lastError?: string;
}

export interface DraftFields {
  occurredOn: string;
  locationId: number | "";
  departmentId: number | "";
  categoryId: number | "";
  subcategoryId: number | "";
  description: string;
  priority: "normal" | "important" | "urgent";
  selectedImpacts: Record<number, { selected: boolean; details: string }>;
}

export interface EditingDraft {
  state: "editing";
  draftId: string;
  issuePublicId: null;
  fields: DraftFields;
  files: DraftFile[];
  updatedAt: string;
}

export interface PendingUploadDraft {
  state: "pendingUpload";
  draftId: string;
  issuePublicId: string;
  fields: null;
  files: DraftFile[];
  updatedAt: string;
}

export type IssueDraft = EditingDraft | PendingUploadDraft;

const DB_NAME = "registre_erreurs_v1";
const DB_VERSION = 2;
const STORE_NAME = "drafts";

/** L'écran Nouveau n'entretient qu'un seul brouillon en cours de saisie. */
export const EDITING_DRAFT_ID = "current_issue_draft";

/**
 * Repli mémoire, utilisé quand IndexedDB est indisponible (mode privé, moteur
 * de test). Les `Blob` ne survivent alors pas au rechargement — c'est une
 * dégradation acceptée, pas le chemin normal.
 */
const memoryStore = new Map<string, IssueDraft>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB non disponible"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // La V1 stockait un unique brouillon sous une clé fixe, sans état.
      // Le format n'est pas convertible : un ancien enregistrement ne sait pas
      // dire s'il correspond à un dossier déjà créé. On repart d'un magasin
      // vide plutôt que de risquer un doublon de déclaration.
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: "draftId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T | undefined> {
  const db = await openDB();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const request = run(tx.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function putDraft(draft: IssueDraft): Promise<void> {
  memoryStore.set(draft.draftId, draft);
  try {
    await withStore("readwrite", (store) => store.put(draft));
  } catch {
    // Repli mémoire déjà écrit ci-dessus.
  }
}

async function getDraft(draftId: string): Promise<IssueDraft | null> {
  try {
    const found = await withStore<IssueDraft>("readonly", (store) => store.get(draftId));
    if (found) return found;
  } catch {
    // Repli ci-dessous.
  }
  return memoryStore.get(draftId) ?? null;
}

async function getAllDrafts(): Promise<IssueDraft[]> {
  try {
    const found = await withStore<IssueDraft[]>("readonly", (store) => store.getAll());
    if (found) return found;
  } catch {
    // Repli ci-dessous.
  }
  return [...memoryStore.values()];
}

async function removeDraft(draftId: string): Promise<void> {
  memoryStore.delete(draftId);
  try {
    await withStore("readwrite", (store) => store.delete(draftId));
  } catch {
    // Repli mémoire déjà nettoyé.
  }
}

// ---------------------------------------------------------------- editing

/** Enregistre la saisie en cours (S23). */
export async function saveEditingDraft(fields: DraftFields, files: DraftFile[]): Promise<void> {
  await putDraft({
    state: "editing",
    draftId: EDITING_DRAFT_ID,
    issuePublicId: null,
    fields,
    files,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Brouillon proposé par l'écran Nouveau.
 *
 * Le filtre sur `state === "editing"` est la garde anti-doublon de la
 * spécification (S46) : un `pendingUpload` désigne un dossier **déjà créé** et
 * ne doit jamais réapparaître dans un formulaire de déclaration.
 */
export async function loadEditingDraft(): Promise<EditingDraft | null> {
  const draft = await getDraft(EDITING_DRAFT_ID);
  return draft && draft.state === "editing" ? draft : null;
}

/** Abandon explicite de la saisie (S24). */
export async function clearEditingDraft(): Promise<void> {
  await removeDraft(EDITING_DRAFT_ID);
}

// ---------------------------------------------------- editing → pendingUpload

/**
 * Transition exécutée dès que `POST /issues` répond, **avant** le premier
 * envoi de fichier (S45).
 *
 * Les champs métier sont mis à `null` : ils sont désormais côté serveur, les
 * conserver en local ferait diverger deux copies de la même déclaration. Seuls
 * restent les fichiers non envoyés.
 *
 * Sans fichier à envoyer, aucun `pendingUpload` n'est créé : le brouillon est
 * simplement supprimé (S24).
 */
export async function promoteToPendingUpload(
  issuePublicId: string,
  files: DraftFile[]
): Promise<PendingUploadDraft | null> {
  await removeDraft(EDITING_DRAFT_ID);

  const remaining = files.filter((file) => file.uploadState !== "uploaded");
  if (remaining.length === 0) {
    return null;
  }

  const draft: PendingUploadDraft = {
    state: "pendingUpload",
    draftId: `pending:${issuePublicId}`,
    issuePublicId,
    fields: null,
    files: remaining.map((file) => ({ ...file, uploadState: "pending" })),
    updatedAt: new Date().toISOString(),
  };
  await putDraft(draft);
  return draft;
}

// ---------------------------------------------------------- pendingUpload

/** Fichiers restant à envoyer pour un dossier donné (S47, écran Détail). */
export async function loadPendingUpload(issuePublicId: string): Promise<PendingUploadDraft | null> {
  const draft = await getDraft(`pending:${issuePublicId}`);
  return draft && draft.state === "pendingUpload" ? draft : null;
}

/** Tous les dossiers ayant encore des fichiers à compléter. */
export async function listPendingUploads(): Promise<PendingUploadDraft[]> {
  const all = await getAllDrafts();
  return all.filter((draft): draft is PendingUploadDraft => draft.state === "pendingUpload");
}

/**
 * Met à jour l'état d'un fichier. Quand plus aucun fichier n'est en attente,
 * l'enregistrement disparaît — un brouillon vide n'a rien à signaler.
 */
export async function updatePendingFile(
  issuePublicId: string,
  fileId: string,
  patch: Partial<Pick<DraftFile, "uploadState" | "lastError">>
): Promise<PendingUploadDraft | null> {
  const draft = await loadPendingUpload(issuePublicId);
  if (!draft) return null;

  const files = draft.files
    .map((file) => (file.id === fileId ? { ...file, ...patch } : file))
    .filter((file) => file.uploadState !== "uploaded");

  if (files.length === 0) {
    await removeDraft(draft.draftId);
    return null;
  }

  const next: PendingUploadDraft = { ...draft, files, updatedAt: new Date().toISOString() };
  await putDraft(next);
  return next;
}

/** Retrait explicite d'un fichier local que l'employé renonce à envoyer. */
export async function removePendingFile(
  issuePublicId: string,
  fileId: string
): Promise<PendingUploadDraft | null> {
  const draft = await loadPendingUpload(issuePublicId);
  if (!draft) return null;

  const files = draft.files.filter((file) => file.id !== fileId);
  if (files.length === 0) {
    await removeDraft(draft.draftId);
    return null;
  }

  const next: PendingUploadDraft = { ...draft, files, updatedAt: new Date().toISOString() };
  await putDraft(next);
  return next;
}

/** Abandon de tous les fichiers restants d'un dossier. */
export async function clearPendingUpload(issuePublicId: string): Promise<void> {
  await removeDraft(`pending:${issuePublicId}`);
}

/** Réinitialisation complète — utilisée par les tests. */
export async function clearAllDrafts(): Promise<void> {
  const all = await getAllDrafts();
  await Promise.all(all.map((draft) => removeDraft(draft.draftId)));
  memoryStore.clear();
}

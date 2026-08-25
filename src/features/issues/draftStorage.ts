export interface DraftAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface IssueDraft {
  occurredOn: string;
  locationId: number | "";
  departmentId: number | "";
  categoryId: number | "";
  subcategoryId: number | "";
  description: string;
  priority: "normal" | "important" | "urgent";
  selectedImpacts: Record<number, { selected: boolean; details: string }>;
  attachments: DraftAttachment[];
  updatedAt: number;
}

const DB_NAME = "registre_erreurs_v1";
const DB_VERSION = 1;
const STORE_NAME = "drafts";
const DRAFT_KEY = "current_issue_draft";

let inMemoryDraft: IssueDraft | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB non disponible"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sauvegarde le brouillon dans IndexedDB avec fallback localStorage et mémoire.
 */
export async function saveDraft(draft: IssueDraft): Promise<void> {
  inMemoryDraft = { ...draft };
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(draft, DRAFT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback localStorage
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch {
      // Ignore quota errors
    }
  }
}

/**
 * Récupère le brouillon sauvegardé s'il existe.
 */
export async function loadDraft(): Promise<IssueDraft | null> {
  try {
    const db = await openDB();
    const draft = await new Promise<IssueDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DRAFT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (draft) return draft;
  } catch {
    // Fallback localStorage
  }

  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return JSON.parse(raw) as IssueDraft;
    }
  } catch {
    // Ignore JSON errors
  }

  return inMemoryDraft;
}

/**
 * Supprime le brouillon (lors d'une soumission réussie ou d'un abandon).
 */
export async function clearDraft(): Promise<void> {
  inMemoryDraft = null;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(DRAFT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback localStorage
  }

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // Ignore
  }
}

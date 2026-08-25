/**
 * Point d'entrée unique pour tous les appels HTTP vers l'API du Worker.
 *
 * ## Pourquoi un client partagé
 *
 * En staging et en production, Cloudflare Access authentifie la requête via un
 * cookie posé sur le domaine : un `fetch` nu suffit. En local
 * (`APP_ENV=local`), le Worker attend l'en-tête `X-Dev-User-Email`
 * (02_contrats/04_SECURITE_AUTH.md). Sans lui, `/api/me` répond 401 et
 * l'application reste bloquée sur l'écran « Authentification requise » : ni
 * `npm run dev`, ni un parcours Playwright ne peuvent dépasser le shell.
 *
 * Cet en-tête ne doit exister que dans un bundle de développement. Vite
 * remplace `import.meta.env.DEV` par une constante à la compilation : la
 * branche entière disparaît du bundle de production, l'en-tête ne peut donc
 * pas fuiter — et le Worker l'ignorerait de toute façon hors `APP_ENV=local`.
 *
 * ## Identité de développement
 *
 * Par ordre de priorité :
 *  1. `localStorage["registre.devUserEmail"]` — permet de changer de rôle sans
 *     redémarrer le serveur de dev (`setDevUserEmail("manager@example.test")`);
 *  2. `VITE_DEV_USER_EMAIL` dans `.env.local`;
 *  3. `employee@example.test`, présent dans `seed/dev.sql`.
 *
 * ## Limitation connue en local
 *
 * Les ressources chargées directement par le navigateur (`<img src>`,
 * `<a href download>` sur `/api/attachments/{id}`) ne passent pas par ce
 * client et ne portent donc pas l'en-tête : l'aperçu et le téléchargement des
 * pièces jointes ne fonctionnent qu'une fois derrière Cloudflare Access.
 */

const DEV_EMAIL_STORAGE_KEY = "registre.devUserEmail";
const DEV_EMAIL_HEADER = "X-Dev-User-Email";
const DEFAULT_DEV_EMAIL = "employee@example.test";

/** Courriel d'identité simulée, ou `null` hors bundle de développement. */
export function getDevUserEmail(): string | null {
  if (!import.meta.env.DEV) {
    return null;
  }
  try {
    const stored = localStorage.getItem(DEV_EMAIL_STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch {
    // localStorage indisponible (mode privé, contexte non-navigateur).
  }
  return import.meta.env.VITE_DEV_USER_EMAIL || DEFAULT_DEV_EMAIL;
}

/** Change l'identité simulée. Sans effet hors développement. */
export function setDevUserEmail(email: string | null): void {
  if (!import.meta.env.DEV) {
    return;
  }
  try {
    if (email) {
      localStorage.setItem(DEV_EMAIL_STORAGE_KEY, email);
    } else {
      localStorage.removeItem(DEV_EMAIL_STORAGE_KEY);
    }
  } catch {
    // Ignoré : l'identité retombe sur VITE_DEV_USER_EMAIL.
  }
}

/**
 * `fetch` vers l'API.
 *
 * `Accept: application/json` est posé par défaut. `Content-Type` n'est jamais
 * ajouté d'office : un envoi `FormData` doit garder celui que le navigateur
 * calcule, sinon la limite multipart est perdue et le Worker ne peut plus
 * lire le fichier.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const devEmail = getDevUserEmail();
  if (devEmail) {
    headers.set(DEV_EMAIL_HEADER, devEmail);
  }

  return fetch(path, { ...init, headers });
}

/** Corps d'erreur normalisé du Worker (`worker/domain/errors.ts`). */
interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    requestId: string;
  };
}

/**
 * Erreur d'API portant le statut HTTP, le code métier et les erreurs par
 * champ, pour que l'appelant distingue 409 (conflit), 403 (permission) et 422
 * (validation) sans réanalyser le corps de la réponse.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
    requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }
}

/**
 * Lit le corps d'erreur d'une réponse non-OK et lève une `ApiError`.
 * Retombe sur un message générique si le corps n'est pas le JSON attendu
 * (page d'erreur d'un intermédiaire, coupure réseau en cours de lecture).
 */
export async function throwApiError(res: Response, fallbackMessage: string): Promise<never> {
  let body: ApiErrorBody | undefined;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Corps illisible : on garde le message de repli.
  }

  throw new ApiError(
    res.status,
    body?.error?.code ?? "UNKNOWN",
    body?.error?.message ?? `${fallbackMessage} (${res.status}).`,
    body?.error?.fields,
    body?.error?.requestId
  );
}

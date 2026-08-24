const PUBLIC_ID_PREFIX = "INC-";
const MIN_DIGITS = 6;

/**
 * INC-{id sur au moins 6 chiffres}, cf. contracts/openapi.yaml (PublicId)
 * et 01_produit/09_... : ni compteur annuel, ni date — un simple id D1
 * paddé.
 */
export function toPublicId(id: number): string {
  return `${PUBLIC_ID_PREFIX}${String(id).padStart(MIN_DIGITS, "0")}`;
}

/**
 * Résolution stricte (V4-ID-01) : seule la forme canonique produite par
 * toPublicId() est acceptée. Un padding non canonique (ex: "INC-0000042"
 * pour l'id 42, qui devrait être "INC-000042") est refusé plutôt que
 * résolu "par charité" — un format invalide doit mener à un 404, jamais
 * à une résolution ambiguë de deux chaînes vers le même id.
 */
export function parsePublicId(publicId: string): number | null {
  if (!publicId.startsWith(PUBLIC_ID_PREFIX)) {
    return null;
  }
  const digits = publicId.slice(PUBLIC_ID_PREFIX.length);
  if (!/^\d+$/.test(digits) || digits.length < MIN_DIGITS) {
    return null;
  }
  const id = Number(digits);
  if (!Number.isSafeInteger(id) || id < 1) {
    return null;
  }
  return toPublicId(id) === publicId ? id : null;
}

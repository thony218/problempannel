/**
 * Reconnaissance du type réel d'un fichier par ses octets d'en-tête.
 *
 * `File.type` est renseigné par le client : un exécutable renommé `photo.jpg`
 * et annoncé `image/jpeg` franchit sans difficulté un contrôle qui se contente
 * de lire cet en-tête. Le bucket R2 est privé et le Worker sert les fichiers
 * avec `nosniff` et un CSP `sandbox`, mais un registre d'erreurs ne doit pas
 * pour autant devenir un dépôt de fichiers arbitraires : le type déclaré doit
 * correspondre au contenu.
 *
 * La reconnaissance est volontairement limitée aux formats acceptés par
 * `01_produit/07_SCENARIOS_ACCEPTATION.md` (S17-S21).
 */

export type DetectedType = "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "image/heif" | "application/pdf";

/** Nombre d'octets nécessaires pour trancher sur tous les formats reconnus. */
export const SIGNATURE_BYTES = 16;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return "";
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/**
 * Marques ISO-BMFF correspondant à une image HEIF/HEIC.
 *
 * `mif1` et `msf1` sont des marques génériques d'image ISO que produisent
 * certains appareils : les exclure ferait rejeter des photos d'iPhone
 * parfaitement valides (S18, S19).
 */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

/** Type réel du fichier, ou `null` si aucune signature connue ne correspond. */
export function detectContentType(bytes: Uint8Array): DetectedType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";

  // WebP : conteneur RIFF dont le type de forme est « WEBP ».
  if (asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }

  // HEIC/HEIF : boîte `ftyp` en tête, marque aux octets 8 à 11.
  if (asciiAt(bytes, 4, 4) === "ftyp" && HEIF_BRANDS.has(asciiAt(bytes, 8, 4))) {
    return "image/heic";
  }

  return null;
}

/**
 * Le type déclaré est-il cohérent avec le contenu ?
 *
 * HEIC et HEIF partagent le même conteneur et la même liste de marques :
 * les distinguer sur les octets n'aurait pas de sens, ils sont donc traités
 * comme équivalents.
 */
export function matchesDeclaredType(declared: string, detected: DetectedType | null): boolean {
  if (detected === null) return false;
  const normalized = declared.toLowerCase();
  if (normalized === detected) return true;
  return detected === "image/heic" && (normalized === "image/heic" || normalized === "image/heif");
}

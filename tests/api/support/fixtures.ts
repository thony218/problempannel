/**
 * Contenus de fichiers pour les tests d'envoi.
 *
 * Le serveur vérifie que les octets d'en-tête correspondent au type annoncé
 * (`worker/domain/fileSignature.ts`) : une chaîne quelconque déclarée
 * `image/jpeg` est refusée, comme elle doit l'être. Les tests utilisent donc
 * de vraies signatures.
 */

/** En-tête JPEG (SOI + APP0), suffisant pour la reconnaissance de format. */
export function jpegBytes(payload = "contenu"): ArrayBuffer {
  const header = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00];
  const body = Array.from(new TextEncoder().encode(payload));
  return new Uint8Array([...header, ...body]).buffer;
}

/** Fichier JPEG valide, prêt à être ajouté à un `FormData`. */
export function jpegFile(name = "photo.jpg", payload = "contenu"): File {
  return new File([jpegBytes(payload)], name, { type: "image/jpeg" });
}

/**
 * En-tête ISO-BMFF d'une image HEIF/HEIC (S18, S19).
 *
 * Structure réelle du début d'un fichier produit par un iPhone : boîte `ftyp`
 * (taille sur 4 octets, type `ftyp`), marque majeure aux octets 8 à 11, version
 * mineure, puis la liste des marques compatibles. `worker/domain/fileSignature.ts`
 * ne lit que la marque majeure, mais la boîte est écrite en entier pour que la
 * fixture reste un en-tête valide et non un motif taillé sur mesure pour le
 * détecteur.
 *
 * @param brand marque majeure — `heic` pour un HEIC, `mif1` pour un HEIF.
 */
export function heifBytes(brand: "heic" | "mif1" = "heic", payload = "contenu"): ArrayBuffer {
  const ascii = (text: string): number[] => Array.from(text).map((c) => c.charCodeAt(0));
  const header = [
    0x00, 0x00, 0x00, 0x18, // taille de la boîte : 24 octets
    ...ascii("ftyp"),
    ...ascii(brand), // marque majeure
    0x00, 0x00, 0x00, 0x00, // version mineure
    ...ascii("mif1"), // marques compatibles
  ];
  const body = Array.from(new TextEncoder().encode(payload));
  return new Uint8Array([...header, ...body]).buffer;
}

/** Fichier HEIC valide, tel qu'un iPhone en produit. */
export function heicFile(name = "photo.heic", payload = "contenu"): File {
  return new File([heifBytes("heic", payload)], name, { type: "image/heic" });
}

/** Fichier HEIF valide (marque générique `mif1`). */
export function heifFile(name = "photo.heif", payload = "contenu"): File {
  return new File([heifBytes("mif1", payload)], name, { type: "image/heif" });
}

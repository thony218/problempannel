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

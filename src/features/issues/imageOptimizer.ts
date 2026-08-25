/**
 * Réduction des images avant envoi (V4-IMG-01,
 * `03_execution/08_OPTIMISATION_IMAGES_CLIENT.md`, scénario S50).
 *
 * Objectif : raccourcir l'envoi depuis un téléphone en succursale, sans rendre
 * la déclaration dépendante d'une conversion complexe. Le serveur reste
 * l'autorité sur la limite de 10 MiB.
 *
 * Confidentialité : tout se fait dans le navigateur. Aucune image n'est
 * transmise à un service tiers de compression.
 */

export const MAX_IMAGE_EDGE = 2048;
export const JPEG_QUALITY = 0.82;

const OPTIMISABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export interface OptimizeResult {
  file: File;
  /** `false` quand l'original est conservé — voir `reason`. */
  optimized: boolean;
  originalBytes: number;
  finalBytes: number;
  reason?: "not-an-image" | "cannot-decode" | "original-smaller" | "transparency";
}

/**
 * Dimensions cibles : le plus grand côté est ramené à `MAX_IMAGE_EDGE`, le
 * rapport d'aspect est conservé, et une image déjà assez petite n'est pas
 * agrandie. Fonction pure, testable sans navigateur.
 */
export function targetDimensions(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE
): { width: number; height: number } {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width, height };
  }
  const ratio = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Un type que la règle V1 accepte de retravailler. */
export function isOptimisable(type: string): boolean {
  return OPTIMISABLE_TYPES.has(type.toLowerCase());
}

/**
 * Détecte une transparence **réellement utilisée**, et non simplement un
 * format qui la permet : un PNG opaque, très courant pour une capture d'écran,
 * doit pouvoir partir en JPEG.
 *
 * L'échantillonnage saute des pixels — parcourir intégralement une image de
 * 12 Mpx bloquerait le fil principal du téléphone pour un gain nul.
 */
function hasRealTransparency(data: Uint8ClampedArray): boolean {
  const STEP = 4 * 16; // un pixel sur seize
  for (let i = 3; i < data.length; i += STEP) {
    if (data[i] < 255) return true;
  }
  return false;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Applique la règle V1 à un fichier.
 *
 * Ne lève jamais : une image que le navigateur ne sait pas décoder (HEIC sur
 * un navigateur qui l'ignore) est retournée telle quelle. C'est délibéré —
 * l'échec d'une optimisation ne doit pas empêcher un employé de joindre sa
 * photo.
 */
export async function optimizeImage(file: File): Promise<OptimizeResult> {
  const base: OptimizeResult = {
    file,
    optimized: false,
    originalBytes: file.size,
    finalBytes: file.size,
  };

  if (!isOptimisable(file.type)) {
    return { ...base, reason: "not-an-image" };
  }

  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return { ...base, reason: "cannot-decode" };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC/HEIF sur un navigateur incapable de décoder : on garde l'original,
    // l'aperçu sera générique et l'envoi reste autorisé jusqu'à 10 MiB.
    return { ...base, reason: "cannot-decode" };
  }

  try {
    const { width, height } = targetDimensions(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return { ...base, reason: "cannot-decode" };
    }
    context.drawImage(bitmap, 0, 0, width, height);

    // Un format porteur d'alpha n'est réencodé en JPEG que s'il n'utilise pas
    // sa transparence ; sinon on reste en PNG pour ne pas noircir le fond.
    let outputType = "image/jpeg";
    if (file.type === "image/png" || file.type === "image/webp") {
      const pixels = context.getImageData(0, 0, width, height).data;
      if (hasRealTransparency(pixels)) {
        outputType = "image/png";
      }
    }

    const blob = await canvasToBlob(
      canvas,
      outputType,
      outputType === "image/jpeg" ? JPEG_QUALITY : undefined
    );
    if (!blob) {
      return { ...base, reason: "cannot-decode" };
    }

    // Règle 4 : ne jamais alourdir. Une petite photo déjà bien compressée
    // ressort souvent plus grosse après réencodage.
    if (blob.size >= file.size) {
      return {
        ...base,
        reason: outputType === "image/png" ? "transparency" : "original-smaller",
      };
    }

    const extension = outputType === "image/jpeg" ? "jpg" : "png";
    const renamed = file.name.replace(/\.[^.]+$/, "") + "." + extension;

    return {
      file: new File([blob], renamed, { type: outputType, lastModified: file.lastModified }),
      optimized: true,
      originalBytes: file.size,
      finalBytes: blob.size,
    };
  } finally {
    bitmap.close?.();
  }
}

/** Taille lisible, affichée avant envoi (règle 5). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

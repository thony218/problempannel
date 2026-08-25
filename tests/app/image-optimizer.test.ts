import { describe, expect, it } from "vitest";
import {
  formatBytes,
  isOptimisable,
  optimizeImage,
  targetDimensions,
  MAX_IMAGE_EDGE,
} from "../../src/features/issues/imageOptimizer";

/**
 * V4-IMG-01 — réduction des images avant envoi
 * (`03_execution/08_OPTIMISATION_IMAGES_CLIENT.md`, scénario S50).
 *
 * Le redimensionnement lui-même dépend de `createImageBitmap` et d'un canvas,
 * absents sous Node : ce qui est vérifié ici, ce sont les **décisions** —
 * quelles dimensions viser, quels types retravailler, et surtout que l'absence
 * de moteur de décodage laisse le fichier intact au lieu de faire échouer la
 * déclaration. Le rendu réel relève du parcours mobile (QA-05).
 */

describe("Dimensions cibles", () => {
  it("caps the longest edge at 2048 px while keeping the aspect ratio", () => {
    // Photo de téléphone en 4:3.
    expect(targetDimensions(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    // Portrait : c'est la hauteur qui est le plus grand côté.
    expect(targetDimensions(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });

  it("never enlarges an image that is already small enough", () => {
    expect(targetDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(targetDimensions(MAX_IMAGE_EDGE, 1000)).toEqual({ width: MAX_IMAGE_EDGE, height: 1000 });
  });

  it("keeps at least one pixel on an extreme panorama", () => {
    const result = targetDimensions(20000, 3);
    expect(result.width).toBe(MAX_IMAGE_EDGE);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

describe("Types retravaillés", () => {
  it("covers the formats named by the rule, including HEIC", () => {
    expect(isOptimisable("image/jpeg")).toBe(true);
    expect(isOptimisable("image/png")).toBe(true);
    expect(isOptimisable("image/webp")).toBe(true);
    expect(isOptimisable("image/heic")).toBe(true);
    expect(isOptimisable("image/HEIF")).toBe(true);
  });

  it("leaves a PDF alone", () => {
    expect(isOptimisable("application/pdf")).toBe(false);
  });
});

describe("Robustesse", () => {
  /**
   * Cas HEIC sur un navigateur qui ne sait pas le décoder : « conserver
   * l'original, aperçu générique, upload autorisé si ≤10 MiB ». Une
   * optimisation impossible ne doit jamais empêcher un employé de joindre sa
   * photo.
   */
  it("returns the original untouched when the image cannot be decoded", async () => {
    const original = new File([new Uint8Array([1, 2, 3, 4])], "photo.heic", { type: "image/heic" });
    const result = await optimizeImage(original);

    expect(result.file).toBe(original);
    expect(result.optimized).toBe(false);
    expect(result.finalBytes).toBe(original.size);
  });

  it("returns a PDF untouched", async () => {
    const original = new File([new Uint8Array([1, 2, 3])], "facture.pdf", { type: "application/pdf" });
    const result = await optimizeImage(original);

    expect(result.file).toBe(original);
    expect(result.reason).toBe("not-an-image");
  });
});

describe("Taille affichée avant envoi", () => {
  it("reads naturally at each order of magnitude", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(2048)).toBe("2 Ko");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 Mo");
  });
});

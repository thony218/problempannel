import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vérifications portant sur la **forme** du contrat, pas sur le code.
 *
 * Certains scénarios d'acceptation ne parlent pas d'un comportement mais de ce
 * que le contrat rend possible d'exprimer : S26 « sous-catégorie sans
 * categoryId → 422 **au contrat** », S27 « création location avec champ parent
 * **impossible au contrat** ». Une implémentation peut se conformer par hasard;
 * seul le schéma garantit qu'aucun autre client ne pourra faire autrement.
 *
 * Le fichier vit dans le projet `app` parce qu'il s'exécute sous Node :
 * `process.cwd()` renvoie un chemin encodé en URL dans le pool Workers, où
 * `readFileSync` échoue donc sur tout dépôt dont le chemin contient un espace.
 */

const CONTRACT = readFileSync(path.join(process.cwd(), "contracts", "openapi.yaml"), "utf-8");

/** Extrait le corps d'un schéma nommé, jusqu'au schéma suivant. */
function schemaBody(name: string): string {
  const start = CONTRACT.indexOf(`    ${name}:`);
  expect(start, `schéma absent du contrat : ${name}`).toBeGreaterThanOrEqual(0);
  const rest = CONTRACT.slice(start + 1);
  const nextIndex = rest.search(/\n {4}[A-Za-z][A-Za-z0-9]*:\n/);
  return nextIndex === -1 ? rest : rest.slice(0, nextIndex);
}

describe("S26: la sous-catégorie exige sa catégorie parente au contrat", () => {
  it("requires categoryId and refuses unknown properties", () => {
    const body = schemaBody("CreateSubcategoryRequest");
    expect(body).toContain("additionalProperties: false");
    expect(body).toMatch(/required:\s*\n\s*- categoryId/);
  });
});

describe("S27: la création d'une succursale ne peut pas porter de parent", () => {
  it("exposes no parent property and closes the schema", () => {
    const body = schemaBody("CreateSimpleReferenceRequest");

    expect(body).toContain("additionalProperties: false");
    // Aucune notion de parenté : ni `parentId`, ni `parent`, ni `parentCode`.
    expect(body).not.toMatch(/parent/i);
  });

  it("keeps the modification schema free of any parent as well", () => {
    // Sinon la hiérarchie interdite à la création s'obtiendrait juste après.
    const body = schemaBody("UpdateSimpleReferenceRequest");
    expect(body).toContain("additionalProperties: false");
    expect(body).not.toMatch(/parent/i);
  });
});

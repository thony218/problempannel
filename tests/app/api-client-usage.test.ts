import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou : tout appel HTTP de l'interface doit passer par `apiFetch`.
 *
 * En staging et en production, Cloudflare Access authentifie via un cookie et
 * un `fetch` nu fonctionne — le défaut est donc invisible pour celui qui écrit
 * le code. En local (`APP_ENV=local`), le Worker exige l'en-tête
 * `X-Dev-User-Email` que seul `apiFetch` pose : un `fetch` nu répond 401 et
 * l'écran concerné devient intestable hors staging.
 *
 * Ce test existe parce que la règle a déjà été enfreinte deux fois — la
 * seconde en réintroduisant un `fetch` nu dans un écran Détail qui
 * fonctionnait. Une revue humaine ne rattrape pas ce genre d'oubli : le code
 * fautif est indistinguable du code correct à la lecture.
 */

const SRC = path.join(process.cwd(), "src");
const CLIENT = path.join(SRC, "shared", "apiClient.ts");

/** `fetch(` non précédé d'une lettre — exclut `apiFetch(` et tout autre suffixe. */
const BARE_FETCH = /(?<![A-Za-z])fetch\s*\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe("Discipline d'accès à l'API", () => {
  it("routes every frontend HTTP call through apiFetch", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      // `apiClient.ts` est le seul endroit autorisé à appeler `fetch` : c'est
      // lui qui ajoute l'en-tête.
      if (file === CLIENT) continue;

      readFileSync(file, "utf-8")
        .split("\n")
        .forEach((line, index) => {
          if (BARE_FETCH.test(line)) {
            offenders.push(`${path.relative(process.cwd(), file)}:${index + 1} → ${line.trim()}`);
          }
        });
    }

    expect(
      offenders,
      `Ces appels contournent apiFetch et répondront 401 en développement local.\n` +
        `Remplacez fetch(...) par apiFetch(...) et importez-le depuis src/shared/apiClient.\n\n` +
        offenders.join("\n")
    ).toEqual([]);
  });

  it("keeps the dev-identity header out of anything but the client", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== CLIENT)
      .filter((file) => readFileSync(file, "utf-8").includes("X-Dev-User-Email"))
      .map((file) => path.relative(process.cwd(), file));

    expect(
      offenders,
      "L'identité de développement se configure via apiClient (setDevUserEmail), " +
        "pas en posant l'en-tête à la main :\n" + offenders.join("\n")
    ).toEqual([]);
  });
});

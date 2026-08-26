import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S48 / S49 : chaque exécuteur ne ramasse que ce qui lui appartient.
 *
 * Playwright et Vitest lisent le même dossier `tests/`. Si Vitest collecte un
 * fichier Playwright, il échoue à l'import (`@playwright/test` n'est pas un
 * environnement Vitest) et la suite entière tombe pour une raison sans rapport
 * avec le produit. Si Playwright collecte un fichier Vitest, il l'ignore ou
 * plante selon la version. Les deux cas sont des pannes d'outillage qui
 * ressemblent à des régressions applicatives.
 *
 * La séparation repose aujourd'hui sur trois choses : le suffixe de fichier
 * (`.spec.ts` contre `.test.ts`), le `testDir` de Playwright, et une exclusion
 * répétée sur chaque projet Vitest — un projet n'hérite pas de l'`exclude` de
 * la racine, l'oubli est donc silencieux. Ce test vérifie les trois.
 */

const ROOT = process.cwd();
const TESTS = path.join(ROOT, "tests");
const E2E = path.join(TESTS, "e2e");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

/** Chemin relatif à la racine, séparateurs POSIX — la forme des motifs. */
function relative(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

/**
 * Traduit un motif glob en expression régulière.
 *
 * Seules les formes réellement employées par les configurations sont gérées :
 * `**` (n'importe quelle profondeur), `*` (un segment, sans `/`) et `?`.
 */
function globToRegExp(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        // `**/` absorbe aussi le séparateur, sinon `tests/**/*.ts` ne
        // couvrirait pas `tests/a.ts`.
        if (pattern[i + 2] === "/") {
          out += "(?:.*/)?";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else {
      out += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}$`);
}

/** Motifs `include` déclarés dans une configuration Vitest. */
function includePatterns(configFile: string): string[] {
  const source = readFileSync(path.join(ROOT, configFile), "utf-8");
  const blocks = source.match(/include:\s*\[[^\]]*\]/g) ?? [];
  return blocks.flatMap((block) => [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
}

describe("S48: Playwright ne collecte que tests/e2e", () => {
  const config = readFileSync(path.join(ROOT, "playwright.config.ts"), "utf-8");

  it("pins its test directory to tests/e2e", () => {
    expect(config).toMatch(/testDir:\s*"\.\/tests\/e2e"/);
    expect(config).toMatch(/testMatch:\s*"\*\*\/\*\.spec\.ts"/);
  });

  it("finds no .spec.ts file outside tests/e2e", () => {
    const strays = filesUnder(TESTS)
      .filter((file) => file.endsWith(".spec.ts"))
      .filter((file) => !file.startsWith(E2E + path.sep))
      .map(relative);

    expect(strays, "un fichier .spec.ts hors de tests/e2e serait ignoré par Playwright").toEqual([]);
  });
});

describe("S49: Vitest n'exécute aucun fichier de tests/e2e", () => {
  const CONFIGS = ["vitest.config.ts", "vitest.perf.config.ts"];

  it("declares no include pattern that could match a file under tests/e2e", () => {
    const e2eFiles = filesUnder(E2E).map(relative);
    expect(e2eFiles.length, "tests/e2e est vide : le test ne prouverait rien").toBeGreaterThan(0);

    for (const config of CONFIGS) {
      const patterns = includePatterns(config);
      expect(patterns.length, `aucun include trouvé dans ${config}`).toBeGreaterThan(0);

      for (const pattern of patterns) {
        const matcher = globToRegExp(pattern);
        for (const file of e2eFiles) {
          expect(matcher.test(file), `${config} : le motif ${pattern} attrape ${file}`).toBe(false);
        }
      }
    }
  });

  it("also excludes tests/e2e explicitly on every project", () => {
    // Ceinture et bretelles : l'exclusion protège d'un `include` élargi par
    // inadvertance. Elle doit être répétée par projet, un projet n'héritant
    // pas de l'`exclude` de la racine.
    for (const config of CONFIGS) {
      const source = readFileSync(path.join(ROOT, config), "utf-8");
      const projectCount = (source.match(/\bname:\s*"/g) ?? []).length;
      const excludeCount = (source.match(/exclude:\s*EXCLUDE/g) ?? []).length;

      expect(source, `${config} ne définit pas l'exclusion tests/e2e`).toContain('"tests/e2e/**"');
      expect(excludeCount, `${config} : ${projectCount} projet(s) mais ${excludeCount} exclusion(s)`).toBe(
        projectCount
      );
    }
  });

  it("finds no .test.ts file inside tests/e2e", () => {
    const strays = filesUnder(E2E)
      .filter((file) => /\.test\.tsx?$/.test(file))
      .map(relative);

    expect(strays, "un .test.ts dans tests/e2e serait collecté par Vitest").toEqual([]);
  });
});

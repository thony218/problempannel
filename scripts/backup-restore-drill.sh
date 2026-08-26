#!/usr/bin/env bash
#
# OPS-04 — exercice de sauvegarde et de restauration.
#
# `03_execution/06_BACKLOG_V1_ATOMIQUE.md` demande pour OPS-04 un « restore
# prouvé », et `05_qualite_exploitation/03_CHECKLIST_RELEASE.md` place
# « backup/restore testé » parmi les cases à cocher avant production. Aucune
# des deux n'avait jamais été exécutée : la production tourne depuis le
# 2026-08-24 sans qu'une seule restauration ait été tentée.
#
# Une sauvegarde jamais restaurée n'est pas une sauvegarde. Ce script exécute
# le cycle complet sur la base **locale** — empreinte, export, perte totale du
# stockage, réimport, comparaison — et échoue si la base restaurée ne
# correspond pas à celle d'avant destruction.
#
# Il ne s'exécute jamais contre la production : la destruction volontaire au
# milieu du cycle interdit d'en faire l'essai ailleurs qu'en local. La
# procédure distante correspondante est décrite dans
# `05_qualite_exploitation/08_SAUVEGARDE_RESTAURATION.md`.
#
# Usage : npm run drill:backup-restore

set -euo pipefail

DB="registre-erreurs-dev"
D1_STATE=".wrangler/state/v3/d1"
WORKDIR="$(mktemp -d)"
DUMP="$WORKDIR/backup.sql"
trap 'rm -rf "$WORKDIR"' EXIT

# Appel direct au binaire plutôt que `npx` : `npx` écrit des `npm notice` sur
# la sortie standard, qui corrompent le JSON attendu plus bas. Une première
# version de ce script utilisait `npx` et masquait les erreurs avec
# `2>/dev/null` : les comptages échouaient en silence, l'empreinte se
# retrouvait pleine de valeurs vides, et le script **annonçait la réussite**
# en comparant deux empreintes également tronquées. C'est le pire défaut
# possible pour un exercice de restauration, d'où les garde-fous ci-dessous.
WRANGLER="./node_modules/.bin/wrangler"

TABLES="users locations departments categories subcategories impact_types issues issue_impacts comments corrective_actions attachments issue_history issue_links"

# Nombre de lignes d'une table. Échoue franchement si la réponse n'est pas un
# entier : aucune valeur douteuse ne doit entrer dans une empreinte.
count_rows() {
  local table="$1" raw n
  raw="$("$WRANGLER" d1 execute "$DB" --local --json --command "SELECT COUNT(*) AS n FROM $table")" || {
    echo "✘ Requête impossible sur '$table'." >&2
    exit 1
  }
  n="$(printf '%s' "$raw" | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const value = JSON.parse(s)[0].results[0].n;
        if (!Number.isInteger(value)) throw new Error("compte non entier");
        process.stdout.write(String(value));
      } catch (error) {
        process.stderr.write(String(error.message));
        process.exit(1);
      }
    });
  ')" || {
    echo "✘ Réponse illisible pour '$table' : l'exercice ne peut rien conclure." >&2
    exit 1
  }
  printf '%s' "$n"
}

fingerprint() {
  for t in $TABLES; do
    printf '%s=%s\n' "$t" "$(count_rows "$t")"
  done
}

# Refuse toute empreinte incomplète. Sans ce filet, une empreinte partielle
# comparée à une autre empreinte partielle donne un faux succès.
assert_complete() {
  local label="$1" fp="$2" expected actual
  expected="$(echo "$TABLES" | wc -w | tr -d ' ')"
  actual="$(echo "$fp" | grep -cE '=[0-9]+$' || true)"
  if [ "$actual" != "$expected" ]; then
    echo "✘ Empreinte $label incomplète : $actual/$expected tables comptées." >&2
    echo "$fp" >&2
    exit 1
  fi
}

echo "── 1. Empreinte avant sauvegarde ────────────────────────────────"
BEFORE="$(fingerprint)"
assert_complete "initiale" "$BEFORE"
echo "$BEFORE"

TOTAL_BEFORE=$(echo "$BEFORE" | awk -F= '{s+=$2} END {print s}')
if [ "$TOTAL_BEFORE" -eq 0 ]; then
  echo "✘ La base locale est vide : l'exercice ne prouverait rien." >&2
  echo "  Amorcez-la d'abord : npm run db:reset:local" >&2
  exit 1
fi
echo "Total : $TOTAL_BEFORE lignes."

echo
echo "── 2. Sauvegarde ────────────────────────────────────────────────"
"$WRANGLER" d1 export "$DB" --local --output "$DUMP" >/dev/null
echo "Dump écrit : $(wc -l < "$DUMP" | tr -d ' ') lignes SQL, $(du -h "$DUMP" | cut -f1 | tr -d ' ')."

echo
echo "── 3. Destruction totale ────────────────────────────────────────"
# On efface le stockage D1 local en entier plutôt que table par table. SQLite
# refuse de supprimer une table encore référencée par une clé étrangère, et
# deviner l'ordre rendrait le script solidaire du schéma. Surtout, une
# suppression partielle simule un accident partiel, alors que le sinistre qui
# justifie une sauvegarde est la perte totale : on simule ce qu'on veut
# savoir survivre.
rm -rf "$D1_STATE"
if [ -d "$D1_STATE" ]; then
  echo "✘ Le stockage local subsiste : la destruction a échoué." >&2
  exit 1
fi
echo "Stockage D1 local effacé ($D1_STATE)."

echo
echo "── 4. Restauration ──────────────────────────────────────────────"
"$WRANGLER" d1 execute "$DB" --local --file "$DUMP" >/dev/null
echo "Dump réappliqué sur une base recréée de zéro."

echo
echo "── 5. Empreinte après restauration ──────────────────────────────"
AFTER="$(fingerprint)"
assert_complete "finale" "$AFTER"
echo "$AFTER"

echo
if [ "$BEFORE" = "$AFTER" ]; then
  echo "✔ RESTAURATION PROUVÉE — $TOTAL_BEFORE lignes sur $(echo "$TABLES" | wc -w | tr -d ' ') tables,"
  echo "  retrouvées à l'identique après effacement complet du stockage."
  exit 0
fi

echo "✘ ÉCHEC — la base restaurée diffère de l'originale :" >&2
diff <(echo "$BEFORE") <(echo "$AFTER") >&2 || true
exit 1

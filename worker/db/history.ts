export interface NewHistoryEvent {
  actorUserId: number;
  eventType: string;
  /**
   * Métadonnées structurelles uniquement (ids, enums, noms de champ).
   * Ne jamais y mettre un texte libre modifiable (description,
   * causeSummary, commentaire, ...) — cf. 01_produit/09_CAVIARDAGE_ET_
   * HISTORIQUE.md : l'historique enregistre qu'un champ a changé, jamais
   * son contenu.
   */
  payload?: Record<string, unknown>;
}

/** À utiliser quand l'id du dossier est déjà connu (PATCH, commentaires, ...). */
export function insertHistoryEventStatement(db: D1Database, issueId: number, event: NewHistoryEvent) {
  return db
    .prepare(
      "INSERT INTO issue_history (issue_id, actor_user_id, event_type, payload_json) VALUES (?, ?, ?, ?)"
    )
    .bind(issueId, event.actorUserId, event.eventType, JSON.stringify(event.payload ?? {}));
}

/**
 * À utiliser uniquement dans le même db.batch() que la création du
 * dossier, où l'id n'est pas encore connu côté application (RETURNING
 * n'est lu qu'après l'exécution complète du batch). Sûr car un batch D1
 * est une transaction atomique : aucune autre écriture ne peut
 * s'intercaler entre l'insertion du dossier et cette sous-requête, donc
 * "le dossier avec le plus grand id" désigne forcément celui qu'on vient
 * de créer — contrairement à last_insert_rowid(), qui change dès qu'une
 * AUTRE instruction du même batch insère une ligne (bug réel corrigé
 * dans ISSUE-03 : voir JOURNAL_TRAVAIL.md).
 */
export function insertHistoryEventForJustCreatedIssueStatement(db: D1Database, event: NewHistoryEvent) {
  return db
    .prepare(
      `INSERT INTO issue_history (issue_id, actor_user_id, event_type, payload_json)
       SELECT id, ?, ?, ? FROM issues ORDER BY id DESC LIMIT 1`
    )
    .bind(event.actorUserId, event.eventType, JSON.stringify(event.payload ?? {}));
}

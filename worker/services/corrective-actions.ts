import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "../domain/errors";
import { parsePublicId } from "../domain/publicId";
import { findIssueRowById } from "../db/issues";
import { findActiveUserById } from "../db/users";
import {
  findCorrectiveActionById,
  findCorrectiveActionsByIssueId,
  insertCorrectiveAction,
  mapCorrectiveActionRow,
  updateCorrectiveActionRow,
  STATUS_API_TO_DB,
  type ApiCorrectiveAction,
  type CorrectiveActionColumnUpdates,
} from "../db/corrective-actions";
import { insertHistoryEventStatement } from "../db/history";
import type { CreateCorrectiveActionInput, UpdateCorrectiveActionInput } from "../validation/corrective-actions";

export type Role = components["schemas"]["Role"];

export async function listCorrectiveActions(
  db: D1Database,
  publicId: string
): Promise<ApiCorrectiveAction[] | null> {
  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  return findCorrectiveActionsByIssueId(db, issueId);
}

export async function createCorrectiveAction(
  db: D1Database,
  publicId: string,
  input: CreateCorrectiveActionInput,
  actorUserId: number,
  actorRole: Role
): Promise<ApiCorrectiveAction | null> {
  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  // 01_produit/04_MATRICE_PERMISSIONS.md : Créer/assigner action -> manager/admin uniquement
  if (actorRole !== "manager" && actorRole !== "admin") {
    throw new AppError(
      "FORBIDDEN",
      "Seuls les gestionnaires et administrateurs peuvent créer et assigner une action corrective."
    );
  }

  // Vérifier que le responsable existe et est actif
  const owner = await findActiveUserById(db, input.ownerUserId);
  if (!owner) {
    throw new AppError("VALIDATION_ERROR", "Données invalides.", {
      ownerUserId: "L'utilisateur assigné est inactif ou introuvable.",
    });
  }

  const inserted = await insertCorrectiveAction(db, {
    issueId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    ownerUserId: input.ownerUserId,
    dueDate: input.dueDate,
    status: STATUS_API_TO_DB[input.status],
    blocksIssueClosure: input.blocksIssueClosure,
  });

  // Consigner l'événement d'historique sur le dossier parent
  await insertHistoryEventStatement(db, issueId, {
    actorUserId,
    eventType: "corrective_action_created",
    payload: { actionId: inserted.id },
  }).run();

  return mapCorrectiveActionRow(inserted);
}

export async function getCorrectiveAction(
  db: D1Database,
  actionId: number
): Promise<ApiCorrectiveAction | null> {
  const row = await findCorrectiveActionById(db, actionId);
  if (!row) return null;
  return mapCorrectiveActionRow(row);
}

export async function updateCorrectiveAction(
  db: D1Database,
  actionId: number,
  input: UpdateCorrectiveActionInput,
  actorUserId: number,
  actorRole: Role
): Promise<ApiCorrectiveAction | null> {
  const current = await findCorrectiveActionById(db, actionId);
  if (!current) return null;

  // 01_produit/04_MATRICE_PERMISSIONS.md : Modifier sa propre action
  // employee: seulement status et result, et seulement si owner_user_id === actor.id
  if (actorRole === "employee") {
    if (current.owner_user_id !== actorUserId) {
      throw new AppError(
        "FORBIDDEN",
        "Un employé ne peut modifier que les actions correctives dont il est le responsable désigné."
      );
    }

    if (
      input.title !== undefined ||
      input.description !== undefined ||
      input.ownerUserId !== undefined ||
      input.dueDate !== undefined ||
      input.blocksIssueClosure !== undefined ||
      input.effectivenessStatus !== undefined
    ) {
      throw new AppError(
        "FORBIDDEN",
        "Un employé ne peut mettre à jour que le statut et le résultat de son action corrective."
      );
    }
  }

  const updates: CorrectiveActionColumnUpdates = {};

  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.ownerUserId !== undefined) {
    const owner = await findActiveUserById(db, input.ownerUserId);
    if (!owner) {
      throw new AppError("VALIDATION_ERROR", "Données invalides.", {
        ownerUserId: "L'utilisateur assigné est inactif ou introuvable.",
      });
    }
    updates.owner_user_id = input.ownerUserId;
  }
  if (input.dueDate !== undefined) updates.due_date = input.dueDate;
  if (input.status !== undefined) {
    updates.status = STATUS_API_TO_DB[input.status];
    if (input.status === "done") {
      updates.completed_at = current.completed_at || new Date().toISOString();
    } else {
      updates.completed_at = null;
    }
  }
  if (input.blocksIssueClosure !== undefined) updates.blocks_issue_closure = input.blocksIssueClosure ? 1 : 0;
  if (input.result !== undefined) updates.result = input.result?.trim() || null;
  if (input.effectivenessStatus !== undefined) updates.effectiveness_status = input.effectivenessStatus;

  const updated = await updateCorrectiveActionRow(db, actionId, updates);
  if (!updated) return null;

  // Consigner l'événement d'historique sur le dossier parent
  await insertHistoryEventStatement(db, current.issue_id, {
    actorUserId,
    eventType: "corrective_action_updated",
    payload: { actionId },
  }).run();

  return mapCorrectiveActionRow(updated);
}

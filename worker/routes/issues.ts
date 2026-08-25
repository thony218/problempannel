import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { AppError, okBody } from "../domain/errors";
import { issueETag } from "../domain/etag";
import { parsePublicId } from "../domain/publicId";
import { requireUser } from "../auth/middleware";
import { parseJsonBody, parseQueryParams } from "../validation/request";
import { createIssueRequestSchema, listIssuesQuerySchema, updateIssueRequestSchema } from "../validation/issues";
import { createIssue, getIssueDetail, listIssues, updateIssue } from "../services/issues";
import { appConfigFromEnv } from "../domain/config";

export const issueRoutes = new Hono<AppEnv>();

issueRoutes.get("/issues", requireUser, async (c) => {
  const query = parseQueryParams(c, listIssuesQuerySchema);
  const result = await listIssues(c.env.DB, query, appConfigFromEnv(c.env));
  return c.json(okBody(result), 200);
});

issueRoutes.get("/issues/:publicId", requireUser, async (c) => {
  const detail = await getIssueDetail(c.env.DB, c.req.param("publicId"));
  if (!detail) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }
  c.header("ETag", issueETag(parsePublicId(detail.issue.publicId) as number, detail.issue.rowVersion));
  return c.json(okBody(detail), 200);
});

issueRoutes.patch("/issues/:publicId", requireUser, async (c) => {
  const ifMatch = c.req.header("If-Match");
  if (!ifMatch) {
    throw new AppError("PRECONDITION_REQUIRED", "En-tête If-Match requis.");
  }
  const user = c.get("user");
  const input = await parseJsonBody(c, updateIssueRequestSchema);
  const detail = await updateIssue(
    c.env.DB,
    c.req.param("publicId"),
    ifMatch,
    user.id,
    user.role,
    input,
    appConfigFromEnv(c.env)
  );
  if (!detail) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }
  c.header("ETag", issueETag(parsePublicId(detail.issue.publicId) as number, detail.issue.rowVersion));
  return c.json(okBody(detail), 200);
});


issueRoutes.post("/issues", requireUser, async (c) => {
  const input = await parseJsonBody(c, createIssueRequestSchema);
  const issue = await createIssue(c.env.DB, c.get("user").id, input);
  c.header("ETag", issueETag(parsePublicId(issue.publicId) as number, issue.rowVersion));
  return c.json(okBody(issue), 201);
});

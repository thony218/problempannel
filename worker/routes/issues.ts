import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { okBody } from "../domain/errors";
import { issueETag } from "../domain/etag";
import { parsePublicId } from "../domain/publicId";
import { requireUser } from "../auth/middleware";
import { parseJsonBody, parseQueryParams } from "../validation/request";
import { createIssueRequestSchema, listIssuesQuerySchema } from "../validation/issues";
import { createIssue, listIssues } from "../services/issues";

export const issueRoutes = new Hono<AppEnv>();

issueRoutes.get("/issues", requireUser, async (c) => {
  const query = parseQueryParams(c, listIssuesQuerySchema);
  const result = await listIssues(c.env.DB, query);
  return c.json(okBody(result), 200);
});

issueRoutes.post("/issues", requireUser, async (c) => {
  const input = await parseJsonBody(c, createIssueRequestSchema);
  const issue = await createIssue(c.env.DB, c.get("user").id, input);
  c.header("ETag", issueETag(parsePublicId(issue.publicId) as number, issue.rowVersion));
  return c.json(okBody(issue), 201);
});

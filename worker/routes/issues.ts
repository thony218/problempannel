import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { okBody } from "../domain/errors";
import { issueETag } from "../domain/etag";
import { parsePublicId } from "../domain/publicId";
import { requireUser } from "../auth/middleware";
import { parseJsonBody } from "../validation/request";
import { createIssueRequestSchema } from "../validation/issues";
import { createIssue } from "../services/issues";

export const issueRoutes = new Hono<AppEnv>();

issueRoutes.post("/issues", requireUser, async (c) => {
  const input = await parseJsonBody(c, createIssueRequestSchema);
  const issue = await createIssue(c.env.DB, c.get("user").id, input);
  c.header("ETag", issueETag(parsePublicId(issue.publicId) as number, issue.rowVersion));
  return c.json(okBody(issue), 201);
});

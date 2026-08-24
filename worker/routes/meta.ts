import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { okBody } from "../domain/errors";
import { requireUser } from "../auth/middleware";
import { buildMeta, type MetaConfig } from "../services/meta";

export const metaRoutes = new Hono<AppEnv>();

function configFromEnv(env: AppEnv["Bindings"]): MetaConfig {
  return {
    businessTimeZone: env.BUSINESS_TIME_ZONE,
    maxAttachmentBytes: Number(env.MAX_ATTACHMENT_BYTES),
    maxAttachmentsPerIssue: Number(env.MAX_ATTACHMENTS_PER_ISSUE),
    recurringWindowDays: Number(env.RECURRING_WINDOW_DAYS),
    recurringMinCount: Number(env.RECURRING_MIN_COUNT),
  };
}

metaRoutes.get("/meta", requireUser, async (c) => {
  const meta = await buildMeta(c.env.DB, configFromEnv(c.env));
  return c.json(okBody(meta));
});

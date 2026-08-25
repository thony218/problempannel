import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { okBody } from "../domain/errors";
import { requireUser } from "../auth/middleware";
import { buildMeta } from "../services/meta";
import { appConfigFromEnv } from "../domain/config";

export const metaRoutes = new Hono<AppEnv>();

metaRoutes.get("/meta", requireUser, async (c) => {
  // Même source que l'application des règles côté serveur (limites de PJ,
  // fuseau métier) : le client ne peut pas se voir annoncer une limite que le
  // serveur n'applique pas.
  const meta = await buildMeta(c.env.DB, appConfigFromEnv(c.env));
  return c.json(okBody(meta));
});

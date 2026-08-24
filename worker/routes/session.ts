import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { okBody } from "../domain/errors";
import { requireUser } from "../auth/middleware";

export const sessionRoutes = new Hono<AppEnv>();

sessionRoutes.get("/me", requireUser, (c) => c.json(okBody(c.get("user"))));

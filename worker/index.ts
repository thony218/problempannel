import { Hono } from "hono";
import type { AppEnv } from "./domain/types";
import { AppError, errorBody, okBody } from "./domain/errors";
import { sessionRoutes } from "./routes/session";
import { metaRoutes } from "./routes/meta";

export const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
});

app.onError((err, c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message, requestId, err.fields), err.status as never);
  }
  console.error(JSON.stringify({ requestId, event: "unhandled_error", error: String(err) }));
  return c.json(errorBody("INTERNAL_ERROR", "Erreur interne.", requestId), 500);
});

app.get("/api/health", (c) => c.json(okBody({ status: "ok" })));
app.route("/api", sessionRoutes);
app.route("/api", metaRoutes);

export default app;

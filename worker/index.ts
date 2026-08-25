import { Hono } from "hono";
import type { AppEnv } from "./domain/types";
import { AppError, errorBody, okBody } from "./domain/errors";
import { sessionRoutes } from "./routes/session";
import { metaRoutes } from "./routes/meta";
import { issueRoutes } from "./routes/issues";
import { commentRoutes } from "./routes/comments";
import { attachmentRoutes } from "./routes/attachments";
import { correctiveActionRoutes } from "./routes/corrective-actions";
import { historyRoutes } from "./routes/history";
import { linkRoutes } from "./routes/links";
import { analyticsRoutes } from "./routes/analytics";
import { adminRoutes } from "./routes/admin";

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
app.route("/api", issueRoutes);
app.route("/api", commentRoutes);
app.route("/api", attachmentRoutes);
app.route("/api", correctiveActionRoutes);
app.route("/api", historyRoutes);
app.route("/api", linkRoutes);
app.route("/api", analyticsRoutes);
app.route("/api", adminRoutes);

export default app;

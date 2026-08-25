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

/**
 * Journalisation d'une ligne par requête (02_contrats/04_SECURITE_AUTH.md §Logs).
 *
 * À logger : requestId, route, statut HTTP, durée, code d'erreur.
 * À ne jamais logger : JWT, cookies, secrets, fichiers, corps complet des
 * descriptions et commentaires. C'est pourquoi on journalise le **motif de
 * route** (`/api/issues/:publicId`) et non l'URL réelle : celle-ci porte le
 * numéro de dossier, et les paramètres de recherche `q` contiennent du texte
 * saisi par l'utilisateur.
 *
 * `c.get("user")` n'est renseigné que si `requireUser` s'est exécuté ; l'id
 * interne est journalisé, jamais le courriel.
 */
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  const startedAt = Date.now();

  await next();

  const errorCode = c.res.headers.get("X-Error-Code");
  console.log(
    JSON.stringify({
      event: "request",
      requestId,
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
      userId: c.get("user")?.id ?? null,
      ...(errorCode ? { errorCode } : {}),
    })
  );
});

app.onError((err, c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();

  if (err instanceof AppError) {
    // Repris par le middleware de journalisation, qui n'a pas accès à l'erreur.
    c.header("X-Error-Code", err.code);
    return c.json(errorBody(err.code, err.message, requestId, err.fields), err.status as never);
  }

  // `String(err)` et non l'objet complet : une trace d'erreur SQL peut contenir
  // les valeurs liées, donc du texte saisi par l'utilisateur.
  console.error(JSON.stringify({ event: "unhandled_error", requestId, error: String(err) }));
  c.header("X-Error-Code", "INTERNAL_ERROR");
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

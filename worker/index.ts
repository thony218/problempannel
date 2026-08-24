import { Hono } from "hono";

type Bindings = { DB: D1Database; ATTACHMENTS: R2Bucket; APP_ENV: string; BUSINESS_TIME_ZONE: string; };
export const app = new Hono<{ Bindings: Bindings }>();
app.get("/api/health", (c) => c.json({ ok: true, data: { status: "ok" } }));
export default app;

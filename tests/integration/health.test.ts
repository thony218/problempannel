import { describe, expect, it } from "vitest";
import { app } from "../../worker/index";
describe("health",()=>{it("returns ok",async()=>{const r=await app.request("http://local/api/health");expect(r.status).toBe(200);});});

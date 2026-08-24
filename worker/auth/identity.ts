import { createRemoteJWKSet } from "jose";
import type { Context } from "hono";
import type { AppEnv } from "../domain/types";
import { AppError } from "../domain/errors";
import { accessJwksUrl, verifyAccessJwt } from "./access";

const DEV_HEADER = "X-Dev-User-Email";
const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let cachedTeamDomain: string | undefined;

function remoteJwksFor(teamDomain: string) {
  if (!cachedJwks || cachedTeamDomain !== teamDomain) {
    cachedJwks = createRemoteJWKSet(accessJwksUrl(teamDomain));
    cachedTeamDomain = teamDomain;
  }
  return cachedJwks;
}

/**
 * Résout l'identité (courriel) de la requête.
 *
 * - `APP_ENV=local` : en-tête X-Dev-User-Email (dev uniquement, cf.
 *   02_contrats/04_SECURITE_AUTH.md — impossible en staging/prod car ce
 *   chemin n'est emprunté que si APP_ENV vaut exactement "local", une
 *   variable Worker définie au déploiement, jamais par le client).
 * - sinon : jeton Cloudflare Access (en-tête Cf-Access-Jwt-Assertion),
 *   validé contre le JWKS de l'équipe (audience + issuer).
 */
export async function resolveIdentityEmail(c: Context<AppEnv>): Promise<string> {
  if (c.env.APP_ENV === "local") {
    const email = c.req.header(DEV_HEADER);
    if (!email) {
      throw new AppError("UNAUTHORIZED", "En-tête X-Dev-User-Email requis en mode local.");
    }
    return email;
  }

  const token = c.req.header(ACCESS_JWT_HEADER);
  if (!token) {
    throw new AppError("UNAUTHORIZED", "Jeton Cloudflare Access manquant.");
  }
  try {
    const identity = await verifyAccessJwt(token, {
      teamDomain: c.env.ACCESS_TEAM_DOMAIN,
      audience: c.env.ACCESS_AUD,
      getKey: remoteJwksFor(c.env.ACCESS_TEAM_DOMAIN),
    });
    return identity.email;
  } catch {
    throw new AppError("UNAUTHORIZED", "Jeton Cloudflare Access invalide.");
  }
}

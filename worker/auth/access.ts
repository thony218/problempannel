import { jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessIdentity {
  email: string;
}

export function accessJwksUrl(teamDomain: string): URL {
  return new URL(`https://${teamDomain}/cdn-cgi/access/certs`);
}

/**
 * Valide un jeton Cloudflare Access (en-tête Cf-Access-Jwt-Assertion).
 * `getKey` est injecté pour permettre les tests avec un JWKS local — en
 * production c'est un `createRemoteJWKSet(accessJwksUrl(teamDomain))`.
 */
export async function verifyAccessJwt(
  token: string,
  opts: { teamDomain: string; audience: string; getKey: JWTVerifyGetKey }
): Promise<AccessIdentity> {
  const { payload } = await jwtVerify(token, opts.getKey, {
    issuer: `https://${opts.teamDomain}`,
    audience: opts.audience,
  });
  const email = typeof payload.email === "string" ? payload.email : undefined;
  if (!email) {
    throw new Error("Access JWT missing email claim");
  }
  return { email };
}

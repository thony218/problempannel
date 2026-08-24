import { describe, expect, it } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from "jose";
import { verifyAccessJwt } from "../../worker/auth/access";

const TEAM_DOMAIN = "acme.cloudflareaccess.com";
const AUDIENCE = "test-aud";
const KID = "test-key";

async function setupKeys() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = KID;
  jwk.alg = "ES256";
  const getKey = createLocalJWKSet({ keys: [jwk] });
  return { privateKey, getKey };
}

async function signToken(
  privateKey: CryptoKey,
  overrides: { issuer?: string; audience?: string; email?: string | null } = {}
) {
  const builder = new SignJWT(
    overrides.email === null ? {} : { email: overrides.email ?? "user@example.test" }
  )
    .setProtectedHeader({ alg: "ES256", kid: KID })
    .setIssuedAt()
    .setExpirationTime("10m")
    .setIssuer(overrides.issuer ?? `https://${TEAM_DOMAIN}`)
    .setAudience(overrides.audience ?? AUDIENCE);
  return builder.sign(privateKey);
}

describe("verifyAccessJwt", () => {
  it("accepts a valid token and returns the email claim", async () => {
    const { privateKey, getKey } = await setupKeys();
    const token = await signToken(privateKey);
    const identity = await verifyAccessJwt(token, { teamDomain: TEAM_DOMAIN, audience: AUDIENCE, getKey });
    expect(identity.email).toBe("user@example.test");
  });

  it("rejects a token with the wrong audience", async () => {
    const { privateKey, getKey } = await setupKeys();
    const token = await signToken(privateKey, { audience: "other-aud" });
    await expect(
      verifyAccessJwt(token, { teamDomain: TEAM_DOMAIN, audience: AUDIENCE, getKey })
    ).rejects.toBeTruthy();
  });

  it("rejects a token with the wrong issuer", async () => {
    const { privateKey, getKey } = await setupKeys();
    const token = await signToken(privateKey, { issuer: "https://evil.example" });
    await expect(
      verifyAccessJwt(token, { teamDomain: TEAM_DOMAIN, audience: AUDIENCE, getKey })
    ).rejects.toBeTruthy();
  });

  it("rejects a token without an email claim", async () => {
    const { privateKey, getKey } = await setupKeys();
    const token = await signToken(privateKey, { email: null });
    await expect(
      verifyAccessJwt(token, { teamDomain: TEAM_DOMAIN, audience: AUDIENCE, getKey })
    ).rejects.toThrow("email");
  });
});

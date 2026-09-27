import { env } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";

const noStore = { "Cache-Control": "no-store" };
let keySet: ReturnType<typeof createRemoteJWKSet> | undefined;
let keySetDomain: string | undefined;

export async function authenticatedOwner(request: Request): Promise<string | Response> {
  const settings = env as unknown as { TEAM_DOMAIN?: string; POLICY_AUD?: string };
  const domain = settings.TEAM_DOMAIN?.replace(/\/$/, "");
  const audience = settings.POLICY_AUD;
  if (!domain || !audience) {
    return Response.json({ error: "Connexion non configurée : TEAM_DOMAIN et POLICY_AUD sont requis." }, { status: 503, headers: noStore });
  }

  // Never use an untrusted issuer from a JWT as a URL to fetch signing keys.
  let url: URL;
  try {
    url = new URL(domain);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com") || url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw Error("Invalid team domain");
  } catch {
    return Response.json({ error: "TEAM_DOMAIN invalide." }, { status: 503, headers: noStore });
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return Response.json({ error: "Connexion requise. Rechargez la page pour vous identifier." }, { status: 401, headers: noStore });
  try {
    if (keySetDomain !== domain) {
      keySet = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", url));
      keySetDomain = domain;
    }
    const { payload } = await jwtVerify(token, keySet!, {
      issuer: domain,
      audience,
      algorithms: ["RS256"],
    });
    // Service tokens are not human accounts; a stable subject is required for isolation.
    if (payload.type !== "app" || typeof payload.sub !== "string" || !payload.sub.trim()) throw Error("Human identity required");
    return payload.sub;
  } catch {
    return Response.json({ error: "Session expirée ou non autorisée. Reconnectez-vous." }, { status: 401, headers: noStore });
  }
}

export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: noStore });
}

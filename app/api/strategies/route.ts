import { authenticatedOwner, privateJson } from "@/lib/auth";
import { database } from "@/lib/storage";
import { Strategy, metrics, validateMarket, validWeights, validConfig } from "@/lib/portfolio";

export async function GET(request: Request) {
  const owner = await authenticatedOwner(request);
  if (owner instanceof Response) return owner;
  try {
    const id = new URL(request.url).searchParams.get("clientId");
    if (!id) return privateJson({ strategies: [] });
    const db = database();
    if (!await db.prepare("SELECT id FROM clients WHERE id=? AND owner_id=?").bind(id, owner).first()) return privateJson({ error: "Client introuvable." }, 404);
    const { results } = await db.prepare("SELECT payload FROM strategies WHERE client_id=? AND owner_id=? ORDER BY created_at DESC")
      .bind(id, owner).all<{ payload: string }>();
    return privateJson({ strategies: results.map((row) => JSON.parse(row.payload)) });
  } catch (error) {
    console.error(error);
    return privateJson({ error: "Les stratégies sauvegardées sont indisponibles." }, 503);
  }
}

export async function POST(request: Request) {
  const owner = await authenticatedOwner(request);
  if (owner instanceof Response) return owner;
  try {
    const strategy: Strategy = await request.json();
    if (!strategy || typeof strategy.name !== "string" || !strategy.name.trim() || strategy.name.length > 120 ||
        typeof strategy.clientId !== "string" || !strategy.clientId || !Number.isFinite(strategy.wealth) || strategy.wealth <= 0) {
      return privateJson({ error: "Nom et client requis." }, 400);
    }
    const db = database();
    if (!await db.prepare("SELECT id FROM clients WHERE id=? AND owner_id=?").bind(strategy.clientId, owner).first()) return privateJson({ error: "Client introuvable." }, 404);
    validateMarket(strategy.market);
    if (!validWeights(strategy.weights, strategy.market.assets.length) || !validWeights(strategy.initial, strategy.market.assets.length) ||
        !validConfig(strategy.config, strategy.market.assets.length)) throw Error("Allocation ou contraintes invalides.");
    strategy.metrics = metrics(strategy.weights, strategy.initial, strategy.market, strategy.config.feeRate);
    if (strategy.metrics.vol > strategy.config.maxVol + (strategy.config.tolerance ? .01 : 0) + 1e-6 ||
        Math.max(...strategy.weights) > strategy.config.maxWeight + 1e-6 ||
        (strategy.config.mode === "risk" && strategy.metrics.net < strategy.config.minReturn - 1e-6)) throw Error("La stratégie ne respecte pas les contraintes.");
    strategy.id = crypto.randomUUID();
    strategy.createdAt = new Date().toISOString();
    await db.prepare("INSERT INTO strategies(id,client_id,owner_id,payload,created_at) VALUES(?,?,?,?,?)")
      .bind(strategy.id, strategy.clientId, owner, JSON.stringify(strategy), strategy.createdAt).run();
    return privateJson({ strategy }, 201);
  } catch (error) {
    console.error(error);
    return privateJson({ error: error instanceof Error ? error.message : "Enregistrement impossible." }, 400);
  }
}

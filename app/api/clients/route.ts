import { authenticatedOwner, privateJson } from "@/lib/auth";
import { database } from "@/lib/storage";
import { Client, demoClient, validateMarket, validWeights } from "@/lib/portfolio";

export async function GET(request: Request) {
  const owner = await authenticatedOwner(request);
  if (owner instanceof Response) return owner;
  try {
    const db = database();
    let { results } = await db.prepare("SELECT payload FROM clients WHERE owner_id=? ORDER BY updated_at DESC").bind(owner).all<{ payload: string }>();
    if (!results.length) {
      const client = demoClient();
      client.id = crypto.randomUUID();
      await db.prepare("INSERT INTO clients (id,owner_id,payload,updated_at) VALUES (?,?,?,?)")
        .bind(client.id, owner, JSON.stringify(client), new Date().toISOString()).run();
      results = [{ payload: JSON.stringify(client) }];
    }
    return privateJson({ clients: results.map((row) => JSON.parse(row.payload)) });
  } catch (error) {
    console.error(error);
    return privateJson({ error: "Les dossiers clients sont indisponibles. Réessayez dans un instant." }, 503);
  }
}

async function save(request: Request, update: boolean) {
  const owner = await authenticatedOwner(request);
  if (owner instanceof Response) return owner;
  try {
    const client: Client = await request.json();
    if (!client || typeof client.firstName !== "string" || !client.firstName.trim() || client.firstName.length > 100 ||
        typeof client.lastName !== "string" || !client.lastName.trim() || client.lastName.length > 100 ||
        !Number.isInteger(client.age) || client.age < 1 || client.age > 120 ||
        !Number.isFinite(client.wealth) || client.wealth <= 0 || client.wealth > 1e13 ||
        typeof client.address !== "string" || !client.address.trim() || client.address.length > 1000) {
      return privateJson({ error: "Vérifiez le nom, le prénom, l’âge, la fortune et l’adresse." }, 400);
    }
    validateMarket(client.market);
    if (!validWeights(client.initial, client.market.assets.length)) return privateJson({ error: "L’allocation doit être positive et totaliser 100 %." }, 400);
    const db = database();
    if (update) {
      if (typeof client.id !== "string" || !await db.prepare("SELECT id FROM clients WHERE id=? AND owner_id=?").bind(client.id, owner).first()) {
        return privateJson({ error: "Client introuvable." }, 404);
      }
      await db.prepare("UPDATE clients SET payload=?,updated_at=? WHERE id=? AND owner_id=?")
        .bind(JSON.stringify(client), new Date().toISOString(), client.id, owner).run();
    } else {
      client.id = crypto.randomUUID();
      client.demo = false;
      await db.prepare("INSERT INTO clients(id,owner_id,payload,updated_at) VALUES(?,?,?,?)")
        .bind(client.id, owner, JSON.stringify(client), new Date().toISOString()).run();
    }
    return privateJson({ client }, update ? 200 : 201);
  } catch (error) {
    console.error(error);
    return privateJson({ error: error instanceof Error ? error.message : "Enregistrement impossible." }, 400);
  }
}

export const POST = (request: Request) => save(request, false);
export const PUT = (request: Request) => save(request, true);

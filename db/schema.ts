import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(), ownerId: text("owner_id"), payload: text("payload").notNull(), updatedAt: text("updated_at").notNull(),
}, (t) => [index("idx_clients_owner").on(t.ownerId, t.updatedAt)]);
export const strategies = sqliteTable("strategies", {
  id: text("id").primaryKey(), clientId: text("client_id").notNull().references(() => clients.id),
  ownerId: text("owner_id"), payload: text("payload").notNull(), createdAt: text("created_at").notNull(),
}, (t) => [index("idx_strategies_client").on(t.clientId, t.createdAt), index("idx_strategies_owner").on(t.ownerId, t.clientId, t.createdAt)]);

-- Apply once to the existing D1 database BEFORE deploying the new Worker.
-- Existing shared records remain NULL (quarantined); do not auto-assign them.
ALTER TABLE clients ADD COLUMN owner_id TEXT;
ALTER TABLE strategies ADD COLUMN owner_id TEXT;
CREATE INDEX idx_clients_owner ON clients(owner_id, updated_at);
CREATE INDEX idx_strategies_owner ON strategies(owner_id, client_id, created_at);

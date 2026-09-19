CREATE TABLE IF NOT EXISTS ai_budget (day text PRIMARY KEY, calls integer NOT NULL);
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}';

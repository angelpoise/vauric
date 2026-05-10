-- Add scenario_schedule column to admin_nodes
-- analysis_schedule already existed on the original admin_stocks table;
-- scenario_schedule was added to application code without a matching migration.

ALTER TABLE admin_nodes
  ADD COLUMN IF NOT EXISTS scenario_schedule text;

-- Build 2d — cached overview columns for hierarchy nodes
ALTER TABLE admin_nodes ADD COLUMN IF NOT EXISTS cached_overview                text;
ALTER TABLE admin_nodes ADD COLUMN IF NOT EXISTS cached_overview_generated_at   timestamptz;

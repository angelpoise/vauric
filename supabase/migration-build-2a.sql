-- ═══════════════════════════════════════════════════════════════════════════════
-- Vauric Build 2a — Connection tier system + cleanup
-- Run against dev branch first, verify, then prod.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Add tier column (must happen before DROP to allow migration) ────────────
ALTER TABLE admin_connections
  ADD COLUMN tier integer NOT NULL DEFAULT 2
  CHECK (tier IN (1, 2, 3));

-- ── 2. Migrate existing is_primary data ──────────────────────────────────────
UPDATE admin_connections SET tier = 1 WHERE is_primary = true;
UPDATE admin_connections SET tier = 2 WHERE is_primary = false;

-- ── 3. Drop is_primary ────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_admin_connections_is_primary;
ALTER TABLE admin_connections DROP COLUMN is_primary;

CREATE INDEX idx_admin_connections_tier ON admin_connections(tier);

-- ── 4. Drop tags from admin_nodes ─────────────────────────────────────────────
DROP INDEX IF EXISTS idx_admin_nodes_tags;
ALTER TABLE admin_nodes DROP COLUMN IF EXISTS tags;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Vauric Hierarchy Foundation — Build 1
-- Run in Supabase SQL editor against the dev branch, verify, then prod.
-- All statements are idempotent where possible (IF NOT EXISTS / DROP IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Rename core table ─────────────────────────────────────────────────────
ALTER TABLE admin_stocks RENAME TO admin_nodes;

-- ── 2. Relax NOT NULL constraints that are stock-only ────────────────────────
ALTER TABLE admin_nodes ALTER COLUMN company_name DROP NOT NULL;
ALTER TABLE admin_nodes ALTER COLUMN ticker       DROP NOT NULL;
ALTER TABLE admin_nodes ALTER COLUMN sector       DROP NOT NULL;

-- ── 3. node_type discriminator ───────────────────────────────────────────────
ALTER TABLE admin_nodes
  ADD COLUMN node_type text NOT NULL DEFAULT 'stock'
  CHECK (node_type IN ('sector', 'subsector', 'subsubsector', 'stock'));

CREATE INDEX idx_admin_nodes_node_type ON admin_nodes(node_type);

-- ── 4. is_primary on connections ─────────────────────────────────────────────
ALTER TABLE admin_connections
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

CREATE INDEX idx_admin_connections_is_primary
  ON admin_connections(is_primary)
  WHERE is_primary = true;

-- ── 5. Tags array ─────────────────────────────────────────────────────────────
ALTER TABLE admin_nodes
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_admin_nodes_tags ON admin_nodes USING gin(tags);

-- ── 6. New nullable hierarchy columns ────────────────────────────────────────
ALTER TABLE admin_nodes ADD COLUMN IF NOT EXISTS etf_ticker     text;
ALTER TABLE admin_nodes ADD COLUMN IF NOT EXISTS colour         text;
ALTER TABLE admin_nodes ADD COLUMN IF NOT EXISTS parent_node_id uuid REFERENCES admin_nodes(id);
ALTER TABLE admin_nodes ADD COLUMN IF NOT EXISTS display_name   text;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed sectors
-- company_name = human label  |  etf_ticker = ETF  |  display_name = same as company_name
-- x/y are normalised 0-1 coordinates matching existing hardcoded positions
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, colour, x_position, y_position)
VALUES
  ('sector', 'Technology',             'Technology',             'XLK',  '#3b82f6', 0.3125, 0.3818),
  ('sector', 'Financial Services',     'Financial Services',     'XLF',  '#10b981', 0.7219, 0.6454),
  ('sector', 'Healthcare',             'Healthcare',             'XLV',  '#8b5cf6', 0.2750, 0.6818),
  ('sector', 'Energy',                 'Energy',                 'XLE',  '#f59e0b', 0.6875, 0.3272),
  ('sector', 'Industrials',            'Industrials',            'XLI',  '#6366f1', 0.5000, 0.1500),
  ('sector', 'Consumer Discretionary', 'Consumer Discretionary', 'XLY',  '#ec4899', 0.5000, 0.8500),
  ('sector', 'Communication Services', 'Communication Services', 'XLC',  '#14b8a6', 0.8500, 0.5000),
  ('sector', 'Materials',              'Materials',              'XLB',  '#64748b', 0.1500, 0.5000),
  ('sector', 'Real Estate',            'Real Estate',            'XLRE', '#f97316', 0.2000, 0.8500),
  ('sector', 'Utilities',              'Utilities',              'XLU',  '#84cc16', 0.8000, 0.1500);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed sub-sectors (reference parent by etf_ticker + node_type='sector')
-- ═══════════════════════════════════════════════════════════════════════════════

-- XLK Technology
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Semiconductors',   'Semiconductors',   'SOXX', id, 0.22, 0.28
FROM admin_nodes WHERE etf_ticker = 'XLK' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Software & Cloud', 'Software & Cloud', 'IGV',  id, 0.34, 0.24
FROM admin_nodes WHERE etf_ticker = 'XLK' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'AI Infrastructure','AI Infrastructure', 'BOTZ', id, 0.28, 0.32
FROM admin_nodes WHERE etf_ticker = 'XLK' AND node_type = 'sector';

-- XLF Financial Services
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Fintech & Payments',       'Fintech & Payments',       'FINX', id, 0.66, 0.60
FROM admin_nodes WHERE etf_ticker = 'XLF' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Digital Assets & Brokers', 'Digital Assets & Brokers', 'BITQ', id, 0.74, 0.58
FROM admin_nodes WHERE etf_ticker = 'XLF' AND node_type = 'sector';

-- XLV Healthcare
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Biotech',         'Biotech',         'XBI',  id, 0.22, 0.66
FROM admin_nodes WHERE etf_ticker = 'XLV' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Pharmaceuticals', 'Pharmaceuticals', 'IHE',  id, 0.28, 0.74
FROM admin_nodes WHERE etf_ticker = 'XLV' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Digital Health',  'Digital Health',  'EDOC', id, 0.20, 0.72
FROM admin_nodes WHERE etf_ticker = 'XLV' AND node_type = 'sector';

-- XLE Energy
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Oil & Gas Majors',   'Oil & Gas Majors',   'XOP', id, 0.63, 0.27
FROM admin_nodes WHERE etf_ticker = 'XLE' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Oil Services & E&P', 'Oil Services & E&P', 'OIH', id, 0.70, 0.26
FROM admin_nodes WHERE etf_ticker = 'XLE' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Clean Energy',        'Clean Energy',        NULL,  id, 0.67, 0.23
FROM admin_nodes WHERE etf_ticker = 'XLE' AND node_type = 'sector';

-- XLI Industrials
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Defense & Aerospace', 'Defense & Aerospace', 'ITA', id, 0.44, 0.16
FROM admin_nodes WHERE etf_ticker = 'XLI' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Industrial Machinery','Industrial Machinery', NULL,  id, 0.54, 0.16
FROM admin_nodes WHERE etf_ticker = 'XLI' AND node_type = 'sector';

-- XLY Consumer Discretionary
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Restaurants & Leisure', 'Restaurants & Leisure', NULL, id, 0.44, 0.85
FROM admin_nodes WHERE etf_ticker = 'XLY' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'E-Commerce & Retail',   'E-Commerce & Retail',   NULL, id, 0.54, 0.85
FROM admin_nodes WHERE etf_ticker = 'XLY' AND node_type = 'sector';

-- XLC Communication Services
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Social & Digital Media', 'Social & Digital Media', NULL, id, 0.82, 0.47
FROM admin_nodes WHERE etf_ticker = 'XLC' AND node_type = 'sector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsector', 'Streaming & Content',    'Streaming & Content',    NULL, id, 0.86, 0.53
FROM admin_nodes WHERE etf_ticker = 'XLC' AND node_type = 'sector';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed sub-sub-sectors (reference parent by company_name + node_type='subsector')
-- ═══════════════════════════════════════════════════════════════════════════════

-- Under Semiconductors
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsubsector', 'AI Chips', 'AI Chips', NULL, id, 0.19, 0.25
FROM admin_nodes WHERE company_name = 'Semiconductors' AND node_type = 'subsector';

-- Under Software & Cloud
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsubsector', 'Cybersecurity', 'Cybersecurity', NULL, id, 0.31, 0.20
FROM admin_nodes WHERE company_name = 'Software & Cloud' AND node_type = 'subsector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsubsector', 'AI Software', 'AI Software', NULL, id, 0.37, 0.20
FROM admin_nodes WHERE company_name = 'Software & Cloud' AND node_type = 'subsector';

-- Under Pharmaceuticals
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsubsector', 'GLP-1 & Obesity', 'GLP-1 & Obesity', NULL, id, 0.26, 0.78
FROM admin_nodes WHERE company_name = 'Pharmaceuticals' AND node_type = 'subsector';

-- Under Defense & Aerospace
INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsubsector', 'Space Economy', 'Space Economy', 'UFO',  id, 0.40, 0.13
FROM admin_nodes WHERE company_name = 'Defense & Aerospace' AND node_type = 'subsector';

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, parent_node_id, x_position, y_position)
SELECT 'subsubsector', 'Defense Tech', 'Defense Tech', 'KROP', id, 0.46, 0.12
FROM admin_nodes WHERE company_name = 'Defense & Aerospace' AND node_type = 'subsector';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed hierarchy connections (direct-parent only, is_primary = true)
-- ticker_a = child node canonical identifier
-- ticker_b = parent node canonical identifier
-- Sectors use etf_ticker as identifier; subsectors/subsubsectors use company_name
-- ═══════════════════════════════════════════════════════════════════════════════

-- Subsectors → Sectors
INSERT INTO admin_connections (ticker_a, ticker_b, is_primary) VALUES
  ('Semiconductors',          'XLK',  true),
  ('Software & Cloud',        'XLK',  true),
  ('AI Infrastructure',       'XLK',  true),
  ('Fintech & Payments',      'XLF',  true),
  ('Digital Assets & Brokers','XLF',  true),
  ('Biotech',                 'XLV',  true),
  ('Pharmaceuticals',         'XLV',  true),
  ('Digital Health',          'XLV',  true),
  ('Oil & Gas Majors',        'XLE',  true),
  ('Oil Services & E&P',      'XLE',  true),
  ('Clean Energy',            'XLE',  true),
  ('Defense & Aerospace',     'XLI',  true),
  ('Industrial Machinery',    'XLI',  true),
  ('Restaurants & Leisure',   'XLY',  true),
  ('E-Commerce & Retail',     'XLY',  true),
  ('Social & Digital Media',  'XLC',  true),
  ('Streaming & Content',     'XLC',  true);

-- Sub-sub-sectors → Subsectors
INSERT INTO admin_connections (ticker_a, ticker_b, is_primary) VALUES
  ('AI Chips',         'Semiconductors',     true),
  ('Cybersecurity',    'Software & Cloud',   true),
  ('AI Software',      'Software & Cloud',   true),
  ('GLP-1 & Obesity',  'Pharmaceuticals',    true),
  ('Space Economy',    'Defense & Aerospace',true),
  ('Defense Tech',     'Defense & Aerospace',true);

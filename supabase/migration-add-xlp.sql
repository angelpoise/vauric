-- Add Consumer Staples (XLP) sector node
-- Run in Supabase SQL editor after migration-hierarchy-v1.sql

INSERT INTO admin_nodes (node_type, company_name, display_name, etf_ticker, colour, x_position, y_position)
VALUES ('sector', 'Consumer Staples', 'Consumer Staples', 'XLP', '#f43f5e', 0.40, 0.85)
ON CONFLICT DO NOTHING;

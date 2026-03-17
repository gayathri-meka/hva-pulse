-- Migration 018: Create dedicated read-only Postgres role for the MCP server
--
-- This role (pulse_mcp_ro) can only SELECT from public tables.
-- It has no INSERT, UPDATE, DELETE, or DDL privileges.
-- The SQL validator in mcp/lib/validators.ts is a second layer on top of this.
--
-- AFTER running this migration, set a password and enable login:
--
--   ALTER ROLE pulse_mcp_ro WITH LOGIN PASSWORD 'choose-a-strong-password';
--
-- Then set the following environment variable (in .env.local and anywhere the
-- MCP server runs):
--
--   MCP_DATABASE_URL=postgresql://pulse_mcp_ro:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
--
-- To find your Project Ref: Supabase Dashboard → Settings → General → Reference ID

-- Create the role (no login until you run the ALTER ROLE above)
CREATE ROLE pulse_mcp_ro;

-- Allow the role to connect to the database
GRANT CONNECT ON DATABASE postgres TO pulse_mcp_ro;

-- Allow the role to see objects in the public schema
GRANT USAGE ON SCHEMA public TO pulse_mcp_ro;

-- SELECT on all tables that exist right now
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pulse_mcp_ro;

-- SELECT on any tables created in the future
-- Note: this default privilege applies to tables created by the current role
-- (typically postgres/authenticated). If tables are ever created by a different
-- role you will need to re-run the GRANT SELECT ON ALL TABLES line.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO pulse_mcp_ro;

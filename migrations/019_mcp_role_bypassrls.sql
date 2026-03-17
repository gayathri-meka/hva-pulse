-- Migration 019: Grant BYPASSRLS to the MCP read-only role
--
-- pulse_mcp_ro is an internal admin role used by the MCP server.
-- RLS policies are designed for multi-tenant learner-facing access
-- (e.g. a learner seeing only their own applications). They should not
-- apply to internal tooling that already has SELECT-only enforcement
-- at the role level + SQL validator layer.
--
-- BYPASSRLS is safe here because:
--   1. pulse_mcp_ro can only SELECT — no writes possible at the DB level
--   2. The SQL validator (mcp/lib/validators.ts) is an additional layer
--   3. This role is only used by the MCP server, not exposed to end users

ALTER ROLE pulse_mcp_ro BYPASSRLS;

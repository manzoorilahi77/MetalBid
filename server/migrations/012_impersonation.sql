-- ---------------------------------------------------------------------------
-- "Log in as" — a Sub/Super Admin opening another account's session directly,
-- without their password, to answer a support question or check what a role
-- actually sees. `sessions` already records how every session came to exist
-- (issued_at, ip, user_agent); this adds the other way one can start: minted
-- by staff rather than typed in by the owner. NULL for every ordinary sign-in.
-- ---------------------------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN impersonated_by VARCHAR(64) NULL AFTER user_id,
  ADD KEY idx_sessions_impersonated_by (impersonated_by);

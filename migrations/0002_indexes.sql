-- Performance indexes — added after a query-path audit of the app's database.
--
-- WHY (validation): the app is local-first, so the only tables in this database
-- are the Better Auth identity tables (migrations/auth/0001_auth.sql), used
-- when the app is deployed with DATABASE_URL (Neon) and sign-in enabled.
-- Audit of the query paths:
--   * "session" is queried by: token (already UNIQUE → indexed), id (PK) and
--     "userId" (already indexed by 0001: session_userId_idx).
--   * "account" is queried by: id (PK), "userId" (already indexed by 0001).
--   * "verification" is queried by: identifier (indexed by 0001) and by
--     "expiresAt" — Better Auth's periodic cleanup deletes expired
--     verifications/sessions with `WHERE "expiresAt" < now()`. On Neon that is
--     a full table scan today.
--   * "session"."expiresAt" is also read by expiry checks on every validated
--     request (Better Auth compares the stored value after fetching by token,
--     so this index mainly serves cleanup + any admin/expiry sweeps).
-- Conclusion: the missing, genuinely useful indexes are the expiry columns.
-- The join/lookup columns are already covered — adding more would only add
-- write cost. `create index if not exists` + table guards keep this migration
-- safe on both backends, including the PGLite preview where the auth schema is
-- opt-in and these tables may not exist.

do $$
begin
  if to_regclass('"session"') is not null then
    create index if not exists "session_expiresAt_idx" on "session" ("expiresAt");
  end if;

  if to_regclass('"verification"') is not null then
    create index if not exists "verification_expiresAt_idx" on "verification" ("expiresAt");
  end if;
end
$$;

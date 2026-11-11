-- Imitación mínima de Supabase para probar localmente (no se sube a Supabase).
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator noinherit login password 'authpass'; end if;
end $$;
grant anon, authenticated to authenticator;
create schema auth;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text unique, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text,
  email_change_token_current text, phone_change text, phone_change_token text, reauthentication_token text
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users (id) on delete cascade, identity_data jsonb,
  provider text, provider_id text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  unique (provider_id, provider)
);
-- PostgREST publica los claims como JSON en request.jwt.claims
create function auth.uid() returns uuid language sql stable
as $$ select coalesce(
  nullif(current_setting('request.jwt.claim.sub', true), ''),
  nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

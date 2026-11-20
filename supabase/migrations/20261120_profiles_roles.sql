-- 구글 로그인 회원 · 등급 (2026-11-20)
-- Supabase → SQL Editor 에 이 파일을 통째로 붙여 넣고 Run (한 번). 다시 돌려도 같은 결과 (if not exists · or replace · drop if exists).
--
-- 회원 = auth.users (Supabase 가 관리) 옆에 public.profiles 한 줄씩. 등급(role) = 'user' | 'admin'.
-- 새로 로그인한 구글 계정은 자동으로 'user'. 'admin' 은 내계좌 · 관심종목 · 관리 화면 (사이트 lib/viewer.ts 가 확인).
--
-- 첫 관리자는 이 파일이 아니라 SQL Editor 에서 직접 (공개 repo 라 이메일을 여기 적지 않는다):
--   update public.profiles set role = 'admin' where email = '<본인 구글 이메일>';
-- 그 뒤로는 사이트 관리 › 회원 탭에서 바꾼다.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

alter table public.profiles enable row level security;

-- 관리자인가 — 정책 안에서 profiles 를 그냥 읽으면 그 읽기에 정책이 또 걸려 끝없이 돈다.
-- security definer(만든 사람 권한)로 정책을 건너뛰고 읽는다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- 권한 — 방문자(anon)는 아무것도 못 한다. 로그인한 사람은 읽기 + role 칸 수정만 (아래 정책이 누구 줄인지 다시 거른다).
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (role) on table public.profiles to authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles: admins read all" on public.profiles;
create policy "profiles: admins read all" on public.profiles
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "profiles: admins update" on public.profiles;
create policy "profiles: admins update" on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 새 가입 → profiles 한 줄 (등급 user). 구글은 이름을 full_name / name, 사진을 avatar_url / picture 로 준다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, last_sign_in_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.last_sign_in_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 로그인할 때마다 이메일 · 이름 · 사진 · 마지막 로그인 갱신 (구글 쪽에서 바꿨을 수도 있어서)
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set
    email = new.email,
    full_name = coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', full_name),
    avatar_url = coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', avatar_url),
    last_sign_in_at = new.last_sign_in_at
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data, last_sign_in_at on auth.users
  for each row execute function public.handle_user_updated();

-- 마지막 관리자는 강등 못 한다 — 관리자가 0명이 되면 사이트에서 다시 올릴 사람이 없다 (SQL Editor 로만 복구).
-- 두 관리자가 동시에 서로를 내리는 경우도 막으려고 확인 전에 잠근다.
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and new.role is distinct from 'admin' then
    perform pg_advisory_xact_lock(hashtext('public.profiles.keep_one_admin'));
    if not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
      raise exception 'last admin cannot be demoted' using errcode = 'P0001', hint = 'LAST_ADMIN';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_one_admin on public.profiles;
create trigger keep_one_admin
  before update of role on public.profiles
  for each row execute function public.keep_one_admin();

-- 깨우기 — Supabase 무료 프로젝트는 1주일 동안 DB 활동이 없으면 멈춘다 (멈추면 로그인이 안 된다).
-- 사이트 /api/keepalive (Vercel 크론, 하루 한 번) 가 이걸 부른다.
create or replace function public.ping()
returns integer
language sql
stable
as $$
  select 1;
$$;

grant execute on function public.ping() to anon, authenticated;

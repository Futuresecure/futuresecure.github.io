-- Additive integration; existing appointment rows and RLS policies are preserved.
create table public.google_calendar_connection (
 id boolean primary key default true check(id),
 owner_id uuid not null,
 refresh_encrypted text not null,
 scope text not null,
 status text not null default 'connected',
 connected_at timestamptz not null default now()
);
create table public.google_calendar_oauth_states (
 state_hash text primary key,
 owner_id uuid not null,
 verifier_encrypted text not null,
 expires_at timestamptz not null
);
create table public.google_calendar_jobs (
 appointment_id bigint primary key references public.appointments(id) on delete cascade,
 revision bigint not null default 1,
 status text not null default 'pending',
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 locked_until timestamptz,
 lease_id uuid,
 last_error text,
 synced_at timestamptz
);
alter table public.google_calendar_connection enable row level security;
alter table public.google_calendar_oauth_states enable row level security;
alter table public.google_calendar_jobs enable row level security;
revoke all on public.google_calendar_connection, public.google_calendar_oauth_states, public.google_calendar_jobs from public,anon,authenticated;
grant all on public.google_calendar_connection, public.google_calendar_oauth_states, public.google_calendar_jobs to service_role;
alter table public.appointments add column google_calendar_id text;

create or replace function private.queue_google_calendar_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if nullif(new.google_calendar_event_id,'') is null then return new; end if;
 if tg_op = 'UPDATE' then
  if new.appointment_date is not distinct from old.appointment_date
   and new.appointment_time is not distinct from old.appointment_time
   and new.google_calendar_event_id is not distinct from old.google_calendar_event_id
   and new.google_calendar_id is not distinct from old.google_calendar_id then return new; end if;
 end if;
 insert into public.google_calendar_jobs(appointment_id) values(new.id)
 on conflict(appointment_id) do update set revision=public.google_calendar_jobs.revision+1,
 status='pending',attempts=0,available_at=now(),last_error=null;
 return new;
end; $$;
revoke all on function private.queue_google_calendar_update() from public,anon,authenticated;
create trigger queue_google_calendar_update after insert or update on public.appointments
for each row execute function private.queue_google_calendar_update();

create function public.fsp_calendar_claim() returns setof public.google_calendar_jobs
language sql security invoker set search_path = '' as $$
 update public.google_calendar_jobs j set locked_until=now()+interval '90 seconds',lease_id=gen_random_uuid(),attempts=attempts+1
 where appointment_id in (
  select appointment_id from public.google_calendar_jobs where status='pending' and available_at<=now()
   and (locked_until is null or locked_until<now()) order by available_at for update skip locked limit 1
 ) returning j.*;
$$;
create function public.fsp_calendar_enqueue_all() returns void
language sql security invoker set search_path = '' as $$
 insert into public.google_calendar_jobs(appointment_id)
 select id from public.appointments where nullif(google_calendar_event_id,'') is not null
 on conflict(appointment_id) do update set revision=public.google_calendar_jobs.revision+1,status='pending',attempts=0,available_at=now(),last_error=null;
$$;
-- The worker credential stays inside Vault; only service_role can fetch it.
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'fsp_google_calendar_worker');
create function public.fsp_calendar_worker_credential() returns text
language sql security definer set search_path = '' as $$
 select decrypted_secret from vault.decrypted_secrets where name='fsp_google_calendar_worker';
$$;
revoke all on function public.fsp_calendar_claim(),public.fsp_calendar_enqueue_all(),public.fsp_calendar_worker_credential() from public,anon,authenticated;
grant execute on function public.fsp_calendar_claim(),public.fsp_calendar_enqueue_all(),public.fsp_calendar_worker_credential() to service_role;

create function private.invoke_google_calendar_worker() returns void
language plpgsql security definer set search_path = '' as $$
begin
 delete from public.google_calendar_oauth_states where expires_at<now();
 if exists(select 1 from public.google_calendar_connection where status='connected')
 and exists(select 1 from public.google_calendar_jobs where status='pending' and available_at<=now() and (locked_until is null or locked_until<now())) then
 perform net.http_post(
 url:='https://cjwxirpwzluynymwjzxl.supabase.co/functions/v1/google-calendar-oauth/worker',
 headers:=jsonb_build_object('Content-Type','application/json','x-calendar-worker-secret',
 (select decrypted_secret from vault.decrypted_secrets where name='fsp_google_calendar_worker')),
 body:='{}'::jsonb,timeout_milliseconds:=60000);
 end if;
end; $$;
revoke all on function private.invoke_google_calendar_worker() from public,anon,authenticated;
select cron.schedule('fsp-google-calendar-sync','* * * * *','select private.invoke_google_calendar_worker()');

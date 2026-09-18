-- 0003 — the group chat. One thread per plan, and nowhere else to write.
--
-- There is no conversations table and no direct-message table on purpose: the
-- plan is the conversation. 01-PRD is explicit that chat exists only inside a
-- plan you joined, that there is no way to message a stranger, and that this is
-- a product decision rather than a limitation. The place that decision is
-- actually enforced is the read policy below.

create table messages (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  is_pinned  boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_plan_idx on messages (plan_id, created_at desc);

-- One pin per plan. The host pins the meeting point; a second pin would mean
-- two answers to "where exactly are we meeting".
create unique index messages_one_pin_per_plan on messages (plan_id) where is_pinned;

-- Who has read up to where. A separate table rather than a column on
-- plan_participants because the host has no participant row — join_plan()
-- refuses the host of a plan — and a host locked out of their own unread count
-- is the kind of special case that turns into a bug later.
create table chat_reads (
  user_id      uuid not null references profiles on delete cascade,
  plan_id      uuid not null references plans on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

-- ── who may use a chat, and until when ──────────────────────────────────────

-- Participants and the host. Anyone who left, was removed, or was never in it
-- is not on this list, and neither is anyone else on the platform.
create function can_use_chat(p_plan uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from plans where id = p_plan and host_id = auth.uid())
    or exists (
      select 1 from plan_participants
       where plan_id = p_plan and user_id = auth.uid()
         and status in ('joined','attended')
    )
  );
$$;

-- 01-PRD: the chat closes 48h after the plan ends. It stays readable — the
-- meeting point and what people agreed are worth keeping — but nobody can
-- write to a conversation whose plan happened two days ago.
create function chat_closes_at(p_plan uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select starts_at + make_interval(mins => duration_min) + interval '48 hours'
    from plans where id = p_plan;
$$;

create function chat_is_open(p_plan uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(chat_closes_at(p_plan) > now(), false);
$$;

grant execute on function can_use_chat(uuid), chat_closes_at(uuid), chat_is_open(uuid)
  to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table messages    enable row level security;
alter table chat_reads  enable row level security;

-- The whole no-cold-DMs promise, in one predicate — plus blocks, which apply
-- here for the same reason they apply to the roster: "you will not see each
-- other" has to mean the chat too, or blocking someone you share a plan with
-- achieves nothing. Whether a block should eject one of them from the plan
-- outright is an M4 question; this is the floor.
create policy messages_read on messages for select to authenticated
  using (
    can_use_chat(plan_id)
    and (user_id = (select auth.uid()) or not is_blocked((select auth.uid()), user_id))
  );

create policy messages_insert_own on messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and can_use_chat(plan_id)
    and chat_is_open(plan_id)
  );

-- No edits: a message someone acted on must not change under them. Deleting
-- your own within five minutes covers the wrong-chat and autocorrect cases.
create policy messages_delete_own on messages for delete to authenticated
  using (user_id = (select auth.uid()) and created_at > now() - interval '5 minutes');

create policy chat_reads_own on chat_reads for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── pinning ─────────────────────────────────────────────────────────────────
-- Host only, and through this function only: there is deliberately no UPDATE
-- policy on messages, so is_pinned cannot be flipped by the message's author.
create function pin_message(p_message uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_plan uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select plan_id into v_plan from messages where id = p_message;
  if v_plan is null then raise exception 'message_not_found' using errcode = 'P0002'; end if;
  if not exists (select 1 from plans where id = v_plan and host_id = auth.uid()) then
    raise exception 'not_host' using errcode = '42501';
  end if;

  update messages set is_pinned = false where plan_id = v_plan and is_pinned;
  update messages set is_pinned = true  where id = p_message;
end;
$$;

create function unpin_message(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from plans where id = p_plan and host_id = auth.uid()) then
    raise exception 'not_host' using errcode = '42501';
  end if;
  update messages set is_pinned = false where plan_id = p_plan and is_pinned;
end;
$$;

revoke all on function pin_message(uuid), unpin_message(uuid) from public;
grant execute on function pin_message(uuid), unpin_message(uuid) to authenticated;

-- ── unread ──────────────────────────────────────────────────────────────────
create function mark_chat_read(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_use_chat(p_plan) then raise exception 'not_in_plan' using errcode = '42501'; end if;
  insert into chat_reads (user_id, plan_id, last_read_at)
       values (auth.uid(), p_plan, now())
  on conflict (user_id, plan_id) do update set last_read_at = now();
end;
$$;

-- Unread counts for every chat the caller can use, hosted and joined alike.
-- Your own messages never count as unread.
create function my_unread_counts()
  returns table (plan_id uuid, unread int)
language sql stable security definer set search_path = public as $$
  with mine as (
    select id as plan_id from plans where host_id = auth.uid()
    union
    select pp.plan_id from plan_participants pp
     where pp.user_id = auth.uid() and pp.status in ('joined','attended')
  )
  select m.plan_id,
         count(msg.id) filter (
           where msg.user_id <> auth.uid()
             and msg.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
         )::int as unread
    from mine m
    left join messages msg on msg.plan_id = m.plan_id
    left join chat_reads r on r.plan_id = m.plan_id and r.user_id = auth.uid()
   group by m.plan_id;
$$;

revoke all on function mark_chat_read(uuid), my_unread_counts() from public;
grant execute on function mark_chat_read(uuid), my_unread_counts() to authenticated;

-- ── realtime ────────────────────────────────────────────────────────────────
-- Supabase filters Realtime through the same RLS policies, so a non-participant
-- receives nothing rather than receiving it and being asked not to look.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

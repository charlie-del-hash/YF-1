-- 0007 — the rights, exercisable in the app rather than by email.
--
-- 05-RGPD §5: download my data, delete my account, and a decision recorded in
-- advance about what happens to a group conversation when someone leaves it.

/*
 * A deleted host leaves their plans behind, cancelled.
 *
 * `plans.host_id` cascaded, so deleting an account deleted every plan that
 * account had ever hosted — and with them the participations, the roster and
 * the whole conversation, for everyone else who had been there. That is the
 * opposite of what deletion should do to other people's records. Same shape as
 * the decision about messages in 0005: the thing survives, the person does not.
 */
alter table plans alter column host_id drop not null;
alter table plans drop constraint plans_host_id_fkey;
alter table plans add constraint plans_host_id_fkey
  foreign key (host_id) references profiles on delete set null;

/*
 * Everything this product holds about the caller, as one JSON document.
 *
 * Deliberately built from the caller's own id rather than from RLS-filtered
 * reads: an export that silently omitted a row because a policy hid it would be
 * an export that is wrong in exactly the way an export must not be.
 */
create function export_my_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_out jsonb;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select jsonb_build_object(
    'exportado_el', now(),
    'perfil', (select to_jsonb(p) - 'is_admin' from profiles p where p.id = v_user),
    'deportes', (select coalesce(jsonb_agg(to_jsonb(s) - 'user_id'), '[]'::jsonb)
                   from user_sports s where s.user_id = v_user),
    'planes_que_organizo', (select coalesce(jsonb_agg(to_jsonb(pl)), '[]'::jsonb)
                              from plans pl where pl.host_id = v_user),
    'planes_a_los_que_me_apunte', (select coalesce(jsonb_agg(to_jsonb(pp)), '[]'::jsonb)
                                     from plan_participants pp where pp.user_id = v_user),
    'mensajes', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
                   from messages m where m.user_id = v_user),
    'asistencia', (select coalesce(jsonb_agg(to_jsonb(r) - 'user_id'), '[]'::jsonb)
                     from reliability_events r where r.user_id = v_user),
    'bloqueos', (select coalesce(jsonb_agg(jsonb_build_object('created_at', b.created_at)), '[]'::jsonb)
                   from blocks b where b.blocker_id = v_user),
    'reportes_enviados', (select coalesce(jsonb_agg(to_jsonb(rep) - 'reporter_id'), '[]'::jsonb)
                            from reports rep where rep.reporter_id = v_user),
    'verificaciones', (select coalesce(jsonb_agg(jsonb_build_object(
                              'kind', v.kind, 'status', v.status, 'submitted_at', v.submitted_at)), '[]'::jsonb)
                         from verifications v where v.user_id = v_user),
    'swipes', (select count(*) from swipes s where s.user_id = v_user)
  ) into v_out;

  return v_out;
end;
$$;
revoke all on function export_my_data() from public;
grant execute on function export_my_data() to authenticated;

/*
 * Deletion that deletes.
 *
 * Removing the auth row cascades to the profile and from there to sports,
 * swipes, participations, blocks, reliability history and verifications —
 * reliability history included, because 05-RGPD says it is theirs. Messages are
 * the documented exception: `messages.user_id` was made nullable in 0005 so the
 * words stay and the author does not, because tearing a participant's half out
 * of a conversation leaves the other people in it unable to follow what was
 * agreed. The policy has to say this, and it does.
 *
 * Plans someone hosted are cancelled rather than deleted, so that everyone who
 * had committed to being somewhere finds out rather than watching the plan
 * silently disappear.
 */
create function delete_my_account(p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  update plans
     set status = 'cancelled',
         cancelled_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''),
                                     'La persona que lo organizaba ha dado de baja su cuenta.')
   where host_id = v_user and starts_at > now() and status <> 'cancelled';

  -- Selfies are unlinked here; the object itself is removed by the server
  -- action, which is the only place with a storage client.
  update verifications set selfie_path = null where user_id = v_user;

  delete from auth.users where id = v_user;
end;
$$;
revoke all on function delete_my_account(text) from public;
grant execute on function delete_my_account(text) to authenticated;

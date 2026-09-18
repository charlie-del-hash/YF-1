-- 0016 — a delivered notification stamps the subscription it reached.
--
-- 0011 added `last_ok_at`: "bumped on every successful send, so a subscription
-- that has been dead for months is identifiable without asking the push
-- service". sendPush() bumped it with a plain UPDATE as the sender — and
-- push_own_update lets a person update only their own rows, so for every
-- notification that went to somebody else the statement matched nothing and
-- said nothing. The only rows ever stamped were the sender's own, by the test
-- notification.
--
-- Same shape as forget_push_endpoint(), for the same reason: the sender is the
-- only code that learns the outcome and is not the owner of the row. Scoped to
-- endpoints the caller was just handed by push_targets_for_plan() or
-- notify_promotion(); an endpoint is an unguessable URL, and the worst a
-- guessed one could do here is look recently alive.
create function touch_push_endpoints(p_endpoints text[]) returns void
language sql security definer set search_path = public as $$
  update push_subscriptions
     set last_ok_at = now()
   where endpoint = any (p_endpoints)
     and auth.uid() is not null;
$$;

-- Postgres hands EXECUTE on a new function to PUBLIC. See 0009.
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
grant  execute on function public_plan_preview(uuid) to anon;
grant  execute on function has_verified_selfie(uuid) to anon;

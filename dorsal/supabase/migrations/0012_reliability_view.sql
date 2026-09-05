-- 0012 — the reliability view was readable by anyone.
--
-- `user_reliability` aggregates reliability_events into per-person counts:
-- attendances, commitments, hosted plans, faltas in the last thirty days, and
-- disputes. It exists so that public_palabra() can turn that into the three
-- sanitised numbers decision 30 allows anybody to see.
--
-- It was created without `security_invoker`, which means it ran with its
-- owner's rights and ignored the row-level security on the tables underneath.
-- Combined with Supabase's default grant of SELECT on new tables and views to
-- `anon`, that made the whole thing readable over /rest/v1/user_reliability
-- with nothing but the publishable key: every account in the system, with its
-- no-show count, its faltas in the last thirty days and its disputes.
--
-- That is the exact thing this product promises it will never do. 01-PRD and
-- decision 30: Palabra "by construction cannot produce a rank, a badge, a
-- colour or a comparison". Here was the raw material for all four, one HTTP
-- request away, and the disputes column is the one 05-RGPD treats as a
-- moderation record rather than a public fact.
--
-- Two changes, either of which would have been enough, because this is the
-- second time a default grant has decided something nobody chose (see 0009).

-- The view now runs as whoever queries it, so the policies on `profiles` and
-- `reliability_events` apply through it. Inside public_palabra(), which is
-- security definer, that is still the function's owner — so the sanctioned
-- path is unaffected.
alter view user_reliability set (security_invoker = on);

-- And nothing may read it directly at all. Every legitimate reader is a
-- security definer function; there is no code path in the app that selects
-- this view, and there should never be one.
revoke all on user_reliability from anon, authenticated;

-- ── search_path, pinned ─────────────────────────────────────────────────────
-- All six run as the invoker, so this is hardening rather than a hole: it stops
-- an unqualified name resolving somewhere unexpected if the search_path is ever
-- manipulated. Two of them are triggers that fire on every write.
alter function enforce_adult()                           set search_path = public;
alter function forbid_uncancel()                         set search_path = public;
alter function late_cancel_threshold()                   set search_path = public;
alter function newcomer_reserved(int, int)               set search_path = public;
alter function stamp_promotion()                         set search_path = public;
alter function sync_plan_counts()                        set search_path = public;

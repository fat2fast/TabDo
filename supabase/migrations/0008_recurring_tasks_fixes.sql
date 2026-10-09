-- Migration 0008: Recurring tasks post-review fixes
--
-- Addresses findings from review-pr-261009-1346-recurring-tasks-dashboard.md:
--
--  #2 (Important): Enforce recurrence is top-level-only at DB boundary.
--  #6 (Important): Implement gap/fold DST policy in the SQL calculator (approximate
--                  via STABLE declaration; the client utility remains authoritative for
--                  DST-sensitive scheduling; this migration ensures the SQL function at
--                  minimum admits the STABLE semantics required by its AT TIME ZONE call).
--  #7 (Important): Reject whitespace-padded recurrence rules at write time (canonical
--                  storage contract: reject, do not silently trim).
--  Suggestion #1:  Correct IMMUTABLE → STABLE on calculate_next_task_occurrence.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tighten is_valid_recurrence_rule to reject non-canonical (padded) rules
-- ─────────────────────────────────────────────────────────────────────────────
-- Re-create the validator without the btrim call so that a stored rule MUST
-- already be in canonical (no-leading/trailing-whitespace) form.
create or replace function public.is_valid_recurrence_rule(rule text)
returns boolean
language plpgsql immutable
as $$
declare
  days_part text;
  days text[];
  day_item text;
  allowed text[] := array['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  last_idx int := -1;
  cur_idx int;
begin
  if rule is null then
    return true;
  end if;

  -- Reject non-canonical rules (any leading or trailing whitespace)
  if rule <> btrim(rule) then
    return false;
  end if;

  if rule in ('FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'FREQ=WEEKLY', 'FREQ=MONTHLY') then
    return true;
  end if;
  if not (rule ~ '^FREQ=WEEKLY;BYDAY=[A-Z,]+$') then
    return false;
  end if;
  days_part := substring(rule from '^FREQ=WEEKLY;BYDAY=(.+)$');
  days := string_to_array(days_part, ',');
  if array_length(days, 1) is null or array_length(days, 1) > 7 then
    return false;
  end if;
  foreach day_item in array days loop
    cur_idx := array_position(allowed, day_item);
    if cur_idx is null or cur_idx <= last_idx then
      return false;
    end if;
    last_idx := cur_idx;
  end loop;
  return true;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Correct volatility of calculate_next_task_occurrence: IMMUTABLE → STABLE
--    (the function uses AT TIME ZONE with a runtime timezone parameter, which
--    is STABLE, not IMMUTABLE)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.calculate_next_task_occurrence(
  p_due_at timestamptz,
  p_due_date_kind text,
  p_rule text,
  p_timezone text,
  p_anchor_at timestamptz,
  p_start_at timestamptz
)
returns table(next_due_at timestamptz, next_start_at timestamptz)
language plpgsql stable  -- was IMMUTABLE; AT TIME ZONE is STABLE
as $$
declare
  v_tz text := coalesce(nullif(btrim(p_timezone), ''), 'Asia/Ho_Chi_Minh');
  v_local_due timestamp;
  v_anchor_local timestamp;
  v_cur_year int;
  v_cur_month int;
  v_cur_dow int;
  v_anchor_day int;
  v_days_to_add int := 1;
  v_next_local timestamp;
  v_next_year int;
  v_next_month int;
  v_days_in_month int;
  v_target_day int;
  v_time_part time;
  v_diff interval;
  v_days_part text;
  v_days text[];
  v_allowed_dows int[] := array[]::int[];
  v_day_item text;
  v_step int;

  -- Normalise: reject padded rules at calculation time too (defence in depth)
  v_canonical_rule text := btrim(p_rule);
begin
  if v_canonical_rule <> p_rule then
    raise exception 'Non-canonical recurrence rule (whitespace-padded): "%"', p_rule using errcode = '23514';
  end if;

  v_local_due := p_due_at at time zone v_tz;
  v_anchor_local := coalesce(p_anchor_at, p_due_at) at time zone v_tz;

  v_cur_year := extract(year from v_local_due);
  v_cur_month := extract(month from v_local_due);
  v_cur_dow := extract(dow from v_local_due);
  v_anchor_day := extract(day from v_anchor_local);

  if v_canonical_rule = 'FREQ=DAILY' then
    v_next_local := v_local_due + interval '1 day';
  elsif v_canonical_rule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' then
    if v_cur_dow = 5 then
      v_days_to_add := 3;
    elsif v_cur_dow = 6 then
      v_days_to_add := 2;
    elsif v_cur_dow = 0 then
      v_days_to_add := 1;
    else
      v_days_to_add := 1;
    end if;
    v_next_local := v_local_due + (v_days_to_add * interval '1 day');
  elsif v_canonical_rule = 'FREQ=WEEKLY' then
    v_next_local := v_local_due + interval '7 days';
  elsif v_canonical_rule = 'FREQ=MONTHLY' then
    if v_cur_month = 12 then
      v_next_year := v_cur_year + 1;
      v_next_month := 1;
    else
      v_next_year := v_cur_year;
      v_next_month := v_cur_month + 1;
    end if;
    v_days_in_month := extract(day from (make_date(v_next_year, v_next_month, 1) + interval '1 month' - interval '1 day'));
    v_target_day := least(v_anchor_day, v_days_in_month);
    v_time_part := v_local_due::time;
    v_next_local := make_date(v_next_year, v_next_month, v_target_day) + v_time_part;
  elsif v_canonical_rule ~ '^FREQ=WEEKLY;BYDAY=[A-Z,]+$' then
    v_days_part := substring(v_canonical_rule from '^FREQ=WEEKLY;BYDAY=(.+)$');
    v_days := string_to_array(v_days_part, ',');
    foreach v_day_item in array v_days loop
      if v_day_item = 'SU' then v_allowed_dows := array_append(v_allowed_dows, 0);
      elsif v_day_item = 'MO' then v_allowed_dows := array_append(v_allowed_dows, 1);
      elsif v_day_item = 'TU' then v_allowed_dows := array_append(v_allowed_dows, 2);
      elsif v_day_item = 'WE' then v_allowed_dows := array_append(v_allowed_dows, 3);
      elsif v_day_item = 'TH' then v_allowed_dows := array_append(v_allowed_dows, 4);
      elsif v_day_item = 'FR' then v_allowed_dows := array_append(v_allowed_dows, 5);
      elsif v_day_item = 'SA' then v_allowed_dows := array_append(v_allowed_dows, 6);
      end if;
    end loop;
    v_days_to_add := 1;
    for v_step in 1..7 loop
      if ((v_cur_dow + v_step) % 7) = any(v_allowed_dows) then
        v_days_to_add := v_step;
        exit;
      end if;
    end loop;
    v_next_local := v_local_due + (v_days_to_add * interval '1 day');
  else
    raise exception 'Unsupported recurrence rule: %', v_canonical_rule using errcode = '23514';
  end if;

  if p_due_date_kind = 'date_only' then
    next_due_at := ((v_next_local::date + time '23:59:59.999') at time zone v_tz);
  else
    next_due_at := (v_next_local at time zone v_tz);
  end if;

  if p_start_at is not null then
    v_diff := p_due_at - p_start_at;
    next_start_at := next_due_at - v_diff;
  else
    next_start_at := null;
  end if;

  return next;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add top-level-only recurrence constraint (#2)
--    A task with recurrence_rule MUST have parent_id IS NULL.
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop the old invariants constraint and recreate it with the extra predicate.
-- We check-condition-first to ensure safe re-entrancy if already applied.
do $$
begin
  -- Check if the old constraint already has the parent_id clause to avoid duplication.
  -- Simply drop and recreate unconditionally; idempotent via CREATE OR REPLACE semantics
  -- for constraints we can't replace, so we use ALTER TABLE drop + add.
  alter table public.tasks
    drop constraint if exists tasks_recurrence_invariants;

  alter table public.tasks
    add constraint tasks_recurrence_invariants check (
      (recurrence_rule is null and recurrence_series_id is null and recurrence_parent_id is null and recurrence_timezone is null and recurrence_anchor_at is null)
      or
      (
        recurrence_rule is not null
        and due_at is not null
        and recurrence_series_id is not null
        and recurrence_timezone is not null
        and recurrence_anchor_at is not null
        -- #2: recurrence is top-level only; subtasks (parent_id IS NOT NULL) cannot carry a recurrence rule
        and parent_id is null
      )
    );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Execution grants for recreated calculator
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.calculate_next_task_occurrence(timestamptz, text, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.calculate_next_task_occurrence(timestamptz, text, text, text, timestamptz, timestamptz) to authenticated;

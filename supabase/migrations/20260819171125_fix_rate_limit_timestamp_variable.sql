-- Repair the distributed rate limiter on databases where
-- 20260819150915_security_age_assurance.sql has already run.
-- `current_time` is a PostgreSQL SQL keyword that evaluates to timetz;
-- use an unambiguous PL/pgSQL variable for timestamptz arithmetic.

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_record private.rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if char_length(p_key) < 16 or char_length(p_key) > 160
    or p_limit < 1 or p_limit > 10000
    or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into private.rate_limits(rate_key, request_count, window_started_at, expires_at)
  values (p_key, 1, v_now, v_now + make_interval(secs => p_window_seconds))
  on conflict (rate_key) do update
  set request_count = case
        when private.rate_limits.expires_at <= v_now then 1
        else private.rate_limits.request_count + 1
      end,
      window_started_at = case
        when private.rate_limits.expires_at <= v_now then v_now
        else private.rate_limits.window_started_at
      end,
      expires_at = case
        when private.rate_limits.expires_at <= v_now then v_now + make_interval(secs => p_window_seconds)
        else private.rate_limits.expires_at
      end
  returning * into current_record;

  delete from private.rate_limits
  where rate_key in (
    select rate_key from private.rate_limits
    where expires_at < v_now - interval '1 day'
    limit 100
  );

  return query select
    current_record.request_count <= p_limit,
    greatest(0, p_limit - current_record.request_count),
    current_record.expires_at;
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer)
from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
to service_role;

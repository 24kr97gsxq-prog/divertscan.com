-- ============================================================
-- DIVERTSCAN MONTHLY HEALTH CHECK
-- Every problem class found during the Aug 24 2026 true-up.
-- ALL READ-ONLY. Run one block at a time; a clean month returns
-- 0 rows for everything except #9.
-- Change the two dates in #0 to the month you're checking.
-- ============================================================

-- #0 — set your window here, then paste these dates into the blocks below.
--     from 2026-08-01   to 2026-08-31


-- #1 — DUPLICATE LOADS: scale-app capture with no paper partner.
-- Each row is either an unbilled load or a paper ticket not yet scanned.
select t.ticket_number, t.ticket_date,
       to_char(t.captured_at at time zone 'America/Chicago','MM/DD HH12:MI AM') as captured,
       p.name as project, t.driver_name, t.zone, t.gross_lbs, t.net_tons
  from tickets t
  left join projects p on p.id = t.project_id
 where t.ticket_number like 'DX-%'
   and t.capture_ticket_number is null
   and t.ticket_date between '2026-08-01' and '2026-08-31'
 order by t.ticket_date, t.captured_at;


-- #2 — SAME LOAD TWICE: paper + capture within 300 lbs on the same day.
-- These should have been merged. Paper number wins.
select a.ticket_number as paper, b.ticket_number as capture,
       a.ticket_date, a.driver_name, b.driver_name as capture_driver,
       a.gross_lbs as paper_gross, b.gross_lbs as capture_gross,
       (b.gross_lbs - a.gross_lbs) as diff_lbs, a.net_tons
  from tickets a
  join tickets b
    on b.project_id = a.project_id
   and b.ticket_number like 'DX-%'
   and a.ticket_number not like 'DX-%'
   and abs(b.gross_lbs - a.gross_lbs) <= 300
   and abs(b.ticket_date - a.ticket_date) <= 1
 where a.ticket_date between '2026-08-01' and '2026-08-31'
 order by a.ticket_date;


-- #3 — BROKEN WEIGHTS: zero, missing, or gross <= tare.
select t.ticket_number, t.ticket_date, p.name as project,
       t.gross_lbs, t.tare_lbs, t.net_lbs, t.net_tons
  from tickets t
  left join projects p on p.id = t.project_id
 where t.ticket_date between '2026-08-01' and '2026-08-31'
   and (coalesce(t.gross_lbs,0) = 0 or coalesce(t.tare_lbs,0) = 0
        or t.gross_lbs <= t.tare_lbs)
 order by t.ticket_date;


-- #4 — SUSPECT DATES: future-dated, or a scale capture whose date
-- doesn't match its capture time in Central (the old UTC bug).
select t.ticket_number, t.ticket_date, t.captured_at, t.scan_type, t.net_tons,
       case when t.ticket_date > current_date then 'FUTURE DATE'
            else 'DATE <> CAPTURE TIME' end as problem
  from tickets t
 where t.ticket_date > current_date
    or (t.captured_at is not null
        and t.ticket_date <> (t.captured_at at time zone 'America/Chicago')::date)
 order by t.ticket_date;


-- #5 — OCR DATES WORTH A SECOND LOOK: a batch-scanned ticket whose date
-- is more than 3 days from its neighbours in ticket-number order.
-- Catches "8/3 read as 8/13" and "8/20 read as 8/26".
with seq as (
  select ticket_number, ticket_date, scan_type, net_tons, project_id,
         lag(ticket_date)  over (order by ticket_number) as prev_date,
         lead(ticket_date) over (order by ticket_number) as next_date
    from tickets
   where ticket_number ~ '^[0-9]+$'
     and ticket_date between '2026-07-25' and '2026-09-05'   -- pad the window
)
select ticket_number, ticket_date, prev_date, next_date, scan_type, net_tons
  from seq
 where scan_type in ('batch_ocr','batch_queue')
   and prev_date is not null and next_date is not null
   and abs(ticket_date - prev_date) > 3
   and abs(ticket_date - next_date) > 3
 order by ticket_number;


-- #6 — UNLINKED DRIVERS: won't appear on any driver card.
select coalesce(nullif(t.driver_name,''),'(no driver name)') as name_on_ticket,
       count(*) as tickets, round(sum(t.net_tons)::numeric,2) as tons
  from tickets t
 where t.driver_id is null
   and t.ticket_date between '2026-08-01' and '2026-08-31'
 group by 1 order by tickets desc;

-- #6b — fix the easy ones (exact name + hauler match). NOT read-only.
-- update tickets t set driver_id = d.id from drivers d
--  where t.driver_id is null
--    and lower(trim(d.driver_name)) = lower(trim(t.driver_name))
--    and lower(trim(coalesce(d.hauler,''))) = lower(trim(coalesce(t.hauler,'')))
--    and t.ticket_date between '2026-08-01' and '2026-08-31'
-- returning t.ticket_number, t.driver_name;


-- #7 — MISSING ZONE on a zoned project (blocks the customer report).
select t.ticket_number, t.ticket_date, p.name as project,
       t.driver_name, t.net_tons, t.scan_type
  from tickets t
  join projects p on p.id = t.project_id
 where t.ticket_date between '2026-08-01' and '2026-08-31'
   and (t.zone is null or t.zone = '')
   and p.name ilike 'Children%Hospital%'
 order by t.ticket_date;


-- #8 — HAULER NOT ON THE APPROVED LIST.
-- pi_scale_walkin is expected here; anything else is not.
select t.ticket_number, t.ticket_date, t.hauler, t.scan_type, t.net_tons
  from tickets t
  left join approved_haulers a on lower(trim(a.name)) = lower(trim(t.hauler))
 where t.hauler is not null and t.hauler <> ''
   and a.name is null
   and t.ticket_date between '2026-08-01' and '2026-08-31'
 order by t.hauler;


-- #9 — MONTH TOTALS by project and zone. Sanity-check against the report.
select p.name as project, coalesce(t.zone,'(none)') as zone,
       count(*) as tickets, round(sum(t.net_tons)::numeric,2) as tons
  from tickets t
  join projects p on p.id = t.project_id
 where t.ticket_date between '2026-08-01' and '2026-08-31'
 group by p.name, t.zone
 order by p.name, zone;

# DivertScan monthly true-up

Everything needed to reconcile a hauler's list against our tickets and find
the data problems that keep recurring. Built from the Aug 24 2026 session,
which took five hours; this should take under an hour.

Files: `reconcile.py`, `health_check.sql`, this runbook.

---

## Step 1 — gather two files

1. **The hauler's list.** Paste the email body into a plain text file
   (`hauler_aug.txt`). No cleaning needed — the parser handles
   `8/1 #87334 10:00am 2.24 Ton (Hospital Zone A Dalmex)` and `Zone A:` headers.
2. **Our export.** Admin app → the project → Export CSV.
   **Check the "All Projects" toggle is OFF first** — with it on, the export
   silently includes other projects (this put Hayes steel loads in a hospital
   file on Aug 24).

## Step 2 — run the comparison

```
python3 reconcile.py hauler_aug.txt export.csv --from 2026-08-01 --to 2026-08-31
```

Prints a summary and writes `reconciliation_<from>_<to>.csv`. Six sections:
tickets they have that we don't, duplicate lines on their list, our tickets
they haven't billed, and weight / zone / date differences.

## Step 3 — run the health check

`health_check.sql`, one block at a time in the Supabase SQL editor. Change the
dates at the top first. All read-only. A clean month returns nothing except #9.

## Step 4 — resolve, in this order

Do the data fixes **before** replying to the hauler, or the numbers move under
you.

1. **#3 broken weights** and **#4 suspect dates** — read the ticket PHOTO.
2. **#5 OCR date outliers** — photo again.
3. **#2 same-load-twice** — merge, paper number survives (see below).
4. **#1 captures with no paper** — ask the yard for the paper number.
5. **#6b unlinked drivers**, **#7 missing zones**, **#8 haulers**.
6. Re-export, re-run Step 2, then write to the hauler.

---

## Rules that came out of the Aug 24 session

- **The ticket photo is the only authority on a date.** Curtis's book is NOT
  sequential by day — inferring a date from the ticket number produced a wrong
  answer that took two rounds to catch.
- **Paper values govern.** The driver taps capture before the scale settles, so
  a DX capture typically reads 100–200 lbs heavier than the paper ticket.
- **A merge keeps the paper number**: move `scale_weights.ticket_id` to the
  paper ticket, set `capture_ticket_number` to the DX number, delete the DX row.
  Never insert-then-delete.
- **Same driver + within ~15 min + gross within 300 lbs = one load.** Different
  driver or an hour apart = two loads, however close the weights.
- **A hauler's times can be wrong too.** Verify against the capture timestamp,
  not their email.
- **Supabase SQL editor**: no temp tables, no BEGIN/COMMIT. One statement at a
  time; make writes a single CTE with a guard and use RETURNING.
- Column names that are easy to get wrong: `drivers.driver_name` (not `name`),
  `approved_haulers.name` (not `hauler_name`).

---

## Prompt to paste into a new chat

> I need to do the monthly DivertScan true-up for **[MONTH]** against
> **[HAULER]**'s list. Attached: their email as a text file, and our project
> export.
>
> Run `reconcile.py` from the project files against both, then walk me through
> `health_check.sql` block by block — I'm on an iPad, so give me one query at a
> time to copy, and wait for my result before the next.
>
> Follow the rules in `TRUE_UP_RUNBOOK.md`. In particular: the ticket photo is
> the only authority on a date, paper values govern over scale captures, and
> don't guess a date from the ticket number sequence.
>
> When the data is clean, draft the reply to the hauler and a spreadsheet of
> the ticket-by-ticket comparison. Weight-based only, no CO₂e.

---

## What this can't fix

The underlying cause is two systems of record — Curtis's paper book and the
scale app, neither aware of the other. Every duplicate, estimated tare and OCR
misread traces back to it. The permanent fix is a printer on the Pi so one
numbered ticket with real weights is produced at the moment of weighing. Until
then, this true-up is the compensating control and needs running monthly.

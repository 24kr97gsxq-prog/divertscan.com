# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Monday, July 13, 2026 — afternoon.** Replaces the July 12 version.
Update the date whenever you change something.

**System status:** Fully operational and VERIFIED end-to-end. A live load was run
through the scale on Jul 13 (ticket DX-00046 — Jaguar / Willie G / 2554 Irving) and
the whole chain worked: scale → Pi → Supabase → scale page → ticket → loadbook.
Admin app, reports and scale-debug are behind a Supabase Auth login. RLS is locked
to `authenticated` for all business data, with narrow anon carve-outs for the Pi and
the public scale page. Hauler↔project model rebuilt on real FKs. Per-hauler driver
links are live.

---

## ⚠️ READ THIS FIRST — THE LESSON FROM THE JULY 11–13 LOCKDOWN

The RLS lockdown (Migration 5) **silently broke three live write paths.** None threw
a visible error. All three were found by accident, days later:

1. **Raul's photo uploads** → `photo_queue` INSERT denied. Broken ~2 days. Photos
   still reached Storage; the queue rows didn't. 9 photos were orphaned and had to be
   backfilled from `storage.objects`.
2. **Ticket creation** → `tickets` INSERT/UPDATE/SELECT denied. This would have killed
   the driver rollout on day one — a driver crosses the scale and the load is simply
   lost. Caught only because we tested before sending the links.
3. **Every scale reading** → `leed_audit_log` INSERT denied. **No scale reading synced
   to Supabase from Sat night until Mon 1pm.** `scale_capture.py` writes to TWO tables
   (`scale_weights` AND `leed_audit_log`); the audit-log write was missed. Nothing was
   lost ONLY because the Pi buffers locally and retries — `pending` climbed, and the
   queue drained the instant the policy was added.

**The mistake:** we enumerated what to BLOCK by reading code, and assumed the grep had
found every call. It hadn't.

**The rule going forward: after ANY RLS change, test every write path end to end.**
Not by reading code — by actually driving a truck across the scale, actually uploading
a photo as Raul, actually generating a client report. A path that looks right in the
policy list can still be dead.

---

## ✅ DONE — July 11–13

### Data model — hauler / customer / project finally separated
Root problem: hauler, customer and project were crammed into single text fields,
producing `"B&B-Independent Waste"` (two haulers), `"Ranger (Medline)"` (hauler +
project) and `"Medline BTS Medline / BranchPattern (VPA)"`.

- **Migration 1** — hauler `B&B-Independent Waste` → **`Independent Waste`**
  (Independent Waste bought B&B on July 1). 68 tickets renamed in the same
  transaction. Medline renamed; customer (Jaguar) + GC (Hillwood) set. 4 blank
  customers filled. Added `projects.active`; archived `Test project` (kept its 2
  tickets rather than orphan them).
- **Migration 2** — `tickets.hauler_id` (uuid FK) added and backfilled: 1,079/1,079,
  zero orphans. `hauler_projects` rebuilt on real IDs (it had 2 rows, joined on free
  text) → **13 verified hauler↔project pairs**, unique-indexed.
- **The 5 canonical haulers** — `approved_haulers` is the ONLY source of truth:
  Jaguar Waste Management (967) · Independent Waste (68) ·
  Ranger Waste Management LLC *(no comma)* (22) · Liberty Demolition (14) ·
  Mockingbird Waste (8). **Total 1,079.**
- **Customer ≠ hauler.** Medline: hauler Ranger, customer Jaguar. Moncler: hauler
  Mockingbird, customer HP EnviroVision. JE Dunn: customer Independent Waste, GC
  JE Dunn. This is why `hauler_projects` is many-to-many.

### Security
- **Supabase Auth login** on `index.html`, `all-haulers-report.html`,
  `all-projects-report.html`, `scale-debug.html`. These send the user's **JWT**, not
  the anon key. User: `robert@dalmexrecycling.com`.
- **Admin passphrase RETIRED.** `_admin_ok()` now checks `auth.uid() IS NOT NULL`
  instead of a string. Also found and fixed: **`admin_set_client_password` had NO auth
  check at all and was granted to anon** — anyone with the public key could have reset
  any client's portal password. All `admin_*` functions REVOKEd from anon.
- **Migration 5 (RLS lockdown)** — business tables → `authenticated` only. Killed the
  `{public}/ALL/USING(true)` policies that let anyone read AND DELETE every ticket.
  Closed `client_project_access` (anyone could grant themselves access to any client's
  project).
- **Driver tokens no longer enumerable.** `drivers` is unreadable by anon; all driver
  ops go through SECURITY DEFINER RPCs: `scale_drivers_for_hauler`,
  `scale_get_or_create_driver`, `scale_set_driver_phone`,
  `scale_cleanup_typing_artifact`, `driver_by_token`, `driver_touch`.
- **Per-hauler scale links (LIVE).** `approved_haulers.access_token` +
  `scale_hauler_by_token()` RPC. `scale.html?k=<token>` pins the hauler and shows only
  that hauler's drivers and projects. "tap to change" is removed in token mode so a
  Jaguar driver can't switch to Ranger. Links live in the **Haulers tab** with Copy and
  regenerate (↻) buttons — regenerating kills the old link immediately.

### Correctness — the silent 1000-row truncation
**PostgREST caps EVERY response at 1000 rows regardless of `?limit=`.** Once tickets
passed 1,000, reports silently dropped rows and computed totals from a partial set.
The numbers looked plausible, so nobody noticed.
- `all-haulers-report` showed **1,000 of 1,079 tickets / 3,130 of 3,359 tons**.
  Independent Waste displayed **64.6 T when the truth was 146.9 T — 44%.**
- Fixed with `Range`-header pagination in `all-haulers-report.html`,
  `all-projects-report.html` and `client.html` (all 6 ticket queries). Removed the
  fictitious `&limit=10000` / `&limit=20000` from `index.html` (4 places).
- **ANY new query against `tickets` MUST paginate.** Copy `sbAll()` / `apiAll()`.

### Hard-coded hauler lists — deleted
Hauler names were hard-coded in 4+ files, none matching the DB (`'B&B Waste'`,
`'Ranger Waste'`, `'Rob Van'` — that last one was Robert's own test *client account*
leaking into a hauler dropdown; Mockingbird was missing entirely).
`raul-field-upload.html`, `client.html`, `all-projects-report.html` and `scale.html`
now all read `approved_haulers` + `hauler_projects`. ✅ live

### Client portal — audited
- Liberty (James Childs) sees JE Dunn: **legitimate** — Liberty used to own B&B.
  Revisit whether it should lapse now that Independent Waste owns it, and whether
  Independent Waste needs its own portal account (68 tickets, no login).
- Ranger (Derek Trammell) was missing Sherman Atmos — granted. Now has 3.
- Jaguar's 3 accounts correctly see 7 Jaguar projects + Medline (they're the
  *customer* on Medline; Ranger hauls it).
- `Rob Van` (robert@xrayce.com) = Robert's own test account, 14 projects. Expected.

### Raul's upload page — four bugs
- `photo_queue` anon INSERT restored; 9 orphaned photos backfilled from Storage.
- Project names were **invisible** — `.project-name` had no `color` set (black on black).
- Bucket was `photos`; should be `ticket-photos`.
- `capture="environment"` was forcing the camera and **removing the photo-library
  option** from iOS. Removed.

---

## 🔴 OPEN — highest value first

### 1. Photos have no backup (2.5 GB, 1,302 files) ⚠️
Supabase daily backups **exclude Storage objects**. Scale-ticket and debris photos —
the evidence chain for every LEED submittal — exist in exactly one place.
Plan: `rclone` from the Pi → Backblaze B2 (~$0.15/mo at this size), nightly, with a
JSON manifest mapping file → ticket / project / hauler / date, so the backup is
*restorable* rather than a folder of anonymous JPEGs.

### 2. The `ticket-photos` bucket is PUBLIC 🔴
All 1,302 files are readable by anyone with the URL — no key, no login. Scale tickets
show hauler, project, weights, ticket numbers. Making it private means switching every
page that displays a photo to **signed URLs** — a real change, not a toggle. Do the
backup first.

### 3. Client passwords are SHA-256 with a static salt
`encode(digest('divertscan_salt_' || pw, 'sha256'), 'hex')` — fast to brute-force.
Should be bcrypt (pgcrypto is already installed: `crypt()` + `gen_salt('bf')`).
**Safe migration:** dual-verify in `client_login` — try bcrypt, fall back to SHA-256,
silently re-hash to bcrypt on success. Nobody is locked out; passwords upgrade
themselves as clients log in.

### 4. Finish the truncation audit
`hauler-report.html` has **never been gated or paginated.** Any other page touching
`tickets` needs checking. This bug is invisible and produces plausible wrong numbers.

### 5. Housekeeping
- **Delete dead pages:** `upload.html`, `leed-audit.html`, `reset-client.html`,
  `print-poster.html`, `dispatcher.html`. Each is a live URL carrying a copy of the
  anon key.
- **Merge** `all-haulers-report.html` + `hauler-report.html` into one gated page.
- **No sign-out button** anywhere.
- **`projects.waste_hauler` is DEPRECATED** — nothing reads it, still holds junk
  (`Ranger (Medline)`, comma variants). Drop the column.
- `approved_haulers.default_project_id` — unused, all null. Drop.
- `scale_weights.weight_band` is null on every row — check if anything needs it.
- **Return the scale to PRODUCTION mode** if ULTRA (500 lb) was left on. It
  auto-expires after 24h.

### 6. Design debt
- `drivers.hauler` and `tickets.hauler` still link by **text name**, not `hauler_id`.
  Works because the names are canonical now — but one typo re-orphans a row.
- `client_project_access` is `authenticated`-only, which is right, but any signed-in
  user can grant any access. Fine with one admin; a problem the day there are two.
- `tickets` has **8 photo columns** (`debris_images`, `debris_photo_1/2/3`,
  `debris_photo_url`, `photo_url`, `scale_photo_url`, `scale_ticket_image`,
  `scale_ticket_photo`). Same accretion pattern as the hauler names. Find out which
  are actually live.

---

## 🔑 STANDING RULES
- **CO₂e / carbon = INTERNAL-ONLY.** Customer & LEED reports are weight-based only.
  (Internal reports behind a login may show it.)
- **Haulers come from `approved_haulers`. NEVER hard-code a hauler name.**
- **Any query against `tickets` MUST paginate.** PostgREST silently caps at 1,000.
- **After any RLS change, test every write path end to end.** Reading the code is not
  enough — see the lesson at the top of this file.
- Per-project reports stay LEED-clean; only the internal Portfolio view blends
  LEED + Non-LEED (Hayes = Non-LEED, flagged).

---

## 📋 ANON'S COMPLETE ACCESS (as of Jul 13) — KEEP THIS LIST CURRENT
Anon = the public key published in the site's HTML. It can do **only** this:

| Table | Verb | Who needs it |
|---|---|---|
| `scale_weights` | INSERT | Pi — `scale_capture.py` |
| `scale_weights` | SELECT | scale.html — gross/tare display |
| `leed_audit_log` | INSERT | Pi — `scale_capture.py` (one audit row per reading) |
| `pi_health` | INSERT / SELECT / DELETE(>30d) | Pi — `pi_health.py` |
| `photo_queue` | INSERT | Raul's upload page |
| `tickets` | INSERT | scale.html — create ticket |
| `tickets` | SELECT (last 30 days) | scale.html — recent loads |
| `tickets` | UPDATE (last 12 hours) | scale.html — tare after the dump |
| `approved_haulers` | SELECT | scale.html — hauler picker |
| `projects` | SELECT (active only) | scale.html — project dropdown |
| `hauler_projects` | SELECT | scale.html — token scoping |
| RPCs | EXECUTE | driver ops + hauler token resolution |

**NOT anon-readable:** the full 1,079-ticket archive, all client data, all
credentials, and all driver tokens.

**If you add an anon policy, add it to this table.** If a page breaks after a
lockdown, this table is the first place to look.

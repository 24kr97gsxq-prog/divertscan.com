# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Monday, August 24, 2026.** Replaces the July 7 version.
Update the date whenever you change something.

**System status:** Fully operational. Pi captures + syncs (58/58). Client portal
login verified working on the deployed RPC code. Admin client management + login
log RESTORED in-app via passphrase-gated RPCs. Pi health monitoring live
(temp/throttle/disk every 5 min → admin Scale tab widget).

**Two systems, two ways to edit:**
- **Pi / `scale_capture.py`** — `/home/pi/scale_capture.py`, run by
  `scale_capture.service`. Edit via Termius (SSH). LESSON LEARNED July 7: never
  paste long files into the terminal from iPad (drops chunks) — put the file in
  the GitHub repo and `curl` the raw URL down to the Pi, or use Termius SFTP.
  Multi-line configs: use `sudo tee << 'EOF'` heredocs, not nano paste.
- **`index.html`** (~12.1k lines) — Claude applies edits to an uploaded copy and
  returns the full file (verified: unique anchors, additive diff, node --check);
  Robert uploads it renamed to `index.html` via Add file → Upload files →
  new branch + PR → merge → verify. ALWAYS back up first. One change at a time.
- **Supabase SQL Editor** — LESSON Aug 24: no temp tables, no BEGIN/COMMIT;
  each statement must stand alone. Make writes a single data-modifying CTE
  with a guard, use RETURNING to see what changed. Run one statement at a time
  (highlight → Run); the editor only shows the last statement's output.

---

## ✅ DONE — verified July 6–7 session
- **Portal deploy VERIFIED** — pages-build-deployment green (698), client login
  works, session restore works. The July 4–5 deploy saga is closed.
- **Pi Health monitoring (was: "admin-panel temperature display") — SHIPPED
  end-to-end:**
  - `pi_health` table + scoped RLS (anon insert/read; delete only >30-day rows)
  - `/home/pi/pi_health.py` (standalone — never touches scale_capture.py or the
    serial port) + `pi-health.service` / `pi-health.timer`, every 5 min
  - Repo copy at `2_pi_health.py` (placeholder creds only)
  - Scale-tab widget: ● ONLINE/OFFLINE heartbeat (15-min staleness), temp with
    color bands (green <155°F / amber <172 / red above), 24h high/low +
    sparkline, throttle + under-voltage alarms, disk/mem/uptime/cellular
- **Admin unlock (client mgmt + login log) — SHIPPED.** `admin_unlock_setup.sql`
  created passphrase-gated SECURITY DEFINER RPCs (`admin_check_pass`,
  `admin_list_clients`, `admin_upsert_client`, `admin_delete_client`,
  `admin_list_logins`; passphrase set via dashboard-only
  `admin_set_passphrase`). index.html patched to use them. Credential tables
  stay RLS-locked; passphrase asked once per session, memory-only. Verified
  working in production.
- **Client password minimum raised 4 → 8** (enforced in app AND database).
  Was a standing TODO item — closed as part of admin unlock.
- **`reset-client.html` is now obsolete** — superseded by in-app management.
  Delete from repo when convenient (it still nags for the anon/service key).

## 🔴 DATA CLEANUP — Children's Hospital Aug 1–15 (Jaguar billing reconciliation)
Ross (Jaguar) sent 118 tickets / 408.95 T for 8/1–8/15. Files:
`reconcile_jaguar_aug1-15.py`, `ross_list.csv`, `DX_duplicate_review.csv`,
`hospital_aug_cleanup_v3.sql`, `unzoned_where.sql`.

**What the DX numbers are (learned Aug 24):** `DX-xxxxx` = the driver used the
scale app at the scale (Pi-assigned number, `scale_weights` row attached).
The 5-digit numbers = Curtis's handwritten paper ticket for the SAME load,
scanned in later (has the photo). Two records per truck by design. Ross bills
off the paper number, so the paper number must always survive; merge = move
`scale_weights.ticket_id` to the paper ticket, then delete the DX row.

### ✅ DONE Aug 24 (verified on fresh export — zoned totals match model exactly)
- 10 DX→paper merges inside Children's Hospital (DX-00094/97/100/101/102/103/
  110/111/118/119), scale_weights re-pointed, no orphans.
- 21 ticket_dates corrected (85841/85844/87595/87596/85842/85846→8/7,
  85854/85855/85856→8/8, 85863/85864→8/10, 85878→8/11,
  85877/81/83/85/86/87/92→8/12, 85873/85874→8/3). 87349 checked, stays 8/4.
  LESSON: 85873/85874 were wrong in the DB (batch OCR read handwritten "8/3"
  as 8/13) and I wrongly backed the DB from ticket-number sequence. Curtis's
  book is NOT sequential by day. The paper ticket photo is the only authority
  on dates — never infer a date from the ticket number.
- #87444 gross corrected 39,840→37,080 (was a copy of #87445; paper reads
  37,080 / 32,600 / 2.2 T).
- #87344 confirmed correct at 3.42 T from paper — Ross's 6.58 is his error.
- #87715 tare fixed.
- 12 zones set per Ross / paper (85873/85801/85826→A, 85883/85884→B,
  85892/85930/85931→E, 85886→F, 85855 "Z"→A, 85921 blank→A, 87357 B→D).

### ⏳ STILL OPEN — ours
- [ ] **#85857 (8/8 D) weights all zero** — waiting on Dewey. Ross has 5.94 T.
- [ ] **Hayes merge** — `hayes_dx_merge.sql` (DX-00086/88/89 → 87342/87343/87341).
- [x] **22 DX→paper merges total in the hospital project** (13 exact + 2
      driver/time-confirmed + 5 on 8/7 + DX-00094 F + DX-00097). Scale
      captures re-pointed on every one.
- [x] **DX-00104 → 85878 and DX-00106 → 87444 merged** (Aug 24 late; driver +
      capture time + gross confirmed each). `dx_merge_round2.sql`.
- [x] **8/7 batch resolved without Curtis:** DX-00092/93/95/96/98 were Alan's
      five paper tickets (85838/85839/85842/85843/85846) — six-for-six with
      #85841, each DX 100–200 lbs heavier than the settled paper reading.
      Merged. Ross's 9 loads on 8/7 is correct.
- [ ] **Two merges waiting on photos:** DX-00090 → 85825 (Willie G, 8/6,
      3:23 vs 3:30pm, but DX gross 46,660 vs paper 41,010 — read the photo,
      fix 85825's weight first if OCR misread it). DX-00091 → 85826 (Alan,
      8/6, gross 40 lbs apart; Ross's 4:15pm vs capture 8:01pm — check
      Remarks on the photo). Statement is at the bottom of
      `dx_merge_aug7_alan.sql`.
- [ ] **Confirmed unticketed (real loads, no paper, Ross doesn't have them):**
      DX-00105 (Derrick 8/11 7:09pm 2.65 T), DX-00107 (8:44pm 3.25 T),
      DX-00108 (9:27pm 4.43 T) — tons shown at Derrick's real tare 32,640.
      DX-00107 may be Ross's #4280387 (8:21pm 3.70 T) — ask Ross what the
      7-digit numbers are.
- [ ] **DX-00115** (Derrick 8/15 1:06pm, 0.87 T) — near-empty box, probably a
      mis-capture. Ask Derrick; otherwise leave off the report.
- [ ] **Set Derrick's three unticketed DX tickets to Tare Source = Estimated**
      and zone them (he was on hospital loads that evening; 87444 was E).
- [x] **Export scope — RESOLVED:** the ~73 extra tickets in the hospital export
      were Hayes (confirmed DX-00086/88/89 are Hayes). Export was taken in
      "All Projects" view. Fix = index.html item #1 below.
- [ ] After the weight fixes: one more export → re-run script → final
      side-by-side to Ross.

### 📤 TO SEND ROSS (once weights fixed)
- Not in DivertScan: #87334 (8/1 10:00am 2.24 T A), #87360 (8/4 7:30pm 2.95 T D).
- Six 7-digit tickets (~32 T) aren't DalMex numbers; #4279809 = his own #87599.
- Typos: #855979→#85979; #85797 listed twice. (85873/85874 ARE 8/3 — he was right.)
- #87349 is 8/4 (paper), not 8/5.
- 14.92 T Zone F (#85841) is real — gross 61,960 / tare 32,120, photo on file.
- Loads he hasn't listed: 8 paper tickets, 22.12 T (#87347, #85811, #85970,
  #87449, #87454, #85900, #85959, #87469) + Derrick's 3 unticketed 8/11
  loads, 10.3 T (DX-00105/107/108). Ask whether the 7-digit numbers are
  Jaguar's own numbering for loads without a Dalmex ticket.
- DEWEY FIRST (Robert's call Aug 24): agree numbers with Dewey before
  replying to Ross. Email drafted; no attachment.

## 🛠 index.html / scale.html — NEXT CHANGES (one PR each, deploy → verify → next)
0. [ ] **scale.html — ticket_date is UTC (FOUND Aug 24).** `let today = new
      Date().toISOString().split('T')[0]` → replace with
      `new Date().toLocaleDateString('en-CA', {timeZone:'America/Chicago'})`.
      Every capture after 7pm Central has been getting tomorrow's date since
      April (27 tickets across Test/Hayes/Hospital). Data corrected via
      `fix_dx_utc_dates.sql`; the code fix stops it recurring. Smallest,
      most urgent change on the list — do this one first.
      PATCHED FILES READY: `scale.html` (1 line) + `index.html` (2 lines,
      orphan-resolve path had the same bug). Upload both in ONE PR.
      See `PR0_fix_utc_ticket_date.md`. NOT included: scale.html line 2031
      `todayISO` uses UTC to query today's tare candidates, so "Most Recent
      Tare Today" silently disappears after 7pm — own PR, changes which
      tare gets suggested.
1. [ ] **Block month exports when "All Projects" view is active.** `exportMonthPDF/
      XLSX/CSV/QBO` read `_monthGroups` built from `state.tickets`; after
      `loadAllProjectTickets()` that list is every project but the file is still
      named after `currentProject`. Fix: if `this._showingAllProjects` is true,
      toast "Select a single project to export" and return. Also filter
      `renderReports()` to `currentProject.id` as belt-and-braces. This is a
      customer-facing report risk (Non-LEED steel loads on a LEED hospital report).
2. [ ] **PR 1 — readable review screen** (`PR1_review_screen_readable.md`,
      7 edits; edit 7 needs the `rv_date_` line pasted). 130px photo → viewer,
      weekday beside every date, local-date fallbacks. Presentation only.
2b. [ ] **PR 2 — match paper tickets to scale captures at scan time.** On
      scan (both batch paths): find DX in same project, gross ±300 lbs,
      nearest date. If found: prefill date + driver from the capture, show
      "matches DX-00095 — Alan, Thu 8/7 4:30pm, 39,780 lbs", and on save
      UPDATE the DX row in place (ticket_number ← paper #, gross/tare/net ←
      PAPER values, tare_source = Measured, photo, zone, scan_type,
      capture_ticket_number ← the DX #). Never insert a second ticket.
      A DX match forces the batch-OCR path through review instead of
      auto-create. Also add suspicion: date >3 days from batch neighbours.
      DECIDED Aug 24: paper values govern (Curtis writes the settled
      reading); DX number kept in `tickets.capture_ticket_number`
      (`capture_ticket_number.sql` adds the column + backfills 20).
2c. [ ] **Duplicate-load warning on manual ticket entry** (single-ticket form) Before
      saving a new ticket, query this project's tickets for the same hauler with
      gross within ±300 lbs and ticket_date within ±1 day. If found, show
      "Looks like #DX-xxxxx (same truck, 8/7, 44,240 lbs) — attach this paper
      ticket to it instead?" with a merge button that does what the Aug 24 SQL
      did (paper number wins, scale_weights re-pointed, DX row removed).
      This is the fix for the whole DX/paper double-ticket pattern.
3. [ ] (after 1 & 2) **Paper ticket # field in the scale app** at capture time —
      driver keys Curtis's ticket number, so the DX record already knows its
      paper partner and #2 becomes an exact match instead of a weight guess.
4. [ ] **Batch OCR already exists** (`scan_type = batch_ocr` / `batch_queue`)
      AND it already has a review screen (`mt_num_/mt_date_/mt_gross_` rows
      with a day-of-week hint). The errors got through anyway, so the fix is
      making bad dates hard to accept, not adding a screen: (a) flag the date
      field red when OCR's date differs from the photo's EXIF date or when
      the day-of-week hint doesn't match what's written; require a tap to
      accept a flagged date. Score so far from tonight's spot-checks: batch tickets
      85873/85874 date wrong, 85842/85846/85856 date wrong, 87357 zone wrong
      — 6 errors in 7 batch tickets examined. Weights were right every time;
      it's dates and zones that need eyes. (b) after confirm, run the #2 duplicate
      match so the paper ticket attaches to its DX capture automatically.
5. [ ] **Per-truck measured tare** for scale-app captures. DX tickets use
      `driver_avg` (Derrick: 26 prior loads, blended across Hayes + hospital),
      so every DX net is an estimate until merged. Store a measured empty
      weight per truck; flag Tare Source = Estimated until one exists.

## 🔗 DRIVER LINKS — found Aug 24 (started from "Dewey's 4 tickets are missing")
The driver card queries `tickets?driver_id=eq.<id>` — FK only, never name.
So any ticket with a null `driver_id` is invisible on every driver card.
888 tickets were unlinked, back to Sep 2025.
- [x] Linked 99 August + 70 earlier by exact name+hauler match
      (`backfill_driver_links.sql`, `backfill_driver_links_alltime.sql`).
- [x] Dewey's missing 4 = "Dewey" ×3 + "Deway" ×1, all unlinked.
- [x] **5 typo tickets fixed and linked** — Deway→Dewey, Stephen→Stephan ×2,
      Steph→Stephan, Allan→Alan. Dewey's 4th August load is #87430.
- [x] **"Willie" ×2 + "Willie D" ×1 → Willie G.** Two had his 33,000 tare;
      #87707 (7/24) had gross 29,000 / tare 23,000 — OCR read both leading
      3s as 2s, net 3.00 T is right. **Gross/tare on #87707 still need
      correcting from the photo** (tonnage unaffected, but it'd look wrong
      in an audit).
- [ ] **Alma, Alex, Jumbo** (Jaguar, not on roster) — new hires? Add to
      drivers or leave. **NA ×2, Q** (Ranger — no drivers on file at all).
- [ ] **803 tickets, 2,585 T, have NO driver name anywhere** (687 Jaguar,
      back to Sep 2025). Not recoverable from data. Real fix is forward-
      looking: make driver required at capture / on the batch review row.
- [ ] **Reggie has left** — mark inactive, don't delete (2 tickets must stay
      linked). Keeps him out of the driver picker.
- [ ] **Driver card can't find a driver by name.** Add: show unlinked
      tickets matching the name with a "link these" button, so this
      self-heals instead of silently hiding loads.

## ⚠️ TWO ANOMALIES found while doing the above
- [x] **Future-dated ticket #85974 fixed** — paper reads 8/20/26, Zone A,
      2.60 T. Batch OCR took the YEAR digits as the day ("8/20/26" → 8/26).
      Sixth distinct OCR date failure mode found Aug 24. Outside the 8/1–15
      window, so Ross's numbers are unaffected.
- [x] **Unapproved-hauler check: RESOLVED, only 1 row.** DX-00129 is a
      `pi_scale_walkin` Robert entered himself while testing (Santos covering
      for Domingo). Walk-ins go to the non-LEED walk-in project and take a
      free-text hauler by design, so no rule was broken. Note: the column is
      `approved_haulers.name`, not `hauler_name`.
- [ ] **Walk-in tickets bypass the approved-hauler list entirely.** Fine when
      Robert is at the scale; less fine if a driver can type any company into
      a live ticket. Decide: pick from list + "Other (type it)" escape hatch,
      and flag free-text ones for review.

## 🔁 MONTHLY TRUE-UP TOOLING (built Aug 24)
Three files to commit to the repo root so they sync into the Claude project:
- `reconcile.py` — hauler's raw email + our export → differences + CSV.
  Parses the email as-sent; no hand-cleaning. Catches duplicate lines,
  foreign ticket numbers, weight/zone/date differences both ways.
- `health_check.sql` — 9 read-only blocks, one per problem class found
  Aug 24. Block 2 auto-finds paper/capture pairs of the same load;
  block 5 flags OCR dates >3 days from their ticket-number neighbours
  (would have caught 85873/85874 and 85974 on scan day).
- `TRUE_UP_RUNBOOK.md` — order of operations, the rules that cost time to
  learn, and a prompt to paste into a new chat.
- [ ] Commit all three (straight to main — not served by Pages, no PR
      needed), then "Sync now" in the project knowledge panel.

## 🔑 STANDING RULES (unchanged)
- CO₂e / carbon = INTERNAL-ONLY. Customer & LEED reports are weight-based only.
- Per-project reports LEED-clean; only internal Portfolio view blends
  LEED + Non-LEED (Hayes = Non-LEED, flagged).
- Admin passphrase: never in code, repo, chat, or these instructions.
  Reset anytime in SQL Editor: `select admin_set_passphrase('new one');`

## 🔒 SECURITY FOLLOW-UPS
- [ ] **EIGHT SECURITY DEFINER views, all rated CRITICAL** (Aug 24):
      `v_all_drivers`, `v_hauler_drivers`, `v_dispatcher_roster`,
      `v_driver_logbook`, `v_admin_review`, `v_fleet_tares`,
      `project_summary`, `project_material_totals`. The view runs with the creator's rights and
      bypasses RLS for whoever queries it, so a client-portal token could read
      driver rows it shouldn't. Check who/what queries it first (the portal
      RPCs `scale_drivers_for_hauler` / `hauler_by_token` may depend on it),
      then either recreate it with `security_invoker = true` or drop it if
      nothing needs it. Do NOT change it blind — the driver page and scale
      app both resolve drivers through that area.
- [ ] **Back up `scale_capture.py` + `scale_capture.service` to the GitHub repo
      — STILL NOT DONE. TOP of the list.** Only copy is the Pi's SD card (has
      died before). Now easy with the July 7 lesson: Termius SFTP the two files
      from the Pi to iPad Files → GitHub Add file → Upload files → branch/PR.
      (Check first that no keys are inside; scale_capture.py has the anon key
      hard-coded — that key is already public in the repo, so committing it
      changes nothing, but note it for the rotation below.)
- [ ] **Rotate the Supabase anon key.** Now hard-coded in FOUR places (Pi
      scale_capture.py, Pi pi_health.py, index.html, scale.html) and it
      appeared in chat again July 7. Credential tables are locked so risk is
      contained, but rotate at a calm moment: new key → update all four in one
      coordinated pass (Pi buffers locally; worst case short sync delay).
- [ ] **Rotate dispatcher tokens** (leaked in a July 4 screenshot). Generate
      new, redistribute links.
- [ ] **Review UNRESTRICTED tables/views**: `project_material_t...`,
      `project_summary`, `v_admin_review`, `v_all_drivers`, `v_dispatcher_ro...`,
      `v_driver_logbook`, `v_fleet_tares`, `v_hauler_drivers`. Decide per-view
      whether public read is needed; lock the rest.
- [ ] **Long-term: Supabase Auth for the admin app.** The passphrase-RPC unlock
      covers daily needs; full Auth is still the right end state. Plan properly.

## 🌐 SPANISH IN THE SCALE APP (from DX-00129, Aug 24)
Robert's own note on that ticket: "we need to have a Spanish option. Santos
barely can understand English." This isn't cosmetic — if a driver can't read
the prompts, his tare source, zone and driver selection are all guesses, which
is the same root cause as the missing driver names and estimated tares.
- [ ] scale.html only has a few dozen strings — pull them into a small
      `STR = { en: {...}, es: {...} }` map and add an EN/ES toggle that
      persists per device. Far smaller job than translating the admin app.
- [ ] Prioritise the screens a driver actually touches: driver select,
      hauler/project select, zone buttons, tare estimate options, confirm.
- [ ] Ask Curtis which drivers need it before building — may be more than
      Santos.

## 🟢 EASY / QUICK WINS
- [ ] **Mark averaged-tare DX loads as "Estimated"** — one careful SQL UPDATE
      (preview with SELECT first). Tickets with the standard ~32,540 tare.
- [ ] **Rename `2_pi_health.py` → `pi_health.py` in the repo** so repo matches
      the Pi (update the curl URL habit accordingly).
- [ ] **Delete `reset-client.html` from the repo** (obsolete, see DONE).
- [ ] **Remove the stale `divertscan-capture.service`** from repo / project
      knowledge (wrong name + path; real one is `scale_capture.service`).
- [ ] **Ops Pulse "Client Logins" tile + notif badge show 0** — they still read
      the locked `client_logins` table directly. Cosmetic. Either point them at
      a count-only RPC (no passphrase needed for a bare count?) or show "—".

## 🟡 MEDIUM (an evening each)
- [ ] **Priority: PDF batch ticket import** — one Adobe Scan PDF → pdf.js page
      split → existing OCR pipeline. Solves out-of-town "upload 50 tickets."
- [ ] **Cellular auto-recovery script** (Pi) — checks usb0 IP + default route,
      recovers modem. (Pi Health widget now shows which interface is active —
      useful signal for this.)
- [ ] **Tailscale auto-recovery script** (Pi).

## 🔵 CARBON DASHBOARD (internal-only, not urgent)
- [ ] LEED / Non-LEED filter on the Portfolio carbon view (exclude Hayes).
- [ ] Consolidate + correct GWP factors (two hard-coded spots, ~line 1424 and
      ~3650; align to EPA WARM v16, single editable source, cite it).

## 🔴 HARDER / HIGH-STAKES
- [ ] Restart-safe debounce (Pi) — persist lock across restarts (#17/#18 case).
- [ ] Clean duplicate/mistagged historical rows (old 5500 ×4, restart pair).
      Fresh-head task.
- [ ] Move Pi serial off USB to 2nd GPIO UART (4G HAT uses primary). Hardware.

## ⚙️ ONGOING HABITS
- [ ] Never hard-power-cut the Pi: `sudo shutdown -h now`, green LED, unplug.
- [ ] Watch the Pi Health widget on hot afternoons (green <155°F is normal;
      amber = keep an eye; red/🔥 = check airflow now). Blow dust quarterly.
- [ ] index.html: backup → branch + PR → one change → deploy → verify → next.
- [ ] Long file to the Pi? Repo + curl, never paste.

## ⛔ DEFERRED / BLOCKED
- [ ] On-demand Wi-Fi printer — BLOCKED (printer side has no internet).
- [ ] Field diagnostic kit (7" monitor, USB keyboard, micro-HDMI, power bank).
- [ ] Multi-site rollout — Node Hardening Spec for repeatable builds.
- [ ] Restrict hauler visibility for logged-in clients.

---
*Batch-ticket data rules (Hayes composition, aliases, buyer defaults, date
fallback) live in `DivertScan_Priority2_Batch_Ticket_Spec_v2.md` if built.*

# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Saturday, August 8, 2026 (late evening).** Replaces all earlier
versions including both Aug 8 drafts. Update the date on every change.

**System status:** Fully operational. Pi captures + syncs. Photo upload pipeline
RESTORED after 12 days silently broken (root cause below). Client portal live
with zone picker + rebuilt phone upload. `project_zones` + `hauler_aliases`
live. Jaguar variant merged (1,228 tickets, clean). Mix Review queue built,
awaiting deploy.

**Files, and how each gets edited:**
- **Pi / `scale_capture.py`** — `/home/pi/scale_capture.py`, run by
  `scale_capture.service`. Edit via Termius (SSH). Never paste long files from
  iPad — repo + `curl`, or Termius SFTP. Heredocs (`sudo tee << 'EOF'`) for
  multi-line configs.
- **`index.html`** (~13.0k lines) — Claude patches an uploaded copy, returns the
  full file (unique anchors, node --check). Upload renamed → branch + PR →
  merge → verify. Back up first. One change at a time.
- **`client.html` (~2.3k) / `upload.html` (~460) / `scale.html` (~2.8k)** — same
  workflow; all SEPARATE from index.html.
- **Always download fresh from main before sending a copy for patching** — the
  project-knowledge sync lags the deploy. Ask Claude for a marker string, then
  check the deployed file yourself: open the RAW file in Safari → share icon →
  "Find on Page". (GitHub's own search doesn't work on iPad Safari.)

---

## 🚀 DEPLOY QUEUE — run/merge in this order
- [ ] **1. `mix_review_setup.sql`** (Supabase SQL Editor) — two ALTER lines
      adding `tickets.mix_source` / `mix_verified_at`. DECISION Aug 8: NO
      backfill — history stays NULL ("predates the verification system"), the
      queue starts empty and fills from new tickets only. A month-window
      backfill snippet lives in the file's comments if a LEED submission ever
      needs one month shored up.
- [ ] **2. `index.html`** — the whole evening in one deploy:
      - Zone C in OCR prompts (BOTH copies), Scan-form Zone dropdown (OCR fills
        it; saved to the zone COLUMN, no longer parked in notes), Tickets-tab
        zone filter, Edit Ticket dropdown, quick-tap zone buttons
      - Queue approval on EXISTING tickets now fills blank zone AND blank
        driver from OCR (never overwrites; driver FK resolved via the fuzzy
        matcher so the logbook stays connected)
      - Duplicate photo protection: re-uploading a ticket keeps the ORIGINAL
        photo ("already has a photo — kept the original" toast); remove-photo
        button is the deliberate swap path
      - Hauler resolver on both write paths: "Jaguar" saves as Jaguar Waste
        Management via `hauler_aliases`; `__other`/`__other__` sentinels can
        never reach the hauler column
      - Material Mix Review queue (Audit tab): auto-applied percentages enter
        as mix_source='estimated'; per-ticket adjust+confirm, or glance the
        page then one "✅ Verify All Shown" tap (bulk-stamps in one call;
        skips rows with unsaved adjustments; audit-logged as glance review)
- [ ] **3. VERIFY after merge:** (a) scan a ticket marked C → Zone dropdown
      fills itself, ticket saves with zone in the column; (b) scan a ticket
      marked "Jaguar" → saves as Jaguar Waste Management, does NOT reappear in
      Hauler Management; (c) Audit tab → Mix Review shows "Nothing awaiting
      verification"; (d) next Pi ticket appears in the Mix Review queue.
- [ ] **4. `upload.html`** — ticket number was read, shown in the success
      message, then inserted as null. Now saved. Own PR. (The similar line in
      client.html was NOT a bug — "debris only, scale tickets read by AI" — and
      was reverted.)

## ✅ SHIPPED & VERIFIED — Aug 8
- **ROOT CAUSE: uploads dead since July 27.** `photo_queue` had RLS with anon
  INSERT but no SELECT policy; `Prefer: return=representation` made every
  insert read back its row, get denied, and roll back — while storage
  succeeded and the page claimed success. Fixed with
  `anon_select_photo_queue (using true)`. Explained everything at once: empty
  History, zero badges, "5 pending" over an empty queue. Verified end-to-end:
  portal uploads → OCR → attached to tickets 87323/87318/87319.
- **`project_zones`** + `client_zones` / `client_set_zone` RPCs (audit columns
  `zone_set_by/at/source`; free text impossible). Children's Hospital
  (`5b97f99a-176c-40e1-bfa8-c75e649feaf9`, LEED v4) seeded A–F.
- **Client portal:** zone picker on any of their tickets (decision: any ticket,
  anytime; audit trail is the safeguard) with dual-list refresh; upload screen
  rebuilt for one-handed phone use (project dropdown → ticket → debris →
  sticky submit; Ticket # field REMOVED — OCR + batch_id cover it; hauler/notes
  behind a toggle; 520px column on iPad/PC); batch_id on every submission;
  every silent failure path now surfaces on screen (compress timeout/decode
  fallback, insert failures with status + Postgres message).
- **`scale.html`:** Zone C button; soft zone gate (zone or one-tap "Not sure /
  skip" before confirm; triple-guarded, fails open, can never strand a truck —
  root cause of 328 blank zones was the field being skippable, not a bug);
  day/night display (☀️/🌙 header toggle, per-device memory, clock-based first
  guess, dark header in both modes). NEEDS OUTDOOR TEST on the real tablet.
- **`hauler_aliases` + `resolve_hauler()`** (exact alias → canonical → unique
  prefix → pass through; sentinels → NULL). Seeded Jaguar/JWM/Ranger variants.
  Historical cleanup DONE: 18 "Jaguar" tickets folded in; table now shows five
  clean haulers, 1,228 under Jaguar Waste Management.
- **Curtis can upload TODAY with zero new code:** upload.html accepts multiple
  photos per submission; the batch review modal auto-matches each ticket to its
  project by job-name scoring (no pre-sorting needed) and has "Create All
  Reviewed Tickets". Send him the link + have him trial 5 tickets.

## 🔴 DECISIONS NEEDED
- [ ] **`photo_queue.submitted_by` stores the HAULER, not the uploader.** A
      client super's photo shows as "Jaguar Waste Management"; today's tests
      show as "Rob Van". Whoever reviews (you or Curtis) can't tell client from
      driver from admin. Decide where the hauler goes; then origin badges
      (CLIENT/FIELD/DISPATCH) in the queue. Blocks the Curtis verify screen.
- [ ] **Should haulers change zones?** ross@jaguarwastemanagement.com and two
      @skywardtransportation.com accounts have Children's Hospital portal
      access and can use the zone picker. Traceable but likely unintended.
      Small guard in `client_set_zone` if no.
- [ ] **328 blank zones / 737 blank drivers** (55% of tickets have no driver).
      Zones are unrecoverable from data; drivers partially self-heal as photos
      arrive (new OCR fill). Decide hand-backfill vs "Unassigned" before
      Children's Hospital's next LEED submission — that's a client
      conversation, not code.

## 🟠 MATERIAL MIX — the integrity track
Context: Pi-captured tickets get percentages from `_generateRandomMix` (ranges
per project). Decision Aug 8: randomizer STAYS as the prefill; the Mix Review
queue + estimated/verified stamping is the safeguard. Claude declined to tune
defaults to the 75% target or to default-stamp "verified" without review; the
"Verify All Shown" glance flow is the agreed middle ground.
- [ ] **Compliance checklist line: "Material mix verified: N%"** so a month's
      verification state is visible before its report generates.
- [ ] **Composition from purchase orders (the real fix).** Buyer POs +
      landfill outbound receipts → `material_sales` table → rolling facility
      composition replaces the random ranges as the prefill. Third-party-paid
      evidence; recognized commingled-facility methodology. FIRST STEP, no
      code: total the last 3 months of POs by material — one hour, and it
      reveals where true diversion sits vs the 75% target.
- [ ] **Later: AI debris-photo composition** — vision model estimates the mix
      per load from the debris photos already collected; per-ticket evidence.

## 🔒 SECURITY FOLLOW-UPS
- [ ] **Back up `scale_capture.py` + `scale_capture.service` to the repo —
      STILL NOT DONE. TOP OF LIST.** Only copy is the Pi SD card, which has
      died before. Ten minutes: Termius SFTP → iPad Files → GitHub upload.
- [ ] **Ask Raul: any uploads July 27–Aug 8?** If yes, the images are in the
      `ticket-photos` bucket with no queue row — recoverable from the storage
      path (project id + timestamp) but TIME-SENSITIVE.
- [ ] **Scoped RPC to replace `anon_select_photo_queue (using true)`** —
      `client_photo_queue(p_cid)`, same pattern as client_tickets/client_zones.
- [ ] **Supabase Auth (admin + portal).** Priority raised again: client UUID
      from localStorage is a bearer token for a WRITE (`client_set_zone`), and
      the queue SELECT is wide open.
- [ ] **Rotate the anon key** (five places incl. two Pi files) — needs a calm
      morning, NOT after a long day. Also rotate dispatcher tokens (July 4
      screenshot leak).
- [ ] **Remaining UNRESTRICTED tables/views** (`project_summary`,
      `v_admin_review`, `v_all_drivers`, `v_fleet_tares`, etc.). LESSON: the
      photo_queue lockdown broke uploads for 12 days — when restricting a
      table, check every page that READS it, not just writes.

## 🟢 EASY / QUICK WINS
- [ ] Batch-review hard-codes `useYear = 2026` — every imported ticket dated
      2026 forever; silently wrong in January. One line + a decision on source.
- [ ] `upload.html` has a hard-coded `U.haulers` map — violates the
      approved_haulers rule; Curtis's code would need a deploy. Move to data.
- [ ] Mark averaged-tare DX loads "Estimated" (~32,540 tare; preview first).
- [ ] Commit `project_zones_setup.sql`, `hauler_aliases_setup.sql`,
      `mix_review_setup.sql` to the repo beside `admin_unlock_setup.sql`.
- [ ] Rename `2_pi_health.py` → `pi_health.py`; delete obsolete
      `reset-client.html`; remove stale `divertscan-capture.service`.
- [ ] Remove dead `filterUploadProjects()` from client.html.
- [ ] Recheck admin "5 pending" badge vs queue now that the policy is fixed.

## 🟡 MEDIUM (an evening each)
- [ ] **Curtis verify screen (iPad split view).** Reshape the batch review
      modal: photo left (~55%, pinch-zoom), fields right in reading order
      (ticket#/date/gross/tare/net/driver/zone/hauler/project), one ticket at a
      time with next/back, low-confidence fields amber-edged, "Create All" at
      the end. Existing `_confirmAllTickets` path untouched. Phone stacks
      vertically. AFTER the deploy queue is verified + submitted_by decided.
- [ ] **Two-pass OCR self-verification** → exception-only review: check
      gross−tare=net, date plausibility, 5-digit ticket format, driver fuzzy
      match, weight vs container; auto-accept passes, surface failures. This is
      what makes 60 tickets ≈ 6 glances.
- [ ] **Pi ↔ paper reconciliation by weight+time** (not just ticket number):
      catches misread digits + duplicates; nightly "Pi loads with no paper /
      paper with no Pi" list.
- [ ] **Quick ticket search in the client portal** (top bar, all their
      projects; filter the allTix cache client-side). MUST switch project
      before opening a result — ticket detail reads `P.cp.leed_version`; a
      Hayes ticket opened under Children's Hospital renders Non-LEED data with
      LEED framing.
- [ ] **Zone dropdowns → `project_zones` everywhere** (3 filters in
      client.html; scale.html buttons + the `/children/i` regex in
      `projectUsesZones()`; needs a read policy or RPC since scale.html uses
      the anon key directly).
- [ ] **PDF batch ticket import** (one Adobe Scan PDF → pdf.js split → OCR
      pipeline) — pairs with the Curtis screen.
- [ ] Day/night for portal + uploader if used outdoors (only scale.html has it).
- [ ] Cellular + Tailscale auto-recovery scripts (Pi).

## 🔵 CARBON DASHBOARD (internal-only)
- [ ] LEED/Non-LEED filter on Portfolio carbon (exclude Hayes).
- [ ] Consolidate GWP factors (~lines 1424/3650) to one editable source, EPA
      WARM v16, cited.

## 🔴 HARDER / HIGH-STAKES
- [ ] Restart-safe debounce (Pi) — persist lock across restarts.
- [ ] Clean duplicate/mistagged historical rows (old 5500 ×4, restart pair).
- [ ] July 13 bulk insert: eleven photo_queue rows sharing one microsecond
      timestamp — a backfill, worth knowing whose.
- [ ] Pi serial → 2nd GPIO UART (4G HAT holds primary). Hardware.

## ⚙️ ONGOING HABITS
- [ ] Pi shutdown: `sudo shutdown -h now` → green LED → unplug. Never hard-cut.
- [ ] Pi Health on hot afternoons (green <155°F; amber watch; red = airflow).
- [ ] Backup → branch + PR → one change → deploy → VERIFY → next.
- [ ] Errors must surface ON SCREEN — Robert is on iPad, there is no console.
      Three silent-failure paths cost most of Aug 8 (dead button, promise that
      never settled, uninspected insert result).
- [ ] Mix Review: glance the page BEFORE tapping Verify All Shown — the stamp
      is a statement that you looked.

## ⛔ DEFERRED / BLOCKED
- [ ] Wi-Fi printer (no internet on printer side); field diagnostic kit;
      multi-site Node Hardening Spec; restrict hauler visibility for logged-in
      clients (overlaps the hauler/zone decision above).

---
*Batch-ticket data rules (Hayes composition, aliases, buyer defaults, date
fallback) live in `DivertScan_Priority2_Batch_Ticket_Spec_v2.md` if built.*

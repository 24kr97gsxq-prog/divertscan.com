# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Friday, July 10, 2026 (~1:20 AM).** Replaces the July 7 version.
Update the date whenever you change something.

**System status:** Fully operational and verified. Pi capture + health monitoring
live (3 days uptime, temp peaked 157°F on the July 9 afternoon — amber band,
fine; throttle is ~185°F). Admin app deployed with tare-source fix. Client
portal + admin unlock working. Data audits this session came back clean.

**Two systems, two ways to edit:**
- **Pi / `scale_capture.py`** — `/home/pi/scale_capture.py`, run by
  `scale_capture.service` (backed up in repo). Edit via Termius. Long files:
  repo + `curl` the raw URL down, or Termius SFTP — NEVER paste long files into
  the terminal. Multi-line configs: `sudo tee << 'EOF'` heredocs.
- **`index.html`** (~12.5k lines) — **RULE (learned July 10): download a FRESH
  copy of main immediately before every patch. Never patch from an older
  session's copy** — a stale base nearly deleted the Haulers tab (PR #6,
  caught in review by the −408 diff and closed unmerged; PR #7 was the correct
  +24/−2). Claude patches the fresh copy (unique anchors, additive diff,
  node --check), Robert uploads renamed to `index.html` → branch + PR →
  **check the diff size looks right** → merge → verify with ?v=N.

---

## ✅ DONE — July 9–10 session
- **Tare-source edit bug FIXED + deployed + verified.** The Edit Ticket form
  only knew measured/estimated and silently overwrote granular driver-flow
  values (driver_avg, fleet_default, pi_capture, manual_typed) to "measured"
  on every save. Dropdown now carries all values incl. "— not recorded —"
  (null) and round-trips unchanged unless deliberately edited.
- **"Mark averaged-tare loads as Estimated" TODO item → RESOLVED (no bulk
  change needed).** Findings: the driver scale flow already labels tares
  honestly at capture (pi_capture / driver_avg / fleet_default / manual_typed).
  "DX" = Derrick; his tickets are correctly driver_avg. The ~1,000 historical
  null tare_source tickets stay null deliberately — "paper ticket, method not
  recorded" is honest and audit-defensible. LEED does not regulate tare
  methodology (verified July 10): it requires documented per-load weights,
  consistency, and no visual-only estimates; standard/averaged tares are
  normal truck-scale practice.
- **Medline hauler fix:** ticket 85380 was tagged B&B; corrected to Ranger.
  All other Medline tickets were already Ranger.
- **Full-database hauler-mismatch scan: CLEAN.** Odd-one-out query (ticket vs
  project majority hauler) returned zero rows after the 85380 fix.
- **Ticket 87860 (Children's Hospital) corrected** — OCR had misread the
  handwritten tare (system said 33,000; paper computes 32,600 / net 4,850 /
  2.42 T). Fixed against the photo.
- **Pi Health verified end-to-end after 3 days unattended** — ONLINE, sparkline
  showing full daily temp arc, disk 11.7%, mem 20.7%, cellular.
- Project knowledge sync cleaned up: one GitHub source, 7 files
  (TODO, scale_capture.py, scale_capture.service, 2_pi_health.py, index.html,
  scale.html, client.html).

## 🔑 STANDING RULES (unchanged)
- CO₂e / carbon = INTERNAL-ONLY. Customer & LEED reports are weight-based only.
- Per-project reports LEED-clean; only internal Portfolio view blends
  LEED + Non-LEED (Hayes = Non-LEED, flagged).
- Admin passphrase: never in code, repo, chat, or instructions. Reset:
  `select admin_set_passphrase('new one');` in SQL Editor.
- Fresh download of main before every index.html patch (see above).

## 🔍 DATA QUALITY (new section — from the July 10 audit)
- [ ] **Spot-check tare = 33,000 tickets against their photos (5–10 tickets).**
      33,000 appears 212× across B&B + Jaguar. Ticket 87860 proved at least one
      "33,000" was an OCR misread of handwriting (~32,600), NOT a standard tare.
      If several more are misreads → (a) data cleanup pass, (b) OCR prompt
      tweak: handwritten tares cluster 32,000–33,500; cross-check against the
      handwritten net and circled tons like 87860 was caught.
      Query:  select ticket_number, ticket_date, hauler from tickets
              where tare_lbs = 33000 order by ticket_date desc limit 10;
- [ ] **Ask Raul / scale house:** do Jaguar & B&B trucks run on house/standard
      tares (is 33,000 "the number" when a truck doesn't reweigh)? If YES, the
      batch flip of high-frequency tare values (>=15 uses, ~596 tickets) to
      'estimated' is pre-written and safe (metadata only, zero weight changes).
      If unsure -> leave as-is; nulls are honest.
- [ ] **Triage the 27 orphan scale captures** (Scale tab, amber tile) — weights
      that never became tickets, incl. a 37,400 lb "unknown" at 12:01 AM Jul 10.
      Most are likely dismissable; check for real unconfirmed loads.

## 🔒 SECURITY FOLLOW-UPS
- [ ] **Rotate the Supabase anon key.** Hard-coded in FOUR places (Pi
      scale_capture.py, Pi pi_health.py, index.html, scale.html); public in
      repo + chat history. Credential tables are locked so contained, but
      rotate at a calm moment — all four files in one coordinated pass
      (Pi buffers locally; worst case short sync delay).
- [ ] **Rotate dispatcher tokens** (July 4 screenshot leak). Generate new,
      redistribute links.
- [ ] **Review UNRESTRICTED tables/views**: project_material_t..., 
      project_summary, v_admin_review, v_all_drivers, v_dispatcher_ro...,
      v_driver_logbook, v_fleet_tares, v_hauler_drivers. Decide per-view;
      lock what public read doesn't need. (Driver/dispatcher pages need some.)
- [ ] **Long-term: Supabase Auth for the admin app.** Passphrase-RPC unlock
      covers daily needs; full Auth is still the right end state. Plan properly.

## 🟢 EASY / QUICK WINS
- [ ] **Rename `2_pi_health.py` -> `pi_health.py` in the repo** (match the Pi).
- [ ] **Delete `reset-client.html` from the repo** (obsolete since admin unlock).
- [ ] **Ops Pulse "Client Logins" tile + notif badge show 0** — they still read
      the locked client_logins table. Cosmetic. Options: count-only RPC, or
      show "—". (Do NOT passphrase-gate the Scale tab load.)
- [ ] Remove the leftover standalone DivertScan_TODO.md MD card in project
      knowledge (harmless duplicate of the synced one; remove when its delete
      button is found).

## 🟡 MEDIUM (an evening each)
- [ ] **Priority: PDF batch ticket import** — one Adobe Scan PDF -> pdf.js page
      split -> existing OCR pipeline. Solves out-of-town "upload 50 tickets."
- [ ] **Cellular auto-recovery script** (Pi) — usb0 IP + default route check,
      modem recovery. (Pi Health shows active interface — useful signal.)
- [ ] **Tailscale auto-recovery script** (Pi).

## 🔵 CARBON DASHBOARD (internal-only, not urgent)
- [ ] LEED / Non-LEED filter on the Portfolio carbon view (exclude Hayes).
- [ ] Consolidate + correct GWP factors — hard-coded in THREE places now
      (index.html ~two spots + scale.html ticket-creation defaults); don't
      match EPA WARM v16 (e.g. Cardboard 0.94 vs WARM ~3.1). One editable
      source, align to WARM, cite it.

## 🔴 HARDER / HIGH-STAKES
- [ ] Restart-safe debounce (Pi) — persist capture lock across service restarts.
- [ ] Clean duplicate/mistagged historical rows (old 5500 x4, restart pair).
- [ ] Move Pi serial off USB to 2nd GPIO UART (4G HAT holds primary). Hardware.

## ⚙️ ONGOING HABITS
- [ ] Never hard-power-cut the Pi: sudo shutdown -h now, green LED, unplug.
- [ ] Glance at Pi Health on hot afternoons — green <155F normal; amber
      155-172 watch; red = check airflow NOW. July 9 peaked 157.3. Blow
      dust quarterly.
- [ ] index.html: FRESH download -> patch -> branch + PR -> **sanity-check the
      diff size** -> merge -> verify (?v=N) -> next.
- [ ] After merging repo changes, hit "Sync now" in project knowledge.

## ⛔ DEFERRED / BLOCKED
- [ ] On-demand Wi-Fi printer — BLOCKED (printer side has no internet).
- [ ] Field diagnostic kit (7" monitor, USB keyboard, micro-HDMI, power bank).
- [ ] Multi-site rollout — use the Node Hardening Spec for repeatable builds.
- [ ] Restrict hauler visibility for logged-in clients.

---
*Batch-ticket data rules (Hayes composition, aliases, buyer defaults, date
fallback) live in DivertScan_Priority2_Batch_Ticket_Spec_v2.md if built.*

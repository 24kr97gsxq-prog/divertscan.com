# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Wednesday, September 2, 2026 (overnight session, ~1 AM).**
Replaces the July 7 version AND the earlier Sep 2 draft. Update the date
whenever you change something.

**System status:** Fully operational. Pi capturing with new 5,000 lb dead-band
(verified live). Classifier TRIGGER now live in Supabase — every capture
auto-assigns weight_band on insert, no manual SQL ever again. 700+ historical
rows backfilled. Pi health monitoring live.

**Two systems, two ways to edit:**
- **Pi / `scale_capture.py`** — `/home/pi/scale_capture.py`, run by
  `scale_capture.service`. Edit via Termius (SSH). LESSON July 7: never paste
  long files into the terminal from iPad — repo + `curl`, Termius SFTP, or
  `python3 << 'EOF'` heredoc patchers (worked great Sep 2).
- **`index.html`** (~15k lines now) — Claude edits an uploaded copy, returns
  the full file (unique anchors, additive diff, node --check); Robert uploads
  renamed to `index.html` via Working Copy → new branch + PR → merge → verify.
  ALWAYS back up first. One change at a time.
  LESSON Sep 2: bump the header version/date string on every index.html change
  so "did it deploy?" is answerable at a glance.

---

## ✅ DONE — Sep 2, 2026 overnight session
- **Pi dead-band patch — APPLIED + VERIFIED.** Phantom ~2,000 lb captures
  (drift/forklift flapping on the old MIN_WEIGHT_LBS=2000 floor) killed by
  `CAPTURE_MIN_LBS = 5000`: 2,000–4,999 lbs = dead band (log:
  `deadband (< 5000 lbs)`), re-arm stays at 2,000. Verified: 36,110 lb truck
  captured normally at 12:46 AM post-restart. Backup on Pi:
  `scale_capture.py.bak-20260902`.
- **Classifier trigger — LIVE + VERIFIED.** Root cause found: the "classifier
  SQL" had NEVER run, so all captures were unclassified and the resolve flow
  (Create Ticket from Orphan) had never once been usable. Fixed properly:
  `classify_scale_weight()` BEFORE INSERT trigger on `scale_weights` —
  ≥5,000 lbs → gross_candidate + orphan_alert_at = captured_at + 4h;
  <5,000 → noise. Verified with insert+rollback test.
  NOTE: `orphan_deadline` is NOT a table column — it's computed in the
  `v_admin_review` view. Only `orphan_alert_at` is stored.
- **Backfill ran** — all NULL-band rows banded (≥5,000 → gross_candidate,
  rest noise); orphan_alert_at set on pending grosses only (confirmed/
  ignored/dismissed rows untouched).
- **Orphan drawer rewording — file BUILT + delivered** (index.html): title →
  "🧾 Apply Documented Tare", red alarm banner → calm blue "No scale tare —
  normal here (drivers use documented tares)…". Reflects reality: drivers
  never re-weigh for tare; documented tares are standard (Tare Source =
  Estimated). 3-spot diff, node --check clean.

## 🕘 VERIFY (do these, then check off)
- [ ] **Confirm the index.html PR actually MERGED** (not just pushed) and
      pages-build-deployment is green. Header still says v7.43.0/2026-08-30
      (version not bumped this round), so check GitHub, not the header.
- [ ] **End-to-end test resolve:** Scale tab → tap the Sep 1 10:08 PM
      38,290 lb row → should open FULL resolve drawer (hauler, tare, project,
      Create Ticket) under the new 🧾 title. Resolve with paper ticket 86445 +
      documented tare → confirm ticket in Tickets tab with correct net and
      Tare Source = Estimated. This exercises the whole chain built Sep 2.
- [ ] **Chips sanity check:** Scale tab chips should show real gross/noise
      counts instead of 0/0/0.

## ❓ OPEN QUESTION (answer before changing anything)
- [ ] **Do real ticketed vehicles ever come in under 5,000 lbs gross?**
      Backfill preview showed a CONFIRMED ticket at 4,560 lbs. If small
      vehicles are real occasional business, lower the Pi dead-band 5,000 →
      3,000 (still above the 2,060 phantom ceiling) AND the trigger threshold
      to match. If those were test-era rows, leave both at 5,000.

## ⏰ BEFORE SEPT 7 (Robert out Sept 7–14)
- [ ] **Michelle solo-ready:** uploads, review queue, Audit tab, LEED reports
      on her own login. The review queue now actually works (classifier live)
      — walk her through one real resolve. Red/old banners she may still see
      on stale cached pages = harmless.
- [ ] **Commit the classifier SQL to the repo** (trigger + function DDL) so
      the only copy isn't inside Supabase. Small .sql file, quick PR.

## 🔑 STANDING RULES (unchanged)
- CO₂e / carbon = INTERNAL-ONLY. Customer & LEED reports weight-based only.
- Per-project reports LEED-clean; only internal Portfolio view blends
  LEED + Non-LEED (Hayes = Non-LEED, flagged).
- Admin passphrase: never in code, repo, chat, or these instructions.
  Reset anytime in SQL Editor: `select admin_set_passphrase('new one');`
- Hauler approval lives in `approved_haulers` — never hard-code haulers.

## 🔒 SECURITY FOLLOW-UPS
- [ ] **Back up `scale_capture.py` + `scale_capture.service` to the repo —
      STILL NOT DONE. TOP of the list**, and now the Pi file has the Sep 2
      dead-band patch that exists nowhere else. Termius SFTP → Files →
      GitHub upload → branch/PR.
- [ ] **Rotate the Supabase anon key** (hard-coded in 4 places; appeared in
      chat again). Calm-moment coordinated pass across all four.
- [ ] **Rotate dispatcher tokens** (July 4 screenshot leak).
- [ ] **Review UNRESTRICTED tables/views** (incl. `v_admin_review`,
      `v_fleet_tares`, etc.) — decide per-view whether public read is needed.
- [ ] **Long-term: Supabase Auth for the admin app.**

## 🟢 EASY / QUICK WINS
- [ ] **Bulk-ignore the Sep 1 phantom ~2,000 lb rows** (now banded noise) so
      the 24h list is clean for Michelle. One-tap each, or one SQL pass.
- [ ] **Pending-gross banner wording** — still says "waiting for driver to
      return with tare," never true at this yard. Same treatment as the
      orphan banner. Bundle with the next index.html deploy.
- [ ] **Noise banner text says "below 10,000 lbs"** — actual line is 5,000
      now. Words only; bundle with the above.
- [ ] **Bump header version string** in the same bundled deploy.
- [ ] **Mark averaged-tare DX loads as "Estimated"** — careful SQL UPDATE,
      SELECT preview first (~32,540 standard tare).
- [ ] **Rename `2_pi_health.py` → `pi_health.py`** in repo.
- [ ] **Delete `reset-client.html`** (obsolete).
- [ ] **Remove stale `divertscan-capture.service`** from repo/knowledge.
- [ ] **Ops Pulse "Client Logins" tile shows 0** (reads locked table).
      Count-only RPC or show "—".

## 🟡 MEDIUM (an evening each)
- [ ] **Backlog cleanup: ~666 historical pending grosses** now correctly
      banded but forever "pending" (tickets were made via paper/driver page).
      Decide a cutoff (e.g. older than 7 days) → bulk `auto_dismissed` with a
      note. SELECT preview first. Post-trip, fresh head.
- [ ] **Priority: PDF batch ticket import** — Adobe Scan PDF → pdf.js split →
      existing OCR pipeline.
- [ ] **Cellular auto-recovery script** (Pi).
- [ ] **Tailscale auto-recovery script** (Pi).

## 🔵 CARBON DASHBOARD (internal-only, not urgent)
- [ ] LEED / Non-LEED filter on Portfolio carbon view (exclude Hayes).
- [ ] Consolidate + correct GWP factors (two hard-coded spots; EPA WARM v16,
      single editable source, cited).

## 🔴 HARDER / HIGH-STAKES
- [ ] Restart-safe debounce (Pi) — persist lock across restarts.
- [ ] Clean duplicate/mistagged historical rows (old 5500 ×4, restart pair).
- [ ] Move Pi serial off USB to 2nd GPIO UART (4G HAT uses primary). Hardware.

## ⚙️ ONGOING HABITS
- [ ] Never hard-power-cut the Pi: `sudo shutdown -h now`, green LED, unplug.
- [ ] Watch Pi Health on hot afternoons (green <155°F; amber = watch;
      red/🔥 = airflow now). Blow dust quarterly.
- [ ] index.html: backup → branch + PR → one change → deploy → verify → next.
      Bump the version string every time.
- [ ] Long file to the Pi? Repo + curl / SFTP / heredoc, never paste raw.
- [ ] Schema changes: `information_schema.columns` FIRST, guess never
      (Sep 2 lesson — `orphan_deadline` wasn't real).

## ⛔ DEFERRED / BLOCKED
- [ ] On-demand Wi-Fi printer — BLOCKED (printer side has no internet).
- [ ] Field diagnostic kit (7" monitor, USB keyboard, micro-HDMI, power bank).
- [ ] Multi-site rollout — Node Hardening Spec.
- [ ] Restrict hauler visibility for logged-in clients.

---
*Batch-ticket data rules (Hayes composition, aliases, buyer defaults, date
fallback) live in `DivertScan_Priority2_Batch_Ticket_Spec_v2.md` if built.*

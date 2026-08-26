# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Tuesday, August 25, 2026 (late).** Replaces the July 7 version.
Update the date whenever you change something.

**System status:** Fully operational. Admin app v7.38.0 (2026-08-25). Pi
captures + syncs. Client portal reconciliation + "Report for hauler" live and
used for the Aug 1–15 true-up with Jaguar (sent to Ross Aug 25, reply-all).
Monthly true-up process documented in `TRUE_UP_RUNBOOK.md` + `reconcile.py`.

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

---

## 📬 WAITING ON OTHERS — Aug 1–15 true-up (sent Aug 25)
- [ ] **Ross** — photo of his #85857 copy (ours is blank; scale log for 8/8 has
      no load near 5.94 T). Enter whatever comes back as Tare Source = Estimated.
- [ ] **Curtis** — paper for #87334 (8/1) and #87360 (8/4); origin of the seven
      7-digit numbers (2387799, 2387870, 4279809, 4280097, 4280387, 4281539,
      4283732).
- [ ] **Ross** — zones for Derrick's DX-00105/00107/00108 (8/11) and how he wants
      the five no-paper loads (DX-00090/00091/00105/00107/00108, 20.32 T)
      referenced on the invoice.
- [ ] **Dewey** — never answered on #85857. Not needed now; note the pattern.
- [ ] **Next true-up: Aug 16–31.** #87449 (re-dated 8/21 from the photo) lands
      here. Aug 21 already has a run of no-photo DX captures on Hayes / Walk-in
      (DX-00127…00130+). Run per `TRUE_UP_RUNBOOK.md`.

## ✅ DONE — Aug 24–25 true-up sessions
- Aug 1–15 reconciliation vs Ross's list: 101 of 119 match. All differences
  settled from ticket PHOTOS. Corrections made: #85955 gross 40,750 → 40,850
  (OCR read 8 as 7); #87449 date 8/12 → 8/21 (photo); nine Zone-D mis-tags
  fixed; tonnage-adoption button removed (v7.25); "Check weights vs scale"
  audit added (v7.26); restore of nine tonnages that had been overwritten with
  Ross's figures.
- Pattern confirmed four times tonight: Curtis's gross and tare are good, the
  handwritten NET underneath is often wrong, and Ross's list carries that net.
  "Ours come off the scale ticket" is the right framing with Ross.
- "Looks like #xxxxx" merge hints checked against photos on four DX captures —
  all four were different driver / different time. Weight-only matching is not
  evidence (see app fixes below).
- `TRUE_UP_RUNBOOK.md` + `reconcile.py` written; process should take <1 hr.

## 🛠 APP FIXES FROM THE AUG 25 SESSION (index.html, one PR each)
- [ ] **Reconciliation: typo-match a foreign number to our ticket** when
      date + tons + zone match (855979 → 85979). Tonight it counted the load in
      BOTH "not on their list" and "not our numbers"; the hauler PDF said 8
      tickets / 22.95 T when the truth was 7 / 19.52 T. The CSV note already
      knows ("probably 85979 with an extra digit") — act on it.
- [ ] **Reconciliation: a ticket with NO weight must not count as a match.**
      #85857 (blank) was silently treated as matching Ross's 5.94 T. Show it in
      its own line ("no weight on our ticket").
- [ ] **"Check weights vs scale" only checks 1,000 tickets** (Supabase default
      row cap) out of ~5,000. Page through in 1,000-row batches so it's a real
      full sweep.
- [ ] **"Looks like #xxxxx" hints match on weight alone** and change every run
      (DX-00105 said 87449, then 85978). Require same driver AND capture time
      within ~15 min of the paper ticket's Remarks time before suggesting; show
      driver + time in the hint. Otherwise drop the hint.
- [ ] **Decide: should the client portal show DX captures in reconciliation?**
      It does today (Ross can see DX-00090 etc. and their "looks like" hints).
      Probably fine — Ross was told about DX in July — but make it a decision.
      At minimum hide the "looks like" hints from the client view.
- [ ] **Hauler CSV**: the admin reconciliation modal's "Download CSV" is the
      internal export (status codes + DX rows). Add a CSV that matches the
      "Report for hauler" PDF section-for-section, or drop the CSV from what
      gets sent. Sent PDF-only Aug 25.
- [ ] **Restore query vs report read different weight fields** for #85885 and
      #85955 on Aug 24 (3.73 vs 3.675; 1.90 vs 1.40). Find which field
      `restore_scale_tonnages.sql` used and make the audit check read the same
      source the hauler report does (gross_lbs − tare_lbs).
- [ ] **OCR review: show the photo bigger + flag gross/tare digits** that
      disagree with the written net (85955: 8 read as 7). Cheap catch.

## 🔎 HARDWARE RESEARCH (Robert, separate chat)
- [ ] **Portable ticket scanner for the iPad** — Bluetooth, rechargeable,
      road-worthy. Goal: scan paper tickets to the PDF-batch-import pipeline
      (see MEDIUM) from the truck / out of town.
- [ ] **Thermal printer on the Pi** — the only permanent fix for the
      two-systems-of-record problem (paper book vs scale app). One numbered
      ticket with real gross/tare at the moment of weighing. Needs a
      conversation with Curtis before buying anything. (Supersedes the blocked
      "on-demand Wi-Fi printer" item below.)

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

## 🔑 STANDING RULES (unchanged)
- CO₂e / carbon = INTERNAL-ONLY. Customer & LEED reports are weight-based only.
- Per-project reports LEED-clean; only internal Portfolio view blends
  LEED + Non-LEED (Hayes = Non-LEED, flagged).
- Admin passphrase: never in code, repo, chat, or these instructions.
  Reset anytime in SQL Editor: `select admin_set_passphrase('new one');`

## 🔒 SECURITY FOLLOW-UPS
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
      See "Thermal printer on the Pi" under HARDWARE RESEARCH — that's the
      version worth doing.
- [ ] Field diagnostic kit (7" monitor, USB keyboard, micro-HDMI, power bank).
- [ ] Multi-site rollout — Node Hardening Spec for repeatable builds.
- [ ] Restrict hauler visibility for logged-in clients.

---
*Batch-ticket data rules (Hayes composition, aliases, buyer defaults, date
fallback) live in `DivertScan_Priority2_Batch_Ticket_Spec_v2.md` if built.*

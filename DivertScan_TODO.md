# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Thursday, August 6, 2026.** Replaces the Aug 5 version.
Update the date whenever you change something.

**This file is DALMEX PRODUCTION only.** Metropolitan Recycling (second site)
has its own list: `METROPOLITAN_TODO.md`.

**System status:** DalMex fully operational — Pi captures + syncs, client portal
login working, admin client management + login log via passphrase-gated RPCs,
Pi health monitoring live (temp/throttle/disk every 5 min → Scale tab widget).

**Aug 6 — SITE VISIT DONE.** Demo shown to Mark, Greg and Haniya (receptionist).
All three positive; Haniya especially, and she is the one who would use it daily.
Indicator inspected, parts list sent. See the Metropolitan section below.

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

## 🏗️ METROPOLITAN — SEPARATE FILE

Metropolitan Recycling (second site) now has its own list:
**`METROPOLITAN_TODO.md`**. Nothing on that list touches DalMex production.

One shared item lives on THIS list, because the work happens in the DalMex
codebase: the config/branding consolidation below. Doing it makes the
Metropolitan fork clean instead of a divergent copy.

**Prep work in the DalMex codebase (do this first, it makes the fork clean):**
- [ ] Facility name, address, phone, contact, and email are hard-coded as
      literal strings in FOUR export functions instead of reading the single
      `DS.FACILITY` object: `exportAllXLSX`, the LEED compliance text export,
      `shareTicketSummary`, and the `client.html` footer. Point them all at
      `DS.FACILITY`. This is the difference between a template and a fork.
- [ ] Also loose and needing a per-site home: `<title>`, header `<h1>`, the
      "LEED MRp2/MRc5" subtitle, `deviceLabel` ("Dalmex Scale 01") and the
      header in `scale.html`, `manifest.json`, and the app icon.

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
      **Aug 5 note:** `2_pi_health.py`'s own install notes say to keep a
      PLACEHOLDER in the repo — the real key got committed instead. That one
      drifted. Do this before Metropolitan goes up, so the second site starts
      with the placeholder habit intact.
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

- [ ] **Curtis — paper scale ticket entry (new Aug 6).** Curtis is willing to
      take over entering the third-party paper scale tickets that Robert
      currently scans in himself. He is ALREADY reading these tickets and
      keying them into a spreadsheet manually, so this costs him nothing extra.
      Key insight: **do not build a spreadsheet upload — replace the
      spreadsheet.** If he keys straight into DivertScan he does the work once;
      if we build an import, he does it twice.
      - [ ] Ask Curtis what columns are in his spreadsheet FIRST. That defines
            the form, and will probably surface fields not currently captured.
      - [ ] These are hand-keyed third-party weights, NOT Pi-captured. They must
            be flagged so they are distinguishable from sealed captures —
            tare source Estimated, or a separate entry-source field.
      - [ ] Curtis needs a login scoped to entry only, not full admin.
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
- [ ] Restrict hauler visibility for logged-in clients.
- ~~Multi-site rollout — Node Hardening Spec~~ → NO LONGER DEFERRED. Spec v1
  drafted Aug 5; Metropolitan is the first site using it. See the Metropolitan
  section above.

---
*Batch-ticket data rules (Hayes composition, aliases, buyer defaults, date
fallback) live in `DivertScan_Priority2_Batch_Ticket_Spec_v2.md` if built.*

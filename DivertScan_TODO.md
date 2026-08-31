# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Sunday, August 30, 2026 (late).** Replaces the July 7 version.
Update the date whenever you change something.

**System status:** Fully operational. Pi captures + syncs. Admin app at
**v7.42.0 confirmed live; v7.43.0 uploaded — deploy check pending** (header
label is the proof). Version discipline works: bump VERSION+BUILD on every
index.html change.

**Two systems, two ways to edit:**
- **Pi / `scale_capture.py`** — `/home/pi/scale_capture.py`, run by
  `scale_capture.service`. Edit via Termius (SSH). Never paste long files into
  the terminal from iPad (drops chunks) — put the file in the GitHub repo and
  `curl` the raw URL down, or Termius SFTP. Heredocs (`sudo tee << 'EOF'`) for
  multi-line configs.
- **`index.html`** (~12.1k lines) — Claude edits an uploaded copy and returns
  the full file; Robert uploads via **github.com → Add file → Upload files →
  new branch + PR → merge → verify header**. ALWAYS back up first. One change
  at a time.
- **WORKFLOW CORRECTION (Aug 30):** Robert does NOT use Working Copy — all
  repo file movement is GitHub **web upload**. iPad trap: re-downloading a
  file makes `config 2.js` etc. in Downloads — always grab the NEWEST download
  and clear old ones. After upload, GitHub sometimes creates the branch but no
  PR: check the Pull requests tab; if 0 open, branch dropdown → pick the
  branch → Contribute → Open pull request. "Files changed 0" on a PR = wrong/
  duplicate branch, the real one shows the actual file count.

---

## 🚨 SEPT 7 DEADLINE — Robert out Sept 7–14. Michelle solo.
- [ ] **Schedule Michelle's dry run — target Wed Sep 2 / Thu Sep 3,** second
      solo run Fri Sep 4. MICHELLE_RUNBOOK.md is written. Dry-run material:
      the 4 broken tickets (#87475 17.2T zero-tare, #85857, #87447, DX00134).
- [ ] **Fill the scanner-setup blanks in MICHELLE_RUNBOOK.md.**
- [ ] Michelle must be able to run: uploads, review queue, Audit tab, LEED
      reports. She has her own admin login.

## 🔥 THIS WEEK — production data protection
- [ ] **Merge the scale.html + client.html PR** (pair delivered Aug 30, one
      PR, 2 files, DivertScan repo root). scale.html: tare must be ≥33% of
      gross (kills the 2,000-lb-idle-as-tare bug that minted 17–18T phantom
      tickets) + >12T driver warning + device light/dark. client.html: ALL
      CO₂e code removed, "Data through [date]" stamp, print stylesheet.
- [ ] **Verify v7.43.0 deployed** (header label). Contains: ⚖️ Suspect
      Weights in Pending Review (tare/gross <10k lb, missing tare, net >12T),
      reviewed reconciliations collapse to one line + 🗑 delete, density pass
      + iPhone Pro Max CSS (needs real-phone screenshots to verify).
- [ ] **Check DX-00145** (possible 18.32T phantom from Aug 30) — should be
      caught by Suspect Weights once v7.43 is confirmed live.
- [ ] **Strip co2e_avoided from the customer API:** run in Supabase SQL
      Editor: `select pg_get_functiondef('client_tickets'::regproc);` → paste
      output to Claude → Claude returns the corrected function SQL.

## ✅ DONE — Aug 30 session (settled, don't reopen)
- 1,000-ticket silent cap killed in ALL reports. Hospital true numbers:
  1,082 tickets, 72% cumulative vs 75% target; project runs to 2031, target
  reachable.
- CO₂e stripped from 4 customer exports. Sign out button added. Queue
  inspector added → 5 stuck records were May smoke-test fakes, deleted.
- GC confirmed = McCarthy Vaughn Partnership (MVP); client = Jaguar (hauler).
- v7.42.0 shipped + confirmed; v7.43.0 built + uploaded.
- **Hub (separate repo) shipped 0.7.0 → 0.7.2 same day, deployed +
  header-verified.** See Hub section below.

## 🔑 STANDING RULES (unchanged)
- CO₂e / carbon = INTERNAL-ONLY. Customer & LEED reports weight-based only.
- Per-project reports LEED-clean; only internal Portfolio blends LEED +
  Non-LEED (Hayes = Non-LEED, flagged).
- Haulers via `approved_haulers` table — never hard-coded.
- Every ticket: Weigher + Tare Source (Measured/Estimated; standard/averaged
  tares like DX ~32,540 = Estimated).
- Admin passphrase: never in code, repo, chat, or these instructions.
- One change → deploy → verify → next. Back up index.html before editing.

## 🔒 SECURITY FOLLOW-UPS (carried from July — still open)
- [ ] **Back up `scale_capture.py` + `scale_capture.service` to GitHub —
      STILL NOT DONE. Only copy is the Pi's SD card (has died before).**
      Termius SFTP → iPad Files → GitHub web upload.
- [ ] Rotate the Supabase anon key (hard-coded in 4 places; appeared in chat
      again). Coordinated pass; Pi buffers during the swap.
- [ ] Rotate dispatcher tokens (leaked in a July 4 screenshot).
- [ ] Review UNRESTRICTED tables/views (`project_summary`, `v_admin_review`,
      `v_all_drivers`, `v_fleet_tares`, etc.) — lock what doesn't need
      public read.
- [ ] Long-term: Supabase Auth for the admin app.

## 🟢 EASY / QUICK WINS (carried)
- [ ] Mark averaged-tare DX loads "Estimated" — one careful SQL UPDATE
      (SELECT preview first).
- [ ] Rename `2_pi_health.py` → `pi_health.py` in repo.
- [ ] Delete `reset-client.html` (obsolete).
- [ ] Remove stale `divertscan-capture.service` from repo/knowledge.
- [ ] Ops Pulse "Client Logins" tile reads locked table, shows 0 — point at
      count-only RPC or show "—".

## 🟣 PORTAL FEATURE IDEAS — awaiting Robert's ranking
- [ ] "X tons to target" line · photo-proof counts · PDF snapshot · monthly
      email digest.

## 🟡 MEDIUM (an evening each — carried)
- [ ] PDF batch ticket import (Adobe Scan PDF → pdf.js split → OCR pipeline).
- [ ] Cellular auto-recovery script (Pi). Tailscale auto-recovery script (Pi).

## 🔵 CARBON DASHBOARD (internal-only, carried)
- [ ] LEED/Non-LEED filter on Portfolio carbon view (exclude Hayes).
- [ ] Consolidate GWP factors to one editable source (EPA WARM v16, cite it).

## 🔴 HARDER / HIGH-STAKES (carried)
- [ ] Restart-safe debounce (Pi). Clean duplicate historical rows
      (fresh-head task). Move Pi serial to 2nd GPIO UART (hardware).

## 🏗 DALMEX HUB (dalmex-Dispatch- repo — separate system, own Supabase)
**Live at 0.7.2 (Aug 30).** Shipped today: damaged-trailer two-tap confirm at
Mark Loaded + Assign (logged) · cancel-after-Assigned forces driver
notification (text or "I already called," logged) · pencil-in driver at order
creation (ONE heads-up text) · swap/return field on New Order, visible on
shop build list · owner role gets Dispatch tab · shop "Out the door" strip
(trailer, where, driver, delivered time) · NEW + LOADED status tags pulse.
- [ ] **Branch cleanup:** delete `il-in-d` (empty dup) + `0.7.2` (merged);
      check `hub-v931` and `hub-v692b` — if "ahead of main," screenshot the
      commit for Claude; if even, delete. Nothing new lands before this.
- [ ] `ORDER_LIFECYCLE_SPEC.md` (written Aug 30) → commit to repo root; add a
      pointer line in DALMEX_HUB_SCOPE.md. Not yet built from it: driver
      delivery-link polish per spec, auto-Billing handoff on Delivered,
      RETURNING/BACK-AT-YARD as explicit states.
- [ ] Role/permission audit: real logins per person before Billing goes
      live; Michelle·office currently sees more nav than owners — confirm
      intended.
- [ ] Hub queue: Tasks board · mill loads · Ooma/Zapier inbox wiring · smart
      reorder · standing orders.

## ⚙️ ONGOING HABITS
- [ ] Never hard-power-cut the Pi: `sudo shutdown -h now`, green LED, unplug.
- [ ] Watch Pi Health on hot afternoons (green <155°F; amber = watch;
      red/🔥 = airflow now). Dust quarterly.
- [ ] index.html: backup → branch + PR → one change → deploy → verify → next.
- [ ] Long file to the Pi? Repo + curl, never paste.

## ⛔ DEFERRED / BLOCKED (unchanged)
- [ ] On-demand Wi-Fi printer (printer has no internet). Field diagnostic
      kit. Multi-site rollout / Node Hardening Spec. Restrict hauler
      visibility for logged-in clients.

---
*Batch-ticket data rules live in `DivertScan_Priority2_Batch_Ticket_Spec_v2.md`.*
*Hub order-lifecycle design lives in `ORDER_LIFECYCLE_SPEC.md` (dalmex-Dispatch- repo).*

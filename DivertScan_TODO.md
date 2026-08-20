# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Wednesday, August 19, 2026 (late).** Replaces the July 7 version.
Update the date whenever you change something.

**System status:** Fully operational. Pi capturing continuously since April 10
(912 `weight_capture` events in `leed_audit_log`, latest 7:48 PM Aug 19). Client
portal login working. Admin client management + login log via passphrase-gated
RPCs. Pi health monitoring live.

**⚠️ OPEN ISSUE — per-project XLSX exports can blend ALL projects.** Found
Aug 19. Data is sound; the REPORTS were wrong. See the top section below.

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

## 🚨 TOP PRIORITY — EXPORT SCOPING BUG (found Aug 19)

**What happens:** a per-project XLSX can contain EVERY project's tickets while
the header names one project. Root cause in `index.html`:

```js
if (this._showingAllProjects) {
    var fresh = await this.supabase('tickets?order=created_at.desc&limit=200');
    if (fresh) this.state.tickets = fresh;      // ← ALL projects, unfiltered
}
...
var proj = this.state.currentProject;           // header from here
var allTickets = this.state.tickets;            // data from there — never reconciled
```

The `if (!proj)` guard does NOT protect: `currentProject` stays set in All
Projects view, so the check passes. Note the `limit=200` — All Projects view is
also silently truncated (June hospital alone is 217 tickets).

- [ ] **Fix the scoping.** Add a helper and route every per-project export
      through it. Portfolio export keeps reading `state.tickets` (blending is
      its job).
      ```js
      _projectTickets() {
          var proj = this.state.currentProject;
          if (!proj) return [];
          return (this.state.tickets || []).filter(function(t) {
              return t.project_id === proj.id;
          });
      },
      ```
      In `exportAllXLSX`, swap `this.state.tickets` → `this._projectTickets()`.
      Still need the ~20 lines where the MONTHLY XLSX export builds its
      `tickets` var (function ends `showToast('Downloaded '+monthName+...)`).
- [ ] **Test `client.html` — NOT YET DONE.** Every client has 2+ projects
      (Ross Mulford: 10, incl. Children's Hospital AND Hayes; Rob Van: 16).
      If the portal shares this bug, clients can generate blended files
      unaided. Test: log in as Rob Van → Children's Hospital → July.
      191 tickets = clean. 253 = same bug.
      Mitigation if it blends: temporarily trim `client_project_access`.
- [ ] **Log exports to `leed_audit_log`.** `addAuditEntry` writes to
      localStorage only — ZERO export rows in the DB. No server-side record of
      what was issued, when, or containing what. That's a LEED chain-of-custody
      gap and it's why Aug 19 took hours instead of one query.
- [ ] **Cover-sheet fields (cosmetic, same PR):** Hauler line renders `—` even
      though `projects.waste_hauler` is set — export isn't reading that column
      (likely looking for `hauler`). And `general_contractor` is null, so
      "GC / Client" falls back to `client` and names the hauler as the GC.

### Verified true numbers (check any export against these)
| Project / month | Real | If blended |
|---|---|---|
| CH 2026-07 | **191 tix, 569.57 T, 76.157%** | 253 tix, 732.53 T, 75.084% |
| CH 2026-06 | **217 tix, 808.85 T, 75.42%** | 293 tix, 988.08 T, 76.73% |
| CH Jul 1–15 | **64 tix, 204.91 T, 76.08%** | 88 tix, 284.00 T, 75.30% |
| CH Jul 16–31 | **127 tix, 364.66 T, 76.20%** | 165 tix, 447.91 T, 74.74% |
| CH Aug 1–15 | **114 tix, 393.61 T, 75.07%** | 189 tix, 568.43 T, 77.80% |

Ticket count is the fastest tell. Ross bills 1st–15th and 16th–EOM, so check
those periods, not just calendar months.

## 🔴 LEED — CUMULATIVE RATE IS 72.14%, NOT 75%+

- [ ] **Confirm whether the Children's Hospital submittal is scored monthly or
      project-to-date.** MRc credits are normally scored on TOTAL project waste.
      Project-to-date: **975 tickets, 3,318.92 T, 2,394.20 diverted = 72.14%**
      — about **95 diverted tons short of 75%**.
      Monthly: Jan 65.6 / Feb 66.4 / Mar 65.3 / Apr 67.8 / May 70.3 / Jun 75.4 /
      Jul 76.2 / Aug 74.9. Target was only cleared in June and July.
      Recent monthly reports showing 75–76% do NOT reflect where the credit
      stands. Raise this with whoever owns the submittal BEFORE filing.
- [ ] **Watch Aug 1–15: 75.07%**, clearing by ~0.3 tons. Period still open.

## ✅ DONE — Aug 19 session (July 2026 Children's Hospital reconciliation)
- **July closed and verified: 191 tickets, 569.57 T, 433.77 diverted, 76.157%.**
  Export regenerated and matches the DB exactly.
- **Ross's "19 missing tickets" was wrong** — 17 were already in DivertScan with
  matching dates and weights (largest gap 0.01 T = rounding). His three zone
  "corrections" (85816→C, 85818→A, 85819→A) were already applied. He was working
  from a stale copy.
- **Added 85813 (1.60 T, 7/27) and 87726 (1.14 T, 7/25)** — genuinely missing,
  and not found in the paper stack by two independent searches (Robert +
  Michelle). Entered with `tare_method='estimated'`, `mix_source=
  'estimated_project_mix'`, `scan_type='manual_reconciliation'`, basis in notes.
  Tares derived from same-day neighbours (85814 → 32,700; 87723/87724 → 32,762);
  gross calculated, not weighed. Mix = July project average rescaled to 77%
  (40 wood / 17 OCC / 17 metal / 3 concrete / 23 landfill).
- **Removed duplicates DX-00077 / DX-00078** — same-load twins of paper tickets
  87723 / 87724 (identical gross+tare+net, same driver Derrick, 7/25). Cause
  confirmed: driver used the scale app AND dropped a written ticket. One driver,
  one day, 2 of 48 DX rows — not a habit.
  **A FK on `scale_weights.ticket_id` blocks deleting any Pi-backed ticket.**
  Resolved by repointing the hashed Pi readings onto 87723/87724 (they had none)
  and setting `tickets.source_weight_id`, then deleting the DX rows. Nothing lost.
- **Snapshot `tickets_backup_20260819_july_fix` (191 rows) — DO NOT DROP** until
  the LEED report is accepted. A SQL change never appears in the app Audit tab,
  so this table is the audit record.
- **`projects.waste_hauler` set** to Jaguar Waste Management (export still
  ignores it — see above).

### Notes worth keeping from this session
- **DX- prefix = driver check-in via the scale app** (`scan_type='pi_scale'`,
  backed by a hashed `scale_weights` row). Paper tickets are `batch_ocr` — an
  OCR read of a photo, `human_verified=false`, no scale_weights row. **The Pi
  row is the stronger evidence**, not the paper.
- **46 of 48 July DX rows have no paper counterpart (~85 T).** Ross reconciles
  off paper and structurally cannot match them. Explain before he asks.
- **Ticket times on hauler lists come from the handwritten "Remarks" line.**
  87723's paper says 11:56 AM; the Pi timestamped the same weighing at 3:18 PM.
  Fine for tonnage, unreliable for load times. Pi is the source of truth.
- **No tare is ever measured by the Pi** — every `scale_weights` row on 7/25 is
  `weight_type='gross'`, zero tares. All tares come from stored per-truck
  values. Bigger than the "~32,540" framing in Easy Wins below.
- **Remove Duplicate Tickets tool matches on ticket NUMBER only** — it cannot
  catch same-load twins under different numbers, and it will hit the
  `scale_weights` FK on any Pi-backed row.
- **Unresolved (do not auto-delete):** 87539/87627 (7/14, both 2.05 T) and
  87276/87704 (7/24, both 1.90 T) — identical gross AND tare, both paper. Both
  use tare 33,000, the most common value, so likely coincidence. Photos settle it.
- **87725** appears in no record. DX-00079 (7/25, same truck/tare, no paper
  twin) is a candidate. Ask Ross whether it exists.

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
- [ ] **Mark reused-tare DX loads as "Estimated"** — one careful SQL UPDATE
      (preview with SELECT first). NOTE: the old "~32,540 standard tare"
      framing was wrong. Only 3 DX rows carry exactly 32,540. The real pattern
      is tares REUSED across a run — 12 tare values covering 36 of 48 July DX
      rows, so ~24 rows carry a tare weighed on an earlier load, sometimes the
      previous day. Those 24 are the Estimated candidates. Set `tare_method`,
      not `tare_source` (the latter is null throughout — dead column).
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

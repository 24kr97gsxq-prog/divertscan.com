# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Saturday, August 8, 2026 (evening).** Replaces the July 9 version
and the earlier August 8 draft. Update the date whenever you change something.

**System status:** Fully operational. Pi captures + syncs. Photo upload pipeline
RESTORED today after 12 days silently broken (root cause below). Client portal
zone picker live. `project_zones` live, Children's Hospital seeded A–F. Scale
page has day/night display and a soft zone prompt.

**Files, and how each gets edited:**
- **Pi / `scale_capture.py`** — `/home/pi/scale_capture.py`, run by
  `scale_capture.service`. Edit via Termius (SSH). LESSON LEARNED July 7: never
  paste long files into the terminal from iPad (drops chunks) — put the file in
  the repo and `curl` the raw URL down to the Pi, or use Termius SFTP.
  Multi-line configs: `sudo tee << 'EOF'` heredocs, not nano paste.
- **`index.html`** (~12.8k lines) — Claude patches an uploaded copy and returns
  the full file (unique anchors, additive diff, node --check). Robert uploads it
  renamed → new branch + PR → merge → verify. Back up first. One change at a time.
- **`client.html` (~2.3k) / `upload.html` (~460) / `scale.html` (~2.8k)** — same
  workflow, and all SEPARATE from index.html. A client.html PR never requires
  touching index.html.
- **ALWAYS download fresh from main before sending a copy for patching.** The
  project-knowledge sync lags what is deployed. LESSON LEARNED Aug 8: rounds were
  wasted because two different files were both named `client.html` and the wrong
  one got merged. Ask Claude for a marker string to grep for before merging.

---

## ✅ ROOT CAUSE FOUND AND FIXED — Aug 8
**Every photo upload had been failing silently since July 27.**
`photo_queue` had RLS enabled with an INSERT policy for `anon` but **no SELECT
policy**. Both uploaders send `Prefer: return=representation` on POST, which asks
Postgres to read the row back after writing it. The read was denied and the
insert was rolled back with it. Storage succeeded, so the photo landed in the
`ticket-photos` bucket with no database row pointing at it — and the page
reported success either way.

Fix applied:
```sql
create policy anon_select_photo_queue on photo_queue
  for select to anon using (true);
```
This explains, all at once: empty client History tab, client badge showing 0,
admin "5 pending" over an empty Photo Review Queue, and nothing in the Audit tab.

**VERIFIED WORKING:** two portal uploads → queue → OCR → attached to tickets
87323 and 87318 (both 2026-07-29, previously photo-less).

- [ ] **Ask Raul whether he uploaded any tickets between July 27 and Aug 8.**
      If he did, those images are still in the `ticket-photos` bucket with no
      `photo_queue` row. Recoverable — the storage path encodes project id and
      timestamp — but only while they are still there. TIME-SENSITIVE.
- [ ] **Test `upload.html` from a phone** to confirm the field side is alive
      again. Same table, same policy, so it should be.
- [ ] **Replace the open SELECT policy with a scoped RPC.** `using (true)` means
      anyone holding the anon key (public, in five places) can read the whole
      queue. It restores how the app was built, but the right fix is
      `client_photo_queue(p_cid)`, same pattern as `client_tickets` /
      `client_zones`. Pairs with the Supabase Auth item below.

## ✅ ALSO SHIPPED — Aug 8
- **`project_zones` table + `client_zones` / `client_set_zone` RPCs.** Single
  source of truth for which zones exist per project — same pattern as
  `approved_haulers`, replacing hard-coded A/B/D/E/F lists. Children's Hospital
  (`5b97f99a-176c-40e1-bfa8-c75e649feaf9`, LEED v4) seeded A–F. Audit columns
  `tickets.zone_set_by / zone_set_at / zone_set_source`. `client_set_zone`
  touches ONLY zone + audit columns and rejects any value not already active on
  that project, so the Zone Breakdown grouping cannot splinter into
  "C" / "c" / "Zone C". Adding a zone later needs no deploy — one INSERT.
- **Client zone picker in the portal.** Clients may change zone on any of their
  tickets, any time (decision made Aug 8); traceability via the audit columns is
  what makes that safe. Card hides itself on projects with no zones (e.g. Hayes).
  LESSON LEARNED: a ticket can be opened from the dashboard table OR the Month
  Detail list, and the save must refresh both or it looks like it did not save.
- **`scale.html` zone capture.** Zone C added. Soft gate: on zoned projects the
  confirm button waits for the driver to tap a zone OR "Not sure / skip" —
  always satisfiable in one tap, guarded three ways, fails open so it can never
  strand a truck. Root cause of the 328 blank zones was simply that the field was
  optional and got scrolled past; the insert was always correct.
- **`scale.html` day/night display.** ☀️/🌙 toggle in the header, remembered per
  device, first launch guesses from the clock (6am–7pm = day), applied before
  first paint. Day mode re-picks every accent dark enough to hold contrast on
  white — the night cyan/green are invisible in sun. Header and status bar stay
  dark in both. NEEDS OUTDOOR TESTING on the actual tablet.
- **Client upload screen rebuilt** for one-handed phone use: project dropdown →
  scale ticket → debris → submit. Ticket # field REMOVED (OCR reads it, and the
  review queue groups by `batch_id` and approves a batch as a unit, so debris
  photos are tied to their scale ticket without anyone typing). Hauler and notes
  collapsed behind a toggle. Camera is a tall thumb target; submit sticks to the
  bottom. Capped at 520px so iPad/PC read as a column, edge-to-edge under 520px.
- **`batch_id` on client uploads.** Previously only `upload.html` set it, so the
  admin queue fell back to grouping by submitter+project+5-minute window and
  merged separate client submissions into one batch.

## 🔴 DECISIONS NEEDED (both block Curtis)
- [ ] **`photo_queue.submitted_by` stores the HAULER, not the uploader.**
      `client.html` sets it from the `uHauler` dropdown, so today's test rows read
      "Rob Van" and a photo from a Children's Hospital super would read "Jaguar
      Waste Management." Curtis will read this column all day and it cannot tell
      him whether a photo came from a client, a driver, or Robert. Needs a
      decision on where the hauler goes instead; changes admin queue display.
      DO THIS BEFORE match.html.
- [ ] **Should haulers be able to change zones?** Four accounts have Children's
      Hospital access: robert@xrayce.com, ross@jaguarwastemanagement.com, and two
      @skywardtransportation.com. Two are haulers, not the GC. With the picker
      live they can relabel zones on that project. Traceable, but likely not
      intended. Small addition to `client_set_zone` if not.

## 🚀 QUEUED DEPLOYS — patched, not yet merged
- [ ] **`upload.html`** — `tNum` was read from the field, shown in the success
      message, then hard-coded as `ticket_number:null` on insert. Now saved.
      (NOTE: the equivalent line in `client.html` was NOT a bug — the label reads
      "debris only — scale tickets read by AI" and the null was intentional.
      That change was reverted.)
- [ ] **`index.html`** — OCR prompt still says zone is `A/B/D/E/F`. Until fixed, a
      handwritten C returns null or gets squeezed into a wrong letter, which then
      appears in the LEED Zone Breakdown looking legitimate. Two unique strings,
      both `A/B/D/E/F` → `A/B/C/D/E/F`: the "- Zone: single letter…" line and the
      `"zone":"<A|B|D|E|F or null>"` line. VERIFY by scanning a ticket marked C.

## 🔑 STANDING RULES
- CO₂e / carbon = INTERNAL-ONLY. Customer & LEED reports weight-based only.
- Per-project reports LEED-clean; only the internal Portfolio view blends
  LEED + Non-LEED (Hayes = Non-LEED, flagged).
- Haulers live in `approved_haulers`; zones live in `project_zones`.
  Never hard-code either.
- Admin passphrase never in code, repo, or chat. Reset in SQL Editor:
  `select admin_set_passphrase('new one');`

## 🔒 SECURITY FOLLOW-UPS
- [ ] **Back up `scale_capture.py` + `scale_capture.service` to the repo —
      STILL NOT DONE. TOP of the list.** Only copy is the Pi's SD card, which has
      died before. Termius SFTP → iPad Files → GitHub upload.
- [ ] **Rotate the Supabase anon key.** Hard-coded in five places (Pi
      scale_capture.py, Pi pi_health.py, index.html, scale.html,
      client.html/upload.html). One coordinated pass at a calm moment.
- [ ] **Rotate dispatcher tokens** (leaked in a July 4 screenshot).
- [ ] **Review remaining UNRESTRICTED tables/views**: `project_material_t...`,
      `project_summary`, `v_admin_review`, `v_all_drivers`, `v_dispatcher_ro...`,
      `v_driver_logbook`, `v_fleet_tares`, `v_hauler_drivers`. NOTE: locking down
      `photo_queue` in this effort is what broke uploads for 12 days. When
      restricting a table, check every page that READS it, not just writes.
- [ ] **Supabase Auth for the admin app AND the portal.** Priority raised twice
      today: `client_set_zone` authorizes on `p_cid` alone (a client UUID out of
      localStorage, effectively a bearer token) for a WRITE, and the photo_queue
      SELECT policy is wide open. Auth is the proper fix for both.

## 🟢 EASY / QUICK WINS
- [ ] **Mark averaged-tare DX loads as "Estimated"** — one careful SQL UPDATE
      (preview with SELECT first). Tickets with the standard ~32,540 tare.
- [ ] **Commit `project_zones_setup.sql` to the repo** alongside
      `admin_unlock_setup.sql`, as a record of what has been run.
- [ ] **Rename `2_pi_health.py` → `pi_health.py`.**
- [ ] **Delete `reset-client.html`** (obsolete — superseded by in-app management).
- [ ] **Remove the stale `divertscan-capture.service`** from repo / project
      knowledge (wrong name + path; the real one is `scale_capture.service`).
- [ ] **Remove dead `filterUploadProjects()`** from client.html — orphaned when
      the upload project list became a dropdown.
- [ ] **Admin "5 pending" badge vs. empty queue** — recheck now that the policy is
      fixed. May have resolved itself; if not, the badge and the queue are
      reading `photo_queue` differently.

## 🟡 MEDIUM (an evening each)
- [ ] **Curtis match access — build `match.html`.** Decision made Aug 8: a
      separate limited page, NOT a login to the full admin app. Curtis needs one
      workflow (pending batches → match to scale ticket → confirm); index.html
      also holds client credentials, the purge-queue button, Samsara settings and
      portfolio carbon. Cost is porting `loadPhotoQueue` + the confirm path out of
      index.html (batch grouping starts ~line 9855). Fallback: a scoped view
      inside index.html. BLOCKED on the `submitted_by` decision above.
- [ ] **Quick ticket search in the client portal** — top-bar search across all of
      a client's projects. `client_tickets` already scopes to their projects and
      `allTix()` caches the set, so it is a client-side filter, no new RPC.
      CAREFUL: tapping a result must switch to that project first, because the
      ticket detail reads `P.cp.leed_version` — opening a Hayes ticket while
      Children's Hospital is selected would render Non-LEED data with LEED
      framing. Do NOT "just fall back to the full cache."
- [ ] **Replace the remaining hard-coded zone dropdowns with `project_zones`.**
      Three filters in client.html, the button row in scale.html, and
      `projectUsesZones()` in scale.html is a regex on the project name
      (`/children/i`). scale.html uses the anon key directly, so this needs a read
      policy or an RPC for `project_zones`.
- [ ] **Backfill the 328 blank zones?** No way to recover them from data — nobody
      recorded which zone those loads came from. Options: assign by hand via the
      portal picker or admin, or leave them "Unassigned" in the Zone Breakdown.
      Worth deciding before Children's Hospital's next LEED submission — that is a
      conversation with them, not a code change.
- [ ] **PDF batch ticket import** — one Adobe Scan PDF → pdf.js page split →
      existing OCR pipeline. Solves out-of-town "upload 50 tickets." Overlaps the
      Curtis work; consider building alongside match.html.
- [ ] **Day/night display for the portal and uploader** if crews use them
      outdoors. Only scale.html has it.
- [ ] **Cellular auto-recovery script** (Pi) — checks usb0 IP + default route.
- [ ] **Tailscale auto-recovery script** (Pi).

## 🔵 CARBON DASHBOARD (internal-only, not urgent)
- [ ] LEED / Non-LEED filter on the Portfolio carbon view (exclude Hayes).
- [ ] Consolidate + correct GWP factors (two hard-coded spots, ~line 1424 and
      ~3650; align to EPA WARM v16, single editable source, cite it).

## 🔴 HARDER / HIGH-STAKES
- [ ] Restart-safe debounce (Pi) — persist lock across restarts (#17/#18 case).
- [ ] Clean duplicate/mistagged historical rows (old 5500 ×4, restart pair).
- [ ] Investigate the July 13 bulk insert — eleven `photo_queue` rows sharing an
      identical timestamp to the microsecond (`16:23:40.980265`). Not a person
      taking photos. Probably a backfill; worth knowing what did it.
- [ ] Move Pi serial off USB to 2nd GPIO UART (4G HAT uses primary). Hardware.

## ⚙️ ONGOING HABITS
- [ ] Never hard-power-cut the Pi: `sudo shutdown -h now`, green LED, unplug.
- [ ] Watch Pi Health on hot afternoons (green <155°F, amber = watch,
      red/🔥 = check airflow). Blow dust quarterly.
- [ ] Backup → branch + PR → one change → deploy → VERIFY → next.
- [ ] Long file to the Pi? Repo + curl, never paste.
- [ ] **When a page "does nothing," check whether the failure is even reportable.**
      Three separate silent-failure paths cost most of Aug 8: a disabled button
      that swallowed taps, a promise that never settled, and an insert whose
      result was never inspected. Also: Robert is on iPad — the browser console is
      not reachable, so errors must surface on screen.

## ⛔ DEFERRED / BLOCKED
- [ ] On-demand Wi-Fi printer — BLOCKED (printer side has no internet).
- [ ] Field diagnostic kit (7" monitor, USB keyboard, micro-HDMI, power bank).
- [ ] Multi-site rollout — Node Hardening Spec for repeatable builds.
- [ ] Restrict hauler visibility for logged-in clients. NOTE: overlaps the
      hauler/zone decision above — two hauler accounts already have Children's
      Hospital portal access.

---
*Batch-ticket data rules (Hayes composition, aliases, buyer defaults, date
fallback) live in `DivertScan_Priority2_Batch_Ticket_Spec_v2.md` if built.*

# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Monday, August 10, 2026 (night).** Replaces all earlier versions
including the Aug 8 drafts. Update the date on every change.

**System status:** Fully operational and PRODUCTION-PROVEN. The complete loop is
verified with real tickets: client uploads from a phone → OCR reads ticket #,
date, weights, DRIVER, and ZONE off the paper → haulers canonicalize themselves
→ duplicates keep the original → queue flips ✅ on both sides. Hauler variant
problem closed permanently. updated_at triggers live on tickets + photo_queue.

**Files, and how each gets edited:**
- **Pi / `scale_capture.py`** — `/home/pi/scale_capture.py`, run by
  `scale_capture.service`. Edit via Termius (SSH). Never paste long files from
  iPad — repo + `curl`, or Termius SFTP. Heredocs for multi-line configs.
- **`index.html`** (~13.1k) / **`client.html`** (~2.4k) / **`upload.html`**
  (~460) / **`scale.html`** (~2.8k) — Claude patches an uploaded copy, returns
  the full file (unique anchors, node --check). Upload renamed → branch + PR →
  merge → verify. All four are SEPARATE files.
- **Always download fresh from main before sending a copy for patching.** Check
  what's deployed yourself: open the RAW file in Safari → share → "Find on
  Page" → search the marker string Claude gives you.

---

## 🚀 DEPLOY QUEUE
- [ ] **`index.html`** (staged Aug 10 late): batch hauler now comes from the
      PROJECT's declared hauler (projects.waste_hauler) first — submitted_by
      only as fallback, both through the resolver. Batch tickets now stamp
      `mix_source='estimated'` so they enter the Mix Review queue.
      VERIFY: process a client batch → hauler = the project's hauler even with
      nothing picked at upload; new tickets appear in Mix Review with badge.
- [ ] **`client.html`** (staged Aug 10, cumulative): exploded ticket view in
      History (tap number/thumbnail/row → full-screen, tap to zoom 2.5x, pan);
      iPad two-up layout (scale + debris side by side, full-width sticky
      submit); darker card titles portal-wide; 10-photo cap per section with
      toast; project-default hauler on the toggle ("🚛 Jaguar Waste Management
      • Add notes ▾", dropdown hidden when project declares hauler); submit
      fallback = dropdown → project hauler → client name (variant-spelling
      guard). VERIFY: Hayes upload shows the 🚛 toggle; History tap opens the
      exploded view; try selecting 12 photos → capped at 10.
- [ ] **`upload.html`** — ticket number fix, still unmerged since Aug 8. Own PR.

## ✅ SHIPPED & PRODUCTION-VERIFIED — Aug 10 session
- **Full pipeline proven on real batches:** 10-ticket client batch (Aug 4–7
  paper dates read correctly), 5-ticket Hayes batch, zones (Zone D) and drivers
  (Willie G, Alan, Derrick) extracted off paper onto tickets, dedup held on
  re-uploaded tickets (3 rows not 5), fill-blanks repaired earlier null tickets.
- **Hauler system CLOSED end-to-end.** Four layers: (1) bare "Jaguar" row
  DELETED from approved_haulers — it was why merging never stuck; the dropdowns
  are built from that table and kept offering the variant; (2) hauler_aliases +
  resolve_hauler() on all admin write paths — 30/30 production tickets since
  Aug 10 read canonical; (3) projects.waste_hauler canonicalized (Ranger comma
  variant + "Ranger (Medline)" fixed); (4) batch path takes the project's
  hauler first. Drivers can keep writing "Jaguar" on paper forever.
- **updated_at triggers** on tickets AND photo_queue (set_updated_at(), column
  added to photo_queue). Proven: 85825 stamps on change, created_at untouched.
  LESSON (Claude's error): plpgsql triggers bind columns at FIRE time, not
  creation — a trigger on a table missing the column creates fine, then breaks
  every UPDATE. That froze the Hayes queue rows at pending for an hour. Any
  future trigger: check the column exists FIRST.
- **Batch review reads zone + driver.** The photo-queue batch modal had a THIRD
  OCR prompt that never asked for zone/driver (the two fixed Aug 8 were the
  scan form + PDF import). Now: prompt extracts both, review rows show a Zone
  dropdown + Driver input prefilled, creates write both, updates fill blanks
  only, existing hauler never overwritten.
- **Duplicate photo protection fired in production** — re-uploads kept
  originals, no doubles.
- **Repairs run:** 5 Hayes "Rob Van"-hauler tickets corrected to Jaguar Waste
  Management + mix_source='estimated' (87644/87645/87619/87637/87611).

## 🔴 DECISIONS / OPEN
- [ ] **B&B Materials and Services, LLC is NOT in approved_haulers** but JE
      Dunn's project points at it (their dispatcher code is DS-BB2025). Run
      `select * from approved_haulers limit 1;` and send Claude the columns →
      exact INSERT comes back. Until then B&B never appears in any dropdown.
- [ ] **Should haulers change zones?** Jaguar + Skyward accounts have Children's
      Hospital portal access and can use the zone picker. Traceable but likely
      unintended. Small guard in `client_set_zone` if no.
- [ ] **328 blank zones / 737 blank drivers.** Zones unrecoverable from data;
      drivers self-heal as photos arrive (proven working now). Decide
      hand-backfill vs "Unassigned" before the next Children's Hospital LEED
      submission — client conversation, not code.
- [ ] **photo_queue.submitted_by attribution** — still stores hauler-or-name.
      Less urgent now the batch path ignores it for hauler, but Curtis's screen
      still wants origin badges (CLIENT/FIELD/DISPATCH).

## 🟠 MATERIAL MIX — the integrity track
Randomizer stays as prefill (decision Aug 8); estimated/verified stamping is
the safeguard. Mix Review queue live in Audit tab: per-ticket adjust+confirm or
glance-then-"Verify All Shown" (skips rows with unsaved edits; audit-logged as
glance review). History stays NULL — no backfill (decision Aug 8); month-window
backfill snippet in mix_review_setup.sql comments if a submission needs it.
- [ ] **First Mix Review pass** — the repaired Hayes 5 + every new batch/Pi
      ticket now enter as 'estimated'. Glance, verify, watch the badge hit 0.
- [ ] Compliance checklist line: "Material mix verified: N%".
- [ ] **Composition from purchase orders (the real fix).** Buyer POs + landfill
      receipts → material_sales table → rolling measured composition replaces
      the random ranges. FIRST STEP, no code: total 3 months of POs by
      material — one hour, reveals true diversion vs the 75% target.
- [ ] Later: AI debris-photo composition per load.

## 🔒 SECURITY FOLLOW-UPS
- [ ] **Back up `scale_capture.py` + `scale_capture.service` to the repo —
      STILL NOT DONE. TOP OF LIST.** Only copy is the Pi SD card (has died
      before). Ten minutes: Termius SFTP → iPad Files → GitHub upload.
- [ ] **Ask Raul: any uploads July 27–Aug 8?** Images would be in the
      ticket-photos bucket with no queue row. TIME-SENSITIVE, now 2+ weeks old.
- [ ] Scoped RPC to replace `anon_select_photo_queue (using true)`.
- [ ] Supabase Auth (admin + portal) — client UUID from localStorage is a
      bearer token for a WRITE.
- [ ] Rotate anon key (5 places incl. 2 Pi files) — calm morning only. Rotate
      dispatcher tokens (July 4 leak).
- [ ] Remaining UNRESTRICTED tables/views. LESSON: photo_queue lockdown broke
      uploads 12 days — check every READER before restricting.

## 🟢 EASY / QUICK WINS
- [ ] Batch-review hard-codes `useYear = 2026` — wrong every January.
- [ ] `upload.html` hard-coded U.haulers map → move to approved_haulers data.
- [ ] Mark averaged-tare DX loads "Estimated" (~32,540; preview first).
- [ ] Commit all four SQL setup files to the repo (project_zones,
      hauler_aliases, mix_review, admin_unlock) as the run record.
- [ ] Rename 2_pi_health.py; delete reset-client.html; remove stale
      divertscan-capture.service; remove dead filterUploadProjects().
- [ ] Recheck admin "5 pending" badge vs queue (may have self-resolved).

## 🟡 MEDIUM (an evening each)
- [ ] **Curtis verify screen (iPad split view)** — photo left ~55% pinch-zoom,
      fields right (ticket#/date/gross/tare/net/driver/zone/hauler/project),
      one ticket at a time, low-confidence amber, "Create All" at the end.
      The pipeline under it is now production-proven; zone+driver fields
      already exist in the rows. Next real build.
- [ ] **Curtis rollout, zero new code:** upload.html takes multiples; batch
      modal auto-matches project by job-name scoring; "Create All Reviewed
      Tickets" exists. Send link, trial 5 tickets, then the 60-stack = six
      10-batches. 10-cap now enforced client-side.
- [ ] **Sheet-fed scanner** (Brother ADS-1700W ~$300 or ScanSnap iX1600 ~$450):
      scan stack → Photos → "Choose from photos" → existing flow. Flat 300dpi
      scans beat truck-seat photos for OCR accuracy. Pairs with PDF batch
      import (one PDF per stack → pdf.js split → OCR) — bump that if bought.
- [ ] Two-pass OCR self-verification → exception-only review (gross−tare=net,
      date sanity, 5-digit format, driver fuzzy, weight vs container).
- [ ] Pi ↔ paper reconciliation by weight+time, nightly unmatched list.
- [ ] Client portal quick ticket search (MUST switch project before opening a
      result — P.cp.leed_version renders the detail).
- [ ] Zone dropdowns → project_zones everywhere (3 client.html filters;
      scale.html buttons + /children/i regex; needs read policy or RPC).
- [ ] Day/night for portal + uploader (only scale.html has it).
- [ ] Cellular + Tailscale auto-recovery scripts (Pi).

## 🔵 CARBON DASHBOARD (internal-only)
- [ ] LEED/Non-LEED filter on Portfolio carbon (exclude Hayes).
- [ ] Consolidate GWP factors (~1424/3650) → one source, EPA WARM v16, cited.

## 🔴 HARDER / HIGH-STAKES
- [ ] Restart-safe debounce (Pi). Duplicate/mistagged historical rows.
- [ ] July 13 bulk insert (11 rows, one microsecond) — whose backfill?
- [ ] Pi serial → 2nd GPIO UART. Hardware.

## ⚙️ ONGOING HABITS
- [ ] Pi: `sudo shutdown -h now` → green LED → unplug. Never hard-cut.
- [ ] Pi Health on hot afternoons; dust quarterly.
- [ ] Backup → branch + PR → one change → deploy → VERIFY → next.
- [ ] Errors surface ON SCREEN (iPad has no console).
- [ ] Mix Review: glance BEFORE tapping Verify All Shown.
- [ ] New-field-blank across a whole batch? First question: is that field in
      the prompt THIS path uses. Three prompts exist; each only knows what it
      is told to look for.

## ⛔ DEFERRED / BLOCKED
- [ ] Wi-Fi printer; field diagnostic kit; multi-site hardening spec; restrict
      hauler visibility for logged-in clients (overlaps hauler/zone decision).

---
*Batch-ticket data rules live in DivertScan_Priority2_Batch_Ticket_Spec_v2.md.*

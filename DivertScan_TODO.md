# DIVERTSCAN — MASTER TO-DO

**Last updated: Thursday, July 23, 2026 — evening (driver attribution session).**
Update the date whenever you change something. Replaces all prior versions.

**System status:** Live and in daily use. Drivers logging real loads through the scale
page (Jaguar rolled out; Stephan + Willie G active). Admin app, reports, scale-debug,
client portal all working. Pi capturing + syncing.
**⏳ PENDING:** a large client.html build (July 15 late-night + July 16 caching) is in
outputs, syntax-checked, NOT yet deployed/verified live. Deploy + verify = job #1.
**👀 WATCH:** Pi temp 54–61°C in a dusty sealed box (safe but warm — see Open #0g).

> **New chat? Start here:** upload this file and say "read this to get up to speed."
> This file is the complete handoff — a fresh chat knows only what's written here,
> so if something's in your head that isn't below, add it.

---

## ⚠️ READ FIRST — THE LESSON THAT KEEPS REPEATING
The RLS lockdown (Migration 5) silently broke **four** live write/link paths. Each
failed with NO visible error, found days later by accident:
1. Raul's photos → `photo_queue` INSERT denied (~2 days).
2. Ticket creation → `tickets` INSERT/UPDATE/SELECT denied.
3. Every scale reading → `leed_audit_log` INSERT denied (2 days; Pi buffered locally).
4. Scale-weight → ticket **linkage** → `scale_weights` UPDATE denied (the "?" in Live Scale). **← still open, Open #1.**

**Rule: after ANY security/RLS change, TEST EVERY WRITE PATH END TO END.** Drive a
truck across the scale, upload a photo as Raul, open a client report. The policy list
looking right is not proof — a path can be dead. Full anon-access list is at the BOTTOM.

---

## 🔴 OPEN — next up

### 0. NEW follow-ups from the July 15 late-night session
- **0a. Audit all-projects + all-haulers + index.html reports for the SAME
  captured_at truncation.** We fixed two client.html paths that read `tickets`
  directly with the anon key (RLS-capped ~30 days). Very likely the same
  direct-read / `captured_at` sort-or-bound pattern is under-reporting history in
  the other reports — this is the Independent-Waste-showed-44% fingerprint. Grep each
  for direct `tickets?` reads and for `captured_at` used to sort/bound/filter; route
  through a SECURITY DEFINER RPC or paginate, and sort on `ticket_date`. TEST against
  a known driver/project total (source-of-truth SQL) after each.
- **0b. The 138-vs-124 gap on Willie G "Projects Served".** Source SQL: Willie G =
  138 loads / 434.69 T for Children's Hospital. Client portal "Projects Served" shows
  124 loads / 400.09 T. ~14 loads / ~34 T missing — almost certainly the leftover
  null-`captured_at` historicals getting dropped somewhere in this view's grouping or
  the RPC's reach. Small, not a privacy issue, view is now vastly better than before.
  Run down when convenient; confirms 0a is fully closed.
- **0c. "(unknown)" / "(Unassigned)" driver attribution.** Children's Hospital had
  305 T under "(unknown)" driver — the single biggest slice, historical backlog from
  before driver-capture rolled out. DO NOT backfill guessed driver names (fabricated
  provenance is worse than an honest blank on a LEED evidence chain). Options:
  cosmetic relabel "(unknown)" → "Not recorded" on customer reports; real fix is that
  new loads now capture the driver via the scale.html per-hauler links, so it stops
  growing. Left as-is pending Robert's call.
- **0d. Verify remaining July-15-late items on live site:** driver date-range
  chips/pickers click-through, and XLSX `07/01/2026` date format. (Main history fix,
  CO₂e removal, driver-detail history fix, XLSX period stamp all already verified.)
  PLUS the July 16 caching (snappy driver switching). ALL of it is one un-deployed
  client.html in outputs — deploy + hard-refresh/private-tab + verify is job #1.

### 0e. CORRECTION: the Live-Scale "?" is NOT the Open #1 linkage bug
Investigated July 16. The "?" under weights in Live Scale / Pi Scale Captures means
**"not yet classified — weight_band unassigned,"** NOT "not linked to a ticket."
Confirmed via the capture modal: yellow banner "Not yet classified. Run the classifier
SQL in Supabase to assign weight_band." So Open #1's UPDATE policy would NOT clear
these. Open #1 (the `ticket_id` stamp / scale_weights UPDATE) is still a valid separate
one-liner, but test it against actual LINKAGE behavior, not the "?".

### 0f. Classifier — why do SOME captures stay unclassified? (NEEDS DIAGNOSIS)
**Corrected July 16 — an earlier note in this file claimed classification is entirely
manual. That was an overstatement, do not act on it.** Evidence both ways:
- Some captures DO get classified: scale.html's tare-estimate code queries
  `scale_weights?weight_band=eq.tare_candidate` live and gets results, so bands are
  being assigned in the normal flow.
- But an individual capture (24,160 lb, Jul 16 8:11 PM) sat with "Not yet classified.
  Run the classifier SQL in Supabase to assign weight_band" — and the "?" persists in
  Live Scale for unclassified rows.
**So: classification works for some rows and not others. Find out WHY before building
anything.** Is there a trigger/job that only covers certain cases? A weight range that
falls through? A race with the Pi's sync? Diagnose first, THEN decide whether it needs
automating. Related: orphan
triage is manual, one-at-a-time (~70 backlog July 16, mostly NON-truck noise —
forklift/equipment/test scans, cleared via "NOT A REAL TRUCK?" + Ignore; count ticks
down as cleared, so it's working, just tedious). Consider bulk-ignore or auto-ignore of
obvious noise. **Orphan captures are NOT lost real loads — mostly non-load noise. Not an
emergency.** Spec fresh; do NOT hot-patch the live capture pipeline while tired.

### 0g. Pi thermal — monitor + passive cooling (NEW)
July 16 Pi Health: **~129–130°F, 24h high 141.6°F** (54–61°C). NOT dangerous (Pi
throttles at 176°F/80°C — headroom exists) but warm for a light workload → ambient-
driven. Pi is in an **enclosed case in an EXTREMELY DUSTY scale house** (correct — seal
keeps grit out), mounted on an aluminum heat shield, wires through grommets.
- **DO NOT add a fan.** In a dusty sealed box a fan cakes with grit, insulates, fails —
  makes it hotter. Passive only.
- **Cooling recommendations (ranked, all passive/sealed/dust-proof):**
  1. Couple the INTERNAL aluminum heat shield to the OUTSIDE of the case (thermal pad/
     metal standoff to an external fin or the case wall) so heat leaves the sealed box
     instead of warming trapped air. Highest leverage — likely why it runs 54–61°C on a
     light load: heat has nowhere to go.
  2. Fanless finned aluminum case that IS the heatsink (Flirc-style / heavier finned).
  3. Clean thermal pad chip(SoC)→metal — heat leaves via the chip, not board edges.
- Physical check (walk-over, not code): is it in direct sun? is chip→metal contact clean?
- **NEVER hard-power-cut to "cool it."** No thermal reason to touch the Pi now.

### 0h. Pi Health card upgrade (NEW — index.html build, display-logic only)
Data already exists (`pi_health` logs temp/disk; card renders them). Add:
- **Temp thresholds (°F, matches card's existing °F display):** normal <160°F;
  WARN 160–175°F (71–79°C) "running hot"; CRITICAL >175°F (near 176°F/80°C throttle).
- **Storage:** warn 80% disk, critical 90% (at 11.7% now — pure insurance).
- **Forecast overlay:** pull ZIP **75220** (Dalmex, 2828 Nagle St, Dallas) forecast high,
  show next to Pi temp + the DELTA. A widening Pi-vs-ambient delta over weeks = early
  cooling-degradation signal (better than a fixed threshold alone).
- **Sync-stale alert:** "Pi hasn't synced in X hrs" — the REAL connectivity-loss signal.
  Catches dead SIM / exhausted prepaid / carrier outage / bad signal all at once. This is
  the single most valuable alert (stale sync = stale LEED reports).
- Visual dashboard alerts ONLY (no email/text for now).
- **NEED FROM ROBERT:** paste the Pi Health card render block from index.html (search
  "PI HEALTH" / the °F render). Plus a weather API for the forecast. Build fresh — new
  surface (index.html), don't stack on the un-verified client.html deploy.

### 0i. Site connectivity — resilience (NEW — Robert's decisions + one alert I build)
Site has NO good wired/wifi internet. BOTH legs are cellular: **AT&T prepaid 4G/5G
(~$35/mo) → Pi modem** (sync), **T-Mobile hotspot → office internet**. Prepaid is a
workaround for bad building signal, not a choice. Failure nightmare: prepaid lapses → Pi
goes silent → captures pile up locally → found when reports go stale.
- **Robert to check/decide (hardware = Robert + local installer, NOT something Claude
  can do/verify remotely):**
  1. **Check FIRST:** is fixed internet available at 2828 Nagle St 75220? (T-Mobile Home
     Internet / Verizon Fixed Wireless / wired broadband). ~$50/mo unlimited beats
     metered prepaid for a system that can't go dark — may make the rest moot.
  2. **Dual-SIM failover router** (holds AT&T + T-Mobile, auto-switches) — best fit for
     something this critical; turns two single-points-of-failure into redundancy. Two
     carriers rarely fail together. RECOMMENDED if staying cellular.
  3. **Cellular signal booster + external roof/pole antenna** (weBoost-style) — attacks
     root cause (weak signal into metal/concrete building); stacks with any option; stops
     the "weak signal burns prepaid" cycle.
  4. Consolidate onto one carrier only if one is clearly dominant (loses redundancy).
- **AT&T prepaid housekeeping (Robert):** turn on **AUTO-REFILL** so it can't lapse.
  Balance CANNOT be tracked in-app (no AT&T prepaid balance API). Have SIM ICCID
  photographed but need the **prepaid PHONE NUMBER** to check balance (via *777#, myAT&T
  Prepaid app, or 800-901-9878). Put ~$200 in a few months ago — verify remaining.
- **What Claude builds:** the **sync-stale alert** (0h) — covers every connectivity
  failure mode with one check, more reliable than a dollar counter.

### 0j. Admin-app save resilience (NEW — minor, future)
July 16: editing ticket 87556 in index.html failed with "Save failed — check
connection." Was a GENUINE network drop (VPN/wifi) — fixed by switching to phone
hotspot + reload. NOT a code/RLS bug. But admin save has no offline queue/retry (Pi
buffers; admin app doesn't) — a failed field-save just errors and you retype. Future:
"retry / queue this save" behavior. Low priority.


### 0k. Tare estimate options — DOCUMENTED (scale.html) + one concern
Read from scale.html July 16. When a driver taps the "can't return empty" path, the app
builds up to FOUR options (which appear varies per driver):
1. **Fleet Average (hauler)** — `avg_tare` from the `v_fleet_tares` view, per hauler.
   This is where a standard tare like "DX ~32,540" comes from.
2. **Your Average (N prior loads)** — that driver's mean `tare_lbs` over their last **50**
   tickets with non-null tare. Only offered if they have **≥3** prior loads, so new
   drivers won't see it. Label shows the real count.
3. **Most Recent Tare Today (time)** — latest `weight_band=tare_candidate` from
   `scale_weights` captured today.
4. **✏️ Type Custom Tare** — manual entry; warns if <5,000 lb or >80,000 lb.
All non-measured paths should land as `tare_method='estimated'` (verify).
- **⚠️ CONCERN — option 3 is not truck-scoped.** "Most Recent Tare Today" takes the
  latest tare_candidate regardless of WHICH truck it came from. If two trucks weigh the
  same day, a driver can pick another truck's tare. The button shows only a timestamp —
  no truck/driver — so nothing on screen catches it. Of the four options this is the only
  one that can be silently WRONG rather than merely imprecise. Worth scoping to the
  driver/truck, or labeling it with the source. Not urgent; needs a fuller read of
  scale.html first.

### 0l. Driver group message — SENT July 16 (one fact still unconfirmed)
Short message for the Jaguar driver group with their scale link
(`scale.html?k=es5xq42fvqeo` — live hauler token, keep OFF anything public; Haulers tab
has ↻ to regenerate if it leaks). Covers: save to Home Screen, pull on loaded → tap name
→ pick project → record loaded → dump → empty weight (drive back over empty = best, else
use an estimate or type it), emphasis that measured is most accurate.
- **UNRESOLVED before sending:** does the DRIVER flow in scale.html include a
  photo-the-paper-ticket step, or do photos come in only via Raul's upload page →
  `photo_queue`? Claude asserted a photo step, then retracted it as an unverified
  inference. **Search scale.html for `photo` / `input type="file"` and confirm.** Don't
  tell drivers to photograph tickets if that's actually Raul's job.
- A Spanish version was offered and not yet written.

### 0m. DRIVER ATTRIBUTION — investigated & largely RESOLVED July 23
Chased two "Willie G" cards in the client portal. Ended up disproving two of Claude's own
hypotheses along the way — **read the conclusion, not the first guess.**

**CONCLUSION: the resolver is NOT broken. There is NO active code leak.**
`_resolveDriverId()` (index.html ~line 1970) + `_findDriverMatch()` + `_scoreDriverMatch()`
already do fuzzy name→driver_id resolution (exact=100, "Willie G"→"Willie Garcia"=90,
typo branch handles "Stephen"→"Stephan"≈85, threshold 70). Called from batch_ocr ticket
creation (~line 8211) and the edit path (~line 8606).
**Measured performance on batch_ocr: tickets WITH a driver_name → 401/403 resolved (99.5%).**

**The real issue is UPSTREAM, on paper:**
| name_status | tickets | got_id | null_id |
|---|---|---|---|
| has name | 403 | 401 | 2 |
| **no name** | **426** | **0** | **426** |
426 scanned tickets have NO driver name at all — the driver line was left blank on the
paper ticket, or the handwriting was unreadable. Nothing for the resolver to resolve.
Of 748 total NULL-driver_id tickets across all sources, **696 have no name.**
**This is an OPERATIONS/paper-process gap, not a code bug. Do NOT "fix the resolver."**

**Hypotheses tested and DISPROVEN (don't re-chase):**
- ❌ "No resolver exists" — it exists and is well built.
- ❌ "RLS blocks the drivers cache" — no; 400 Jaguar tickets resolved fine.
- ❌ "Hauler string mismatch breaks the filter" — no; canonical strings, 400 matched.
- ❌ "Duplicate driver records" — `drivers` is CLEAN: 13 drivers, 13 distinct names.

**✅ DONE July 23:**
- Repointed 3 orphan tickets `54e30b9b…` → `c65ad12f…` (only orphan driver_id in the DB;
  name matched exactly, one real Willie G record, unambiguous).
- Backfilled **50** recoverable NULLs by exact name match (Willie G 26, Alan 17, James 5,
  Derrick 2). Previewed first — 4 clean 1:1 matches.
- **Willie G verified consolidated: 172 tickets / 510.13 T** (143+26+3). Confirm the
  client portal Drivers tab now shows ONE card, not two.

**🔴 STILL OPEN (small):**
1. **Non-Jaguar haulers resolve at 0%** — Ranger 0/7, Liberty 0/6, Independent 0/4,
   Mockingbird 1/3. `drivers` has essentially no non-Jaguar drivers, so the hauler filter
   (`d.hauler !== hauler`, exact compare, ~line 1955) finds nothing to match, and the
   auto-create fallback appears to fail silently. Low volume but those haulers will never
   attribute. Worth a look.
2. **Auto-create fallback is risky** — on no-match, `_resolveDriverId` POSTs a NEW row to
   `drivers` from raw OCR text. That's how junk like "Alfredo / Morris Bros Waste" gets in.
   TODO #9 already plans an `is_approved` pending-driver flag — that's the right fix.
3. **"Stephen" (1 ticket) vs real "Stephan"** — left alone deliberately. If confirmed same
   person, alias it (documented) rather than silently rewriting.
4. **Reducing the 426 blanks is an OPS question**, not code: get drivers to write their
   name on the paper ticket. Ties to the driver-group message (0l) and to the PDF
   batch-scan rebuild (#4) — prompt for a driver during human review of unreadable ones.

### 1. Scale-weight → ticket linkage bug (quick — 1 policy)
Completing a ticket PATCHes `scale_weights` to stamp `ticket_id`/`status='confirmed'`
— the link that clears the "?" in the Live Scale panel. Lockdown left anon with
INSERT+SELECT but no UPDATE, so the PATCH silently fails (it's in a "non-fatal"
try/catch, which hid it). Fix:
```sql
CREATE POLICY "anon_link_scale_weights" ON scale_weights
  FOR UPDATE TO anon
  USING (captured_at > now() - interval '12 hours')
  WITH CHECK (captured_at > now() - interval '12 hours');
```
Then complete a test load and confirm no "?".

### 2. VERIFY DEPLOYED (from July 15 session — may already be live)
- **client.html** — ✅ VERIFIED LIVE July 15 late-night. RPC fix confirmed (pulls
  full history), and further fixed this session (see DONE: captured_at truncation,
  CO₂e removal, driver date filter). This line is now closed.
- **scale.html** (tare_method stamping, streamlined UX, driver-scoped recent loads).
- **index.html** (ticket sort fix, hauler links, passphrase removed, auth-gate keys
  baked in so clearing Safari data can't lock you out).

### 3. Date validation / flagging on tickets
Flag any ticket whose `ticket_date` looks wrong so it gets reviewed before it lands in
a LEED report:
- **Future dates** — e.g. entered July 14 but dated July 15. Root cause is likely a
  **UTC-vs-Central timezone rollover after ~7pm** on the Pi or scale tablet. CHECK THE
  DEVICE TIMEZONE first; that may fix it at the source.
- **Stale dates** — `ticket_date` more than ~30 days before `created_at`. Could be a
  legit old backlog scan, or a transcription error. Flag for a human to confirm.
Build: a visual flag in the Tickets tab (like the existing ⚠ Needs Data), not an
auto-correct — Robert eyeballs it.

### 4. PDF BATCH SCAN UPLOAD (new feature — efficiency win)
Let Raul scan a STACK of handwritten Dalmex tickets into ONE multi-page PDF, upload
once, and have DivertScan split pages → OCR each → drop each into `photo_queue` for
review. Today the upload page takes photos one-at-a-time, which is slow for clearing a
backlog of 50+ tickets. Sitting at a desk scanning is far faster. Net-new build:
PDF upload → split → OCR per page → queue. Worth spec'ing fresh in a new chat.

### 4b. Hauler alias table (stop flagging "Jaguar" vs "Jaguar Waste Management")
Handwritten tickets say "Jaguar" but the canonical hauler is "Jaguar Waste Management",
so OCR/review flags a mismatch every time. Fix with an ALIAS TABLE (not hard-coded — that
caused the original hauler mess). Import/OCR resolves the alias to the real hauler, no flag.
```sql
CREATE TABLE IF NOT EXISTS hauler_aliases (
  alias text PRIMARY KEY,
  hauler_id uuid NOT NULL REFERENCES approved_haulers(id)
);
INSERT INTO hauler_aliases (alias, hauler_id)
SELECT 'Jaguar', id FROM approved_haulers WHERE name = 'Jaguar Waste Management'
ON CONFLICT (alias) DO NOTHING;
```
Then wire the OCR/import step to consult hauler_aliases before flagging. Add rows for other
shorthand as it appears ("Ranger", "Mockingbird", "B&B", etc.). DO NOT create the table until
the import logic is wired to use it, or it just sits unused.

### 5. Photo backup — THE irreversible risk (2.5 GB, 1,302 files)
Supabase daily backups EXCLUDE Storage. Scale-ticket + debris photos (the LEED
evidence chain) live in one place only. Plan: rclone Pi → Backblaze B2 (~$0.15/mo),
nightly, with a JSON manifest mapping file → ticket/project/hauler/date so it's
restorable, not a folder of anonymous JPEGs.

### 6. `ticket-photos` bucket is PUBLIC
All 1,302 files readable by anyone with the URL. Making it private → switch photo
pages to signed URLs (real work). Do the backup first.

### 7. Client passwords weak (SHA-256 + static salt), 6 accounts
Move to bcrypt (pgcrypto installed). Safe migration: dual-verify in `client_login` —
try bcrypt, fall back to SHA-256, re-hash on success. Nobody locked out.

### 8. Pickup / payment authorization form — PARKED
Waiting on employee name. One-page bilingual "Authorization to Receive Payment" on
Dalmex letterhead, authorizing a named person to collect payment on Dalmex's behalf.

### 9. Housekeeping
- Delete dead pages: upload.html, leed-audit.html, reset-client.html, print-poster.html,
  dispatcher.html (each a live URL carrying the anon key). Also delete stray Files dupes
  (scale4.html, index (1).html, etc.) so you never re-upload an old version.
- `hauler-report.html` — NOT yet gated or paginated; merge with all-haulers-report.
- No sign-out button anywhere.
- `projects.waste_hauler` DEPRECATED (junk like "Ranger (Medline)") — drop once unused.
- `approved_haulers.default_project_id` — unused/null, drop.
- Pending-driver flag: `ALTER TABLE drivers ADD COLUMN is_approved boolean DEFAULT true;`
  — self-register but review before permanent (catches next "Alfredo/Morris Bros Waste").
- `tickets` has 8 photo columns (debris_photo_1/2/3, debris_images, photo_url,
  scale_photo_url, scale_ticket_image, scale_ticket_photo) — find which are live, same
  accretion pattern as the hauler-name mess.

---

## ✅ DONE (BUILT, PENDING LIVE VERIFY) — July 16 (client.html speed)

### Session cache — stop re-fetching the full ticket set 3–5× per session
`client_tickets` returns the client's ENTIRE history and was being fetched fresh on
every driver-list load, every driver-detail tap, every monthly report, and both
all-drivers exports (5 call sites). Each is a full download. Now fetched ONCE via new
`P.allTix()` memoized helper, cached in memory, reused everywhere. Tapping between
drivers / opening monthly reports is near-instant after first load.
- Cache is MEMORY ONLY (never localStorage) — can't persist across reload or bleed
  between logins. Cleared on logout (`P._allTixCache=null` in logout()) — privacy.
  Cleared after project edits (both `projects` PATCH calls call `P.clearTixCache()`).
- Clients are READ-ONLY on tickets (confirmed — no client-side ticket create/edit/
  delete), so the cache can't go stale mid-session from ticket changes.
- Node syntax-checked. All 5 fetches → `P.allTix()`; only remaining client_tickets
  call is inside allTix() itself.
- **⏳ VERIFY ON DEPLOY:** open Drivers, tap between several drivers (should be snappy
  after first), open a monthly report, confirm numbers identical to before.

**NOTE — this + the whole July 15 late-night stack are in ONE client.html in outputs,
NOT yet confirmed live by Robert. Deploy + verify is the #1 open loop. See Open #2.**

---

## ✅ DONE — July 15 late-night (client.html portal session)

**All changes below are in ONE client.html file, deployed together. Verified live
on divertscan.com via a test client login (a client account granted access to all
of Jaguar's projects — so it sees all Jaguar projects, which is correct scoping,
NOT a leak). Node syntax-checked before each handoff.**

### The bug that repeated (again): the captured_at truncation
Client portal was silently showing ~a quarter of history. Two DIFFERENT code paths
were reading the `tickets` table DIRECTLY with the anon key, which RLS caps at ~30
days — so every older row (incl. imported historicals) dropped with no error. Same
species as the RLS-lockdown lesson: plausible-but-incomplete data, no error, found
by eyeballing a client report. **Children's Hospital: portal showed 189 tickets from
2026-04-17; actual is 728 tickets back to Sep 2025.**
- **Main project view (line ~438):** was `apiAll('tickets?project_id=eq...&order=created_at.desc')`
  → now routes through the `client_tickets` RPC (SECURITY DEFINER, full history,
  project-scoped) filtered to the tapped project. FIXED + verified.
- **Per-driver detail view (line ~696):** same direct-read bug → same RPC fix,
  filtered to `driver_id`, defense-in-depth `allowedProjIds` filter kept. FIXED +
  verified (Willie G now shows full 143 loads / 439.30 T all-time, correctly split
  across his Jaguar projects).
- **RPC change (run in SQL editor, done):** `client_tickets` `ORDER BY` changed
  `captured_at DESC` → `ticket_date DESC` so null-`captured_at` historicals sort
  correctly. Old definition is preserved in chat if rollback needed.
- **KEY LESSON reinforced:** null `captured_at` on imported/backfilled rows is a
  BENIGN, KNOWN category (not corruption). Any date-flagging (Open #3) must NOT flag
  these. Always sort/bound/filter client-facing views on `ticket_date`, never
  `captured_at`.

### CO₂e removed from ALL client-facing display (standing-rule fix)
Children's Hospital (a LEED project) client report was showing CO₂e — a live
violation of the INTERNAL-ONLY rule, on the exact project the rule names. Turned out
CO₂e was in **7 spots**, and the existing gating (`leed_version==='none'`) was
BACKWARDS vs the rule (it hid carbon from Non-LEED and SHOWED it on LEED). Removed
from: dashboard summary card, All-Tickets table (header + row cell + logic), month-
detail summary card, month-detail table (header + row cell + totals row), and the
PDF KPI. `co2e_avoided` column + internal calc accumulators LEFT INTACT (data stays,
just not rendered to clients). Verified gone on-screen AND in the Save-as-PDF output.
Robert confirmed: CO₂e is internal-to-Dalmex only, not required anywhere client-side.

### Driver detail: date-range filter added (client parity with driver loadbook)
Client's per-driver view now has the loadbook-style filtering: quick chips (All /
Today / Yesterday / This Week / Last Week / This Month / Last Month) + From/To date
pickers + Clear. Summary cards, Projects Served, and ticket table all recompute
against the filtered window. Filters on `ticket_date` (not captured_at). Active
period shows in the panel header AND is stamped into all three exports (PDF header
"Filter:" field, XLSX subtitle row, email body "Period:") so a saved report is
self-documenting about its window — audit-safe (no period/number mismatch).
Refactor: render body split into `renderDrvBody()`; helpers `_drvFiltered()`,
`_drvPeriodLabel()`, `drvFilterBar()`, `setDrvChip()`, `setDrvDate()`. Biggest single
edit of the session — test the chips/pickers + exports harder on deploy.

### XLSX export date format
Loads sheet column A was raw ISO `2026-07-01` → now `07/01/2026` (US M/D/Y). Done via
string split, NOT a Date object, so no timezone shift (matters given the UTC-rollover
concern in Open #3). On-screen table + PDF already used `P.fdt()` ("Jul 1" style) —
this was XLSX-only.

---

## ✅ DONE — July 11–15

### Data model rebuilt
- B&B-Independent Waste → **Independent Waste** (bought B&B July 1), 68 tickets renamed.
  Medline renamed, customer Jaguar, GC Hillwood. Blank customers filled. `projects.active`
  added; Test project archived.
- `tickets.hauler_id` FK backfilled 1,077/1,077. `hauler_projects` rebuilt on IDs →
  13 pairs, unique-indexed.
- 5 canonical haulers (`approved_haulers` = source of truth): Jaguar 967, Independent
  Waste 68, Ranger Waste Management LLC *no comma* 22, Liberty 14, Mockingbird 8.
- Customer ≠ hauler: Medline (Ranger/Jaguar), Moncler (Mockingbird/HP EnviroVision),
  JE Dunn (Independent Waste / GC JE Dunn).

### Security
- Supabase Auth login on index, all-haulers-report, all-projects-report, scale-debug
  (user robert@dalmexrecycling.com). Passphrase RETIRED (`_admin_ok()` → `auth.uid()`).
- Fixed: `admin_set_client_password` had NO auth check + granted to anon (anyone could
  reset any client password). All admin_* REVOKEd from anon.
- Migration 5 RLS lockdown → business tables `authenticated`; killed `{public}/ALL/true`
  (read+DELETE any ticket); closed `client_project_access` self-grant hole.
- Driver tokens non-enumerable — driver ops via SECURITY DEFINER RPCs.
- Per-hauler scale links live (`approved_haulers.access_token` + `scale_hauler_by_token`);
  `scale.html?k=<token>` pins hauler, shows only their drivers+projects, no "tap to change".
  Links in Haulers tab (Copy + regenerate ↻).
- index.html auth-gate fixed so clearing Safari data no longer locks you out.

### Client portal (July 15)
- Lockdown blanked it (anon lost `client_project_access` read; tickets capped 30 days).
  Fixed WITHOUT reopening tables via SECURITY DEFINER RPCs `client_projects(uuid)` /
  `client_tickets(uuid)`; client.html patched. Full history restored; logins unchanged.

### Correctness
- **1000-row truncation** (PostgREST caps at 1000 regardless of ?limit=): fixed with
  Range pagination in all-haulers-report, all-projects-report, client.html; removed fake
  &limit from index.html. Independent Waste had shown 44% of real volume. **ANY tickets
  query MUST paginate.**
- Ticket sort fixed: "Newest added" orders at DB level so just-approved tickets top the list.
- Removed 2 duplicate tickets (86115, 86383; Children's Hospital over-counted 5.32 T);
  unique index on ticket_number added.

### Scale page UX (July 15)
- One loadbook button (was 11); loadbook + phone moved below the flow. Zone only on
  Children's Hospital. Remembers driver's last project. Recent loads scoped per-driver.
  Bigger tap targets.

### Tare method / LEED (July 15)
- **Measured tare is the default** ("drive back empty" prompt); estimate behind a
  "Can't return? →" link. `tickets.tare_method` = measured (pi_capture) vs estimated.
  **History deliberately NOT relabeled** — protects already-issued monthly reports; flag
  only needs accuracy going forward.
- LEED note: standard requires documented, MEASURED weight per pickup; it does NOT
  explicitly mandate drive-on-empty. Argument is "measured is more defensible," not
  "LEED requires it." Don't tell an auditor LEED mandates the method.

### Raul's upload page
- photo_queue anon INSERT restored; 9 orphaned photos backfilled. Invisible project names
  (missing CSS color) fixed. Bucket photos→ticket-photos. Removed capture="environment"
  so the photo library is available, not just the camera.

### Documents
- **Certificate of Destruction — NTTA aluminum signage** (bilingual EN/ES, 1 page, signed
  Robert Vandling / Authorized Representative, dated July 16 2026). Chain: NTTA → Jaguar →
  Dalmex (#87528) → Mammoth Metal Recycling (2019 Ruder St, Dallas TX 75212). Language:
  melting/recycling AUTHORIZED (the point); reuse/resale/return-as-signage prohibited.
  Mammoth's denied ticket #208051 removed. Weight = fill-in.
  **CONFIRMED: DalMex has authorization to process Jaguar's NTTA material — chain is sound.**

---

## 🔑 STANDING RULES
- CO₂e / carbon = INTERNAL-ONLY. Customer & LEED reports weight-based only.
- Haulers come from `approved_haulers`. Never hard-code a hauler name.
- Any `tickets` query MUST paginate (PostgREST caps at 1000).
- After any RLS change, test every write path end to end.
- Measured tare is the LEED default; estimate is an explicit override.
- Two logins: **Supabase** = GitHub SSO as `24kr97gsxq-prog` (NOT dalmex755201, empty);
  **admin app** = robert@dalmexrecycling.com + password.

---

## 📋 ANON'S COMPLETE ACCESS (July 15) — KEEP CURRENT
Anon = public key in the site HTML. May do ONLY:

| Table / RPC | Verb | Who needs it |
|---|---|---|
| scale_weights | INSERT | Pi scale_capture.py |
| scale_weights | SELECT | scale.html gross/tare |
| scale_weights | UPDATE (12h) | scale.html link reading→ticket ← **PENDING (Open #1)** |
| leed_audit_log | INSERT | Pi scale_capture.py |
| pi_health | INSERT/SELECT/DELETE(>30d) | Pi pi_health.py |
| photo_queue | INSERT | Raul's upload |
| tickets | INSERT | scale.html create |
| tickets | SELECT (30d) | scale.html recent loads |
| tickets | UPDATE (12h) | scale.html tare after dump |
| approved_haulers | SELECT | scale.html hauler picker |
| projects | SELECT (active) | scale.html project dropdown |
| hauler_projects | SELECT | scale.html scoping |
| RPCs | EXECUTE | driver ops, hauler token, client_projects, client_tickets |

**NOT anon-readable:** full 1,077-ticket archive, all client data, all credentials, all
driver tokens. Add a policy → add a row here.

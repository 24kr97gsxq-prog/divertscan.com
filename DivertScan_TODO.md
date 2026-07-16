# DIVERTSCAN — MASTER TO-DO

**Last updated: Wednesday, July 15, 2026 — ~midnight (late-night client.html session).**
Update the date whenever you change something. Replaces all prior versions.

**System status:** Live and in daily use. Drivers logging real loads through the scale
page (Jaguar rolled out; Stephan + Willie G active). Admin app, reports, scale-debug,
client portal all working. Pi capturing + syncing.

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

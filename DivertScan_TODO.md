# DIVERTSCAN — MASTER TO-DO

**Last updated: Wednesday, July 15, 2026 — evening.**
Update the date whenever you change something. This replaces all prior versions.

**System status:** Live and in daily use. Drivers are logging real loads through the
scale page (Jaguar rolled out; Stephan + Willie G actively using it). Admin app,
reports, scale-debug, and the client portal are all working. Pi capturing + syncing.

---

## ⚠️ READ FIRST — THE LESSON THAT KEEPS REPEATING

The RLS lockdown (Migration 5) silently broke **four** live write/link paths. Each
failed with NO visible error and was found days later by accident:

1. Raul's photo uploads → `photo_queue` INSERT denied (~2 days).
2. Ticket creation → `tickets` INSERT/UPDATE/SELECT denied.
3. Every scale reading → `leed_audit_log` INSERT denied (2 days, Pi buffered locally).
4. Scale-weight → ticket **linkage** → `scale_weights` UPDATE denied (the "?" in Live Scale). **← still open, see below.**

**The rule: after ANY security/RLS change, TEST EVERY WRITE PATH END TO END.**
Drive a truck across the scale. Upload a photo as Raul. Open a client report.
Reading the policy list is not enough — a path that looks fine can be dead.
The full, current list of what anon may do is at the BOTTOM of this file. Keep it current.

---

## 🔴 OPEN — do these next

### 1. Scale-weight → ticket linkage bug (quick, 1 policy)
When a driver completes a ticket, the scale page PATCHes `scale_weights` to stamp
`ticket_id` + `status='confirmed'` — that's the link that makes a reading show as
"used" instead of "?" in the Live Scale panel. The lockdown left anon with INSERT
and SELECT on `scale_weights` but **no UPDATE**, so the link silently fails (the
PATCH is wrapped in a "non-fatal" try/catch, which hid it). Fix:
```sql
CREATE POLICY "anon_link_scale_weights" ON scale_weights
  FOR UPDATE TO anon
  USING (captured_at > now() - interval '12 hours')
  WITH CHECK (captured_at > now() - interval '12 hours');
```
After it: complete a test load, confirm the reading links (no "?").

### 2. Photo backup — THE irreversible risk (2.5 GB, 1,302 files)
Supabase daily backups **exclude Storage objects**. Scale-ticket + debris photos —
the evidence chain for every LEED submittal — exist in exactly one place. Plan:
`rclone` from the Pi → Backblaze B2 (~$0.15/mo), nightly, with a JSON manifest
mapping file → ticket/project/hauler/date so the backup is *restorable*.

### 3. `ticket-photos` bucket is PUBLIC
All 1,302 files readable by anyone with the URL (scale tickets show hauler, project,
weights, ticket #). Making it private means switching photo-displaying pages to
signed URLs — real work. Do the backup first.

### 4. Client passwords are weak (SHA-256 + static salt)
`encode(digest('divertscan_salt_'||pw,'sha256'),'hex')`. 6 client accounts. Move to
bcrypt (pgcrypto installed). Safe migration: dual-verify in `client_login` — try
bcrypt, fall back to SHA-256, re-hash on success. Nobody locked out.

### 5. Pickup / payment authorization form — PARKED
Waiting on the employee name from Robert. Will be a one-page bilingual
"Authorization to Receive Payment" on Dalmex letterhead, authorizing a named person
to collect payment on Dalmex's behalf. Keep any reference numbers short.

### 6. Housekeeping
- Delete dead pages: `upload.html`, `leed-audit.html`, `reset-client.html`,
  `print-poster.html`, `dispatcher.html`. Each is a live URL with a copy of the anon key.
- Also stray dupes in iCloud Files (scale4.html, index (1).html, etc.) — delete so
  you never upload the wrong one and roll back a day of work.
- Merge `all-haulers-report.html` + `hauler-report.html`; `hauler-report.html` is
  NOT yet gated or paginated.
- No sign-out button anywhere.
- `projects.waste_hauler` is DEPRECATED (still holds junk like "Ranger (Medline)").
  Drop the column once nothing reads it.
- `approved_haulers.default_project_id` — unused, all null. Drop.
- Pending-driver flag: `ALTER TABLE drivers ADD COLUMN is_approved boolean DEFAULT true;`
  so a new hire can self-register but you review before it's permanent (catches the
  next "Alfredo / Morris Bros Waste").

---

## ✅ DONE — July 11–15

### Data model rebuilt on real relationships
- Hauler `B&B-Independent Waste` → **Independent Waste** (bought B&B July 1); 68
  tickets renamed in-transaction. Medline renamed, customer Jaguar, GC Hillwood.
  Blank customers filled. `projects.active` added; Test project archived.
- `tickets.hauler_id` FK added, backfilled 1,077/1,077. `hauler_projects` rebuilt on
  real IDs → 13 verified pairs, unique-indexed.
- 5 canonical haulers, `approved_haulers` the ONLY source of truth: Jaguar (967),
  Independent Waste (68), Ranger Waste Management LLC *no comma* (22), Liberty (14),
  Mockingbird (8).
- **Customer ≠ hauler**: Medline hauler Ranger / customer Jaguar; Moncler hauler
  Mockingbird / customer HP EnviroVision; JE Dunn customer Independent Waste / GC JE Dunn.

### Security
- Supabase Auth login on index, all-haulers-report, all-projects-report, scale-debug.
  User `robert@dalmexrecycling.com`. Admin passphrase RETIRED (`_admin_ok()` now checks
  `auth.uid()`).
- Fixed: `admin_set_client_password` had NO auth check and was granted to anon — anyone
  could reset any client password. All `admin_*` REVOKEd from anon.
- Migration 5 RLS lockdown: business tables → `authenticated`; killed `{public}/ALL/true`
  (anyone could read AND delete every ticket); closed `client_project_access` self-grant hole.
- Driver tokens not enumerable — driver ops via SECURITY DEFINER RPCs.
- Per-hauler scale links live (`approved_haulers.access_token` + `scale_hauler_by_token`).
  `scale.html?k=<token>` pins the hauler; shows only their drivers + projects; no "tap to
  change" in token mode. Links in the Haulers tab (Copy + regenerate ↻).
- **index.html auth gate fixed** so clearing Safari data no longer locks you out
  ("Supabase not configured") — it now falls back to the published URL/key constants.

### Client portal (July 15)
- Portal was blanked by the lockdown (anon lost read on `client_project_access` and
  scoped tickets to 30 days). Fixed WITHOUT reopening tables: new SECURITY DEFINER RPCs
  `client_projects(uuid)` and `client_tickets(uuid)`; `client.html` patched to use them.
  Full history restored, tables stay locked. **Logins unchanged** — same credentials.

### Correctness
- **1000-row truncation** (PostgREST silently caps at 1000 regardless of ?limit=):
  fixed with Range-header pagination in all-haulers-report, all-projects-report,
  client.html; removed fake `&limit=` from index.html (4 places). Independent Waste had
  been showing 44% of real volume. **ANY new `tickets` query MUST paginate.**
- **Ticket sort fixed (July 15):** "Newest added" now orders at the DB level, so a
  just-approved ticket appears on top instead of burying by load date.
- Removed 2 duplicate tickets (86115, 86383 — Children's Hospital was over-counted
  5.32 T); added unique index on `ticket_number`.

### Scale page UX (July 15)
- One "My Loadbook" button (was 11); loadbook + phone moved below the scanning flow.
- Zone selector only shows on Children's Hospital. Remembers driver's last project.
  "Recent loads" now scoped per-driver (was showing the whole hauler). Bigger tap targets.

### Tare method / LEED (July 15)
- **Measured tare is now the default.** After gross, the page prompts "drive back empty";
  the fleet/personal-average estimate is behind a "Can't return? Use an estimate →" link.
- New `tickets.tare_method` column: `measured` (drove empty / pi_capture) vs `estimated`
  (average or typed). Stamped on new tickets going forward.
- **History deliberately NOT relabeled** — existing tickets keep their weights and were
  reported as-is; the flag only needs to be accurate from here forward. Do not run a
  historical UPDATE (protects already-issued monthly LEED reports).
- LEED research note: the standard requires *documented, measured weight per pickup*;
  it does NOT explicitly mandate a drive-on-empty tare. So "measured is more defensible"
  is the correct argument — not "LEED requires it." Don't tell an auditor LEED mandates it.

### Raul's upload page
- `photo_queue` anon INSERT restored; 9 orphaned photos backfilled. Project names were
  invisible (missing CSS color). Bucket fixed `photos`→`ticket-photos`. Removed
  `capture="environment"` so the photo library is available, not just the camera.

### Documents produced
- **Certificate of Destruction — NTTA aluminum signage** (bilingual EN/ES, one page,
  signed by Robert Vandling as Authorized Representative, dated July 16, 2026).
  Chain: NTTA → Jaguar → Dalmex (ticket #87528) → Mammoth Metal Recycling (2019 Ruder
  St, Dallas TX 75212). Language corrected so melting/recycling is AUTHORIZED (the point)
  while reuse/resale/return-to-service AS SIGNAGE is prohibited. Mammoth's denied ticket
  #208051 removed. Weight left as fill-in.

---

## 🔑 STANDING RULES
- CO₂e / carbon = INTERNAL-ONLY. Customer & LEED reports are weight-based only.
  (Internal login-gated reports may show it.)
- Haulers come from `approved_haulers`. NEVER hard-code a hauler name.
- Any query against `tickets` MUST paginate (PostgREST caps at 1000).
- After any RLS change, test every write path end to end.
- Measured tare is the default for LEED defensibility; estimate is an explicit override.
- Two logins, don't confuse them: **Supabase** = GitHub SSO as `24kr97gsxq-prog`
  (NOT dalmex755201, which is empty); **admin app** = robert@dalmexrecycling.com + password.

---

## 📋 ANON'S COMPLETE ACCESS (as of July 15) — KEEP CURRENT
Anon = the public key in the site HTML. It may do ONLY this:

| Table / RPC | Verb | Who needs it |
|---|---|---|
| `scale_weights` | INSERT | Pi — scale_capture.py |
| `scale_weights` | SELECT | scale.html — gross/tare display |
| `scale_weights` | UPDATE (12h) | scale.html — link reading to ticket ← **PENDING, see Open #1** |
| `leed_audit_log` | INSERT | Pi — scale_capture.py (audit row per reading) |
| `pi_health` | INSERT / SELECT / DELETE(>30d) | Pi — pi_health.py |
| `photo_queue` | INSERT | Raul's upload page |
| `tickets` | INSERT | scale.html — create ticket |
| `tickets` | SELECT (30 days) | scale.html — recent loads |
| `tickets` | UPDATE (12h) | scale.html — tare after dump |
| `approved_haulers` | SELECT | scale.html — hauler picker |
| `projects` | SELECT (active) | scale.html — project dropdown |
| `hauler_projects` | SELECT | scale.html — token scoping |
| RPCs | EXECUTE | driver ops, hauler token, `client_projects`, `client_tickets` |

**NOT anon-readable:** full 1,077-ticket archive, all client data, all credentials,
all driver tokens. If you add an anon policy, add a row here.

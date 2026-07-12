# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Sunday, July 12, 2026 (early hours).** Replaces the July 9 version.
Update the date whenever you change something.

**System status:** Fully operational. Pi captures + syncs (both scripts verified
writing post-lockdown). Admin app, reports, and scale-debug are now behind a
Supabase Auth login. Database RLS locked to `authenticated` for all business
data. Client portal works with existing credentials. Hauler/project data model
rebuilt on real foreign keys.

**Two systems, two ways to edit:**
- **Pi / `scale_capture.py`** — `/home/pi/scale_capture.py`, run by
  `scale_capture.service`. Edit via Termius (SSH). LESSON LEARNED July 7: never
  paste long files into the terminal from iPad (drops chunks) — put the file in
  the GitHub repo and `curl` the raw URL down to the Pi, or use Termius SFTP.
  Multi-line configs: use `sudo tee << 'EOF'` heredocs, not nano paste.
- **`index.html`** (~12.6k lines) — Claude applies edits to an uploaded copy and
  returns the full file (verified: unique anchors, additive diff, node --check);
  Robert uploads it renamed to `index.html` via Add file → Upload files →
  new branch + PR → merge → verify. ALWAYS back up first (Download raw file).
  One change at a time. **Hard-refresh or use a private tab after every deploy —
  GitHub Pages + Safari cache aggressively and will serve stale JS.**

---

## ✅ DONE — July 11–12 session (security + data-model overhaul)

### Data model — hauler/project/customer finally separated
The root problem: hauler, customer, and project were being crammed into single
text fields, producing values like `"B&B-Independent Waste"` (two haulers),
`"Ranger (Medline)"` (hauler + project), and
`"Medline BTS Medline / BranchPattern (VPA)"` (project + GC + who knows).

- **Migration 1** — renamed hauler `B&B-Independent Waste` → **`Independent Waste`**
  (Independent Waste purchased B&B on July 1). 68 tickets updated in the same
  transaction. Medline project renamed and given customer (Jaguar) + GC
  (Hillwood). Filled 4 blank customers. Added `projects.active` and archived
  `Test project` (it has 2 tickets — archived, not deleted).
- **Migration 2** — added `tickets.hauler_id` (uuid FK → `approved_haulers`),
  backfilled all 1,079 rows, zero orphans. Rebuilt `hauler_projects` on real IDs
  (was joining on free text, had 2 rows) — now **13 verified hauler↔project
  pairs**, unique-indexed.
- **The 5 canonical haulers** (`approved_haulers` is the ONLY source of truth):
  Jaguar Waste Management (967 tickets) · Independent Waste (68) ·
  Ranger Waste Management LLC — *no comma* (22) · Liberty Demolition (14) ·
  Mockingbird Waste (8). **Total 1,079.**
- **Customer ≠ hauler.** Medline: hauler = Ranger, customer = Jaguar.
  Moncler: hauler = Mockingbird, customer = HP EnviroVision. JE Dunn: customer =
  Independent Waste, GC = JE Dunn. This is why `hauler_projects` (many-to-many)
  exists and why a project can have multiple haulers.

### Security — the anon key is no longer a skeleton key
The anon key is published in the site's HTML (unavoidable for a static site).
Before this session, nearly every table had `{public} / ALL / USING (true)` —
meaning anyone who viewed source could **read and delete** every ticket, project,
and client record. That is now closed.

- **Auth gate (Supabase Auth)** added to: `index.html`, `all-haulers-report.html`,
  `all-projects-report.html`, `scale-debug.html`. These now send the user's **JWT**
  instead of the anon key. Login persists (one-time, not per-visit).
  Auth user: `robert@dalmexrecycling.com`.
- **Migration 5 (RLS lockdown)** — all business tables → `authenticated` only.
  Dropped the permissive `{public}/ALL/true` policies on tickets, projects,
  materials, loads, dispatchers, photo_queue, hauler_projects, leed_audit_*,
  fiber_*, daily_reports, scale_weights, and **client_project_access** (which was
  the worst: anyone could insert a row granting themselves access to any client's
  project). Dropped dead policies on `buyers_old` and `app_users`.
- **Anon retains exactly what the Pi needs, and nothing more:**
  - `scale_weights` — INSERT only (`scale_capture.py`)
  - `pi_health` — INSERT / SELECT / DELETE-older-than-30-days (`pi_health.py`)
  - Both verified still writing after the lockdown.
- **Anon re-opened (minimum needed to keep the public scale page alive):**
  `approved_haulers` SELECT, `projects` SELECT (active only), `drivers` SELECT.
  ⚠️ See OPEN ITEMS — the `drivers` one is a real hole.

### Correctness — silent 1000-row truncation (this was arguably worse than the leak)
**PostgREST caps every response at 1,000 rows regardless of `?limit=`.** Once
ticket count passed 1,000 (recently), every report began silently dropping rows
and computing totals from a partial set. The numbers looked plausible, so nobody
noticed.
- `all-haulers-report` was showing **1,000 of 1,079 tickets / 3,130 of 3,359 tons**.
  Independent Waste displayed **64.6 T when the real figure was 146.9 T — 44%**.
- Fixed via `Range`-header pagination in `all-haulers-report.html`,
  `all-projects-report.html`, and `client.html` (all 6 ticket queries).
  Removed the fictitious `&limit=10000` from `index.html` (3 places).
- **Any new page that queries `tickets` MUST paginate.** Copy the `sbAll()` /
  `apiAll()` helper. This will bite again otherwise.

### Hard-coded hauler lists — deleted
Hauler names were hard-coded in at least 4 files, none matching the database
(`'B&B Waste'`, `'Ranger Waste'`, `'Rob Van'` — the last was Robert's own test
client account leaking into a dropdown; Mockingbird was missing entirely).
- `raul-field-upload.html` — now reads `approved_haulers` + `hauler_projects`. ✅ live
- `client.html` — `knownHaulers` array deleted, now reads `approved_haulers`. ✅ live
- `all-projects-report.html` — no longer reads legacy `projects.waste_hauler`. ✅
- `upload.html` — **dead page, delete it** (superseded by `raul-field-upload.html`).

### Client portal access — audited
- **Liberty (James Childs) can see JE Dunn** — legitimate. Liberty used to own B&B;
  Independent Waste bought B&B July 1. Legacy access, not a leak. Revisit later:
  should it lapse, and does Independent Waste need its own portal account?
- **Ranger (Derek Trammell) was missing Sherman Atmos** — granted. Now has 3.
- Jaguar's three accounts (Reggie / Dewy / Ross) each correctly see 7 Jaguar
  projects + Medline (Jaguar is the *customer* there, Ranger the hauler).
- `Rob Van` (robert@xrayce.com) = Robert's own test account, 14 projects. Expected.

---

## 🔴 OPEN — pick up here

### 1. The scale page (HIGHEST PRIORITY — file not yet located)
The green "Dalmex Scale" page (GROSS WEIGHT / TARE WEIGHT / SELECT YOUR COMPANY /
driver name buttons / Open My Loadbook). **It is NOT `driver.html`** (that's the
loadbook) and **NOT `scale-debug.html`**.
→ **Find it: search the repo for the string `Waiting for truck`.**

Once found, it needs:
- **Remove the public `debug` button** in the footer — it links to the now-gated
  Scale Debug and is visible to drivers.
- **Hauler list ← `approved_haulers`** (currently derives from legacy
  `projects.waste_hauler`, which is why it shows `Ranger Waste Management, LLC`
  *with a comma* and then finds zero loads — the real name has no comma).
- **Driver list filtered by `hauler_id`**, not the text name.
- **Project list ← `hauler_projects`**, not `waste_hauler`.
- **Remove the "All Projects" escape hatch** before drivers go live — a driver must
  never see the full project list.

### 2. Driver tokens are enumerable (REAL HOLE)
`drivers` currently has `{anon} SELECT USING (true)` — so **anyone with the anon
key can dump every driver's `driver_token`** and open every driver's loadbook
(`driver.html?t=<token>`). The lock works; the keys are taped to the door.
→ **Fix: security-definer RPC**, same pattern as the working `client_login` RPC.
One call takes a hauler/driver token and returns only that hauler's drivers and
projects. Then drop the blanket anon SELECT on `drivers` (and ideally on
`projects` and `approved_haulers` too).
- Note: `v_driver_logbook` is a **view** with `reloptions = null` (no
  `security_invoker`), so it runs as owner and bypasses RLS. It survived the
  lockdown for that reason. Don't add `security_invoker` without re-checking.
- `driver.html` also PATCHes `drivers.last_seen_at` — needs a scoped write path.

### 3. Driver rollout (the actual goal)
Drivers aren't using the scale page yet. The plan: **one token per hauler**, texted
as a link (`?k=...`), bookmarked once, never typed again. Token pins the hauler →
scopes drivers + projects via `hauler_projects`. Bare URL shows nothing.
Blocked on items 1 and 2.
- Then: **auto-print ticket** at the scale (the end goal — driver never leaves the cab).

### 4. Housekeeping
- **Delete dead pages:** `upload.html`, `leed-audit.html`, `reset-client.html`,
  `print-poster.html`, `dispatcher.html`. Each is a live URL carrying a copy of the
  anon key.
- **Merge** `all-haulers-report.html` + `hauler-report.html` into one gated page.
  (`hauler-report.html` has not been gated or paginated yet — it still needs both.)
- `divertscan-demo.html` — **verified safe to keep public.** Zero Supabase calls,
  no real client/hauler names. It markets embodied-carbon (CO₂e) as a *capability*,
  which is fine — the standing rule is about not putting CO₂e in customer
  deliverables, not about never mentioning it.
- **`projects.waste_hauler` is DEPRECATED.** Nothing should read it. It still holds
  junk (`Ranger (Medline)`, comma variants, `B&B Materials and Services, LLC`).
  Drop the column once no page references it.
- `approved_haulers.default_project_id` — unused, all null. Drop it.

### 5. Photos have no backup ⚠️
Supabase daily backups **do not include Storage objects**. Scale-ticket and debris
photos — the evidence chain for every LEED submittal — are unbacked. Needs a
solution.

---

## 🔑 STANDING RULES (unchanged)
- CO₂e / carbon = INTERNAL-ONLY. Customer & LEED reports are weight-based only.
  (Internal reports like all-haulers-report may show it — they're behind a login.)
- Per-project reports LEED-clean; only internal Portfolio view blends
  LEED + Non-LEED (Hayes = Non-LEED, flagged).
- **Haulers come from `approved_haulers`. Never hard-code a hauler name.**
  (This rule existed and was violated in 4 files. It's now enforced everywhere
  except the not-yet-located scale page.)
- **Any query against `tickets` must paginate.** PostgREST silently caps at 1,000.

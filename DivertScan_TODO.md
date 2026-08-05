# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Wednesday, August 5, 2026.** Replaces the July 7 version.
Update the date whenever you change something.

**System status:** DalMex fully operational — Pi captures + syncs, client portal
login working, admin client management + login log via passphrase-gated RPCs,
Pi health monitoring live (temp/throttle/disk every 5 min → Scale tab widget).

**NEW Aug 5:** Metropolitan Recycling (Mark) is a live prospect — second site,
Avery Weigh-Tronix ZM305 GTN, hardwired Ethernet at the readout. Exploratory,
possibly paid, and they are looking to hire Robert. Decision made: build it as
a SEPARATE INSTANCE, not multi-tenant. See the Metropolitan section below.

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

## 🏗️ METROPOLITAN RECYCLING — SECOND SITE (new Aug 5)

**Architecture decision: separate instance, NOT multi-tenant.** Own repo, own
Supabase project, own capture node. DalMex production is never touched. RLS
work, shared-database blast radius, and two months of scoping all avoided.
Revisit multi-tenancy only at 4–5 sites Robert actually controls.

**Site facts so far:** Avery Weigh-Tronix ZM305 GTN (IN/OUT + ID + FLEET keys
= truck in/out variant, up to 1,000 stored vehicle IDs). Hardwired Ethernet at
the readout, off a COMBINED modem/router one room over — so a plain switch is
enough, no router needed. Client will provide the capture machine and the parts.
Currently Non-LEED but may take LEED work later — so LEED stays a PROJECT-level
flag. Do NOT add a site-level LEED switch.

**Docs / where things live:**
- Master template: `docs/Node_Hardening_Spec_v1.md` in the DivertScan repo,
  synced to project knowledge. Stays generic — no site IPs in the master.
- Filled-in copy per site: `docs/SITE_RECORD_metropolitan.md` in THEIR repo.
- `capture_node.py` — site-agnostic v3 capture script. TCP or serial via
  `SOURCE_MODE`, all per-site values in one CONFIG block at the top, plus
  `--sniff` (raw indicator dump) and `--test` (synthetic weights) modes.

**Ordered next steps:**
- [ ] **Get ownership of DivertScan in writing** with DalMex while the
      relationship is good. Costs nothing now; it is the one thing that could
      complicate a second deployment later.
- [ ] **`--sniff` on site, first visit** — capture the ZM305's real output
      string. The parser was written against the AWT 1310 format. Same
      manufacturer, probably similar, but "probably" is not good enough for a
      weight record. Paste the raw lines into section 3 of the site record.
- [ ] Confirm the client-provided machine passes the acceptance test in the
      spec (nobody uses it daily, supported OS, wired, admin rights). If it is
      a receptionist's working PC, put a mini PC in instead.
- [ ] New Supabase project (same account — a new ACCOUNT is not needed; free
      tier allows 2 active projects per org). Schema mirrored, tables empty.
- [ ] Fork the repo, swap the config block, strip DalMex branding.
- [ ] Seed their haulers into `approved_haulers` (never hard-coded), plus
      materials and projects.
- [ ] Deploy to Cloudflare Pages — GitHub Pages allows only one custom domain
      per repo. Branded URL (`scale.metropolitanrecycling.com`) needs their DNS.
      Interim: a path on Robert's domain, no DNS required.
- [ ] Move the Supabase org to Pro ($25/mo + $10 per extra project) BEFORE it
      is a paid production system — free tier has no backups, which is not
      acceptable for a legal-for-trade weight record.
- [ ] Scale service company signs off on the printer + comms config, and
      confirms whether any calibration seal is affected. In writing.
- [ ] Scope and payment terms in writing before this becomes production.

**After-hours driver access:** already built — `drivers` table + `driver_token`
+ `driver.html?t=` loadbook + `welcome.html` onboarding (the Jaguar flow).
Ports as-is. Policy question for Mark, not a code question: is after-hours open
to everyone, or only known haulers with stored tares? Nobody eyeballs the load
when the office is empty.

**Pricing:** hold until Mark says whether this is a hire or a sale. If they hire
Robert, DivertScan is salary leverage, not a line item. If not, it is a product
sale. Hard costs are ~$35/mo Supabase for both sites + hosting (free) + install
time — so nearly all of the number is value, not cost. Anchor on labor: trucks
per day × minutes someone currently spends walking outside.

**Prep work in the DalMex codebase (do this first, it makes the fork clean):**
- [ ] Facility name, address, phone, contact, and email are hard-coded as
      literal strings in FOUR export functions instead of reading the single
      `DS.FACILITY` object: `exportAllXLSX`, the LEED compliance text export,
      `shareTicketSummary`, and the `client.html` footer. Point them all at
      `DS.FACILITY`. This is the difference between a template and a fork.
- [ ] Also loose and needing a per-site home: `<title>`, header `<h1>`, the
      "LEED MRp2/MRc5" subtitle, `deviceLabel` ("Dalmex Scale 01") and the
      header in `scale.html`, `manifest.json`, and the app icon.


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

# DIVERTSCAN — MASTER TO-DO (priority-ordered)

**Last updated: Sunday, July 5, 2026.** This replaces the old TODO and the APEX brief.
Update the date whenever you change something.

**System status:** Fully operational and verified in production. The Pi reads real truck
weight off the WI-127, hashes it, buffers locally, and syncs to Supabase over cellular.
The admin app (`index.html`, vanilla JS + Supabase, on GitHub Pages) is live and working.
The client portal (`client.html`) now authenticates through secure database functions
(RPC) with row-level security locked on the credential tables.

**Two systems, two ways to edit:**
- **Pi / `scale_capture.py`** — lives at `/home/pi/scale_capture.py`, run by
  `scale_capture.service` (`/etc/systemd/system/scale_capture.service`). Edit via
  Termius (SSH), staged patch, verify live.
- **`index.html`** (~12k lines) — edit on GitHub via branch + PR, merge → GitHub Pages
  auto-deploys. ALWAYS back up before editing. One change at a time. Verify each.

---

## ✅ DONE — verified July 4–5 session
- **Client-portal security overhaul (the big one):** discovered `client_accounts`
  (client emails + password hashes) and `client_logins` were publicly readable AND
  writable with the anon key — anyone could have read hashes (crackable: 4-char min,
  fixed salt in public repo), created accounts, or granted themselves project access.
  Fixed properly:
  - Created security-definer functions `client_login` / `client_session` — portal
    logs in via RPC; the hash column never leaves the database.
  - Created `admin_set_client_password('email','newpw')` — password resets are now a
    one-liner in the Supabase SQL Editor (dashboard-only, not callable from outside).
  - Patched `client.html` (login + session restore) via branch/PR, deployed.
  - Enabled RLS on `client_accounts` + `client_logins`, dropped the two allow-all
    policies (`admin_manage_clients`, `allow_all_client_accounts`).
  - **Verified locked:** anon-key reads of both tables return `[]` from outside.
  - Fixed an ambiguous-column bug in `client_login`/`client_session` (July 5) —
    functions verified working via SQL simulation (login returns the client row).
- **Pi password changed** (old one had appeared in chat).
- Confirmed the real Pi service: `scale_capture.service` → `/home/pi/scale_capture.py`
  (the old `divertscan-capture.service` file was a never-installed draft with a wrong
  path). Sync health confirmed: 58/58 synced, pending 0.
- `MASTER_CORE_SPEC.md` confirmed gone from project knowledge.
- Pi temp noted 149.3°F on a July afternoon — top of normal band, fine (throttle ~185°F).

## 🔑 KEY FINDING (shapes priorities below)
- **CO₂e / carbon numbers are INTERNAL-ONLY.** Customer & LEED reports (e.g. Children's
  Hospital) are 100% weight-based (diversion rate, tons) with NO CO₂e on any page.
- Per-project reports are LEED-clean by design. Only the internal "All Projects Portfolio"
  view blends LEED + Non-LEED (Hayes steel). Hayes is correctly flagged Non-LEED already.

---

## 🔒 SECURITY FOLLOW-UPS (from the July 4–5 audit — work these next)
- [ ] **FINISH THE PORTAL DEPLOY.** The patched `client.html` is merged to main but
      GitHub Pages has failed to deploy it (GitHub incidents July 4–5) — the LIVE portal
      still runs the old code, so client logins FAIL until a deploy succeeds. Any new
      merge to main triggers a fresh pipeline. When Actions shows a green deploy, verify:
      log in at `divertscan.com/client.html?v=3` (private tab), then close/reopen to
      confirm session restore. Clients (Jaguar, Liberty) log in Mondays — fix before then.
- [ ] **Back up `scale_capture.py` + `scale_capture.service` to the GitHub repo — STILL
      NOT DONE.** The commit was started July 4 but never completed (both files 404 in
      the repo as of July 5). The only copy of the production capture script is the Pi's
      SD card, which has died once before. `cat` both on the Pi, paste into GitHub
      (Add file → Create new file → branch → PR → merge), then tick them in the project's
      GitHub sync. TOP of the list.
- [ ] **Known breakage from the lockdown (expected, accepted):** the admin app's
      "Client Portal Access" card (create/edit/delete clients) and "Client Login Log"
      card no longer work, and `reset-client.html` no longer works with the anon key.
      Workarounds: manage clients in the Supabase dashboard Table Editor; reset passwords
      with the `admin_set_client_password` one-liner; view login log in the dashboard.
      (`reset-client.html` can work again if the service_role key is entered into its
      key field on Robert's own device only — never committed anywhere.)
- [ ] **Long-term fix for the above: put the admin app behind Supabase Auth** so admin
      pages use an authenticated role with real policies, restoring client management
      in-app. Proper project — plan it, don't rush it.
- [ ] **Rotate the Supabase anon key.** Still pending; still hard-coded in three places
      (Pi script, index.html, scale.html) and public in the repo + chat history. Now that
      the credential tables are locked this is less explosive, but the old key remains in
      git history forever — rotate at a calm moment and update all three files in one
      coordinated pass (Pi buffers locally, so worst case is a short sync delay).
- [ ] **Rotate the dispatcher tokens** (`dispatchers.dispatcher_token`) — token values
      appeared in a chat screenshot July 4. Generate new tokens, redistribute the
      dispatcher links.
- [ ] **Review the UNRESTRICTED tables/views** flagged in the Supabase Table Editor:
      `project_material_t...`, `project_summary`, and views `v_admin_review`,
      `v_all_drivers`, `v_dispatcher_ro...`, `v_driver_logbook`, `v_fleet_tares`,
      `v_hauler_drivers`. Views can bypass table RLS — decide per-view whether public
      read is actually needed (driver/dispatcher pages may need some) and lock the rest.
- [ ] **Raise the client password minimum** (currently 4 chars in the admin app's
      create-client form) when the admin app gets touched next.
- [ ] **Remove the stale `divertscan-capture.service`** from project knowledge (wrong
      name, wrong path — the real one is `scale_capture.service`).

## 🟢 EASY / QUICK WINS (minutes, low risk)
- [ ] **Mark averaged-tare loads as "Estimated"** — the DX driver tickets use a standard
      tare (~32540). Now that the Tare Source field exists, flip those to Estimated so
      net weights are honestly labeled.

## 🟡 MEDIUM (an evening each, some care)
- [ ] **Priority: PDF batch ticket import** — accept one Adobe Scan PDF, split pages via
      pdf.js, feed into the existing OCR pipeline. Solves the out-of-town "upload 50
      tickets" pain. (The OCR + review queue already exist; only the PDF-split front door
      is missing.)
- [ ] **Admin-panel temperature display** — Pi pushes temp/health to Supabase on a
      schedule; dashboard widget shows current + daily high + history.
- [ ] **Cellular auto-recovery script** (Pi) — checks usb0 IP + default route, recovers modem.
- [ ] **Tailscale auto-recovery script** (Pi) — restarts Tailscale if the link drops.

## 🔵 CARBON DASHBOARD (internal-only — improve when convenient, NOT urgent)
- [ ] **Add a LEED / Non-LEED filter to the "All Projects Portfolio" carbon view** so the
      internal CO₂e number can exclude Hayes/Non-LEED when wanted.
- [ ] **Consolidate + correct the GWP carbon factors.** Hard-coded in TWO places
      (index.html ~line 1424 `MATERIALS` and ~line 3650) and don't match EPA WARM v16
      (e.g. Cardboard is 0.94, WARM ≈ 3.1). Move to ONE editable source, align to WARM,
      cite the source.

## 🔴 HARDER / HIGH-STAKES (build carefully, verify)
- [ ] **Restart-safe debounce (Pi)** — a service restart while a truck is parked can
      re-capture it (seen: #17/#18). Persist lock across restarts. Edge case, not urgent.
- [ ] **Clean duplicate/mistagged historical rows** — old pre-debounce duplicates (5500
      logged ~4×) and the restart pair are already synced. Clean local + Supabase
      deliberately. Fresh-head task.
- [ ] **Move Pi serial off USB to a 2nd GPIO UART** — reduces recurring USB-adapter
      failure risk (4G HAT uses primary UART). Hardware + config.

## ⚙️ ONGOING HABITS
- [ ] Never hard-power-cut the Pi: `sudo shutdown -h now`, wait for green LED, then unplug.
- [ ] Watch `temp` on hot afternoons (bay ~120–150°F is fine; throttle ~185°F). Blow dust
      out quarterly.
- [ ] Back up index.html before EVERY admin edit; branch + PR; one change → deploy →
      verify → next.

## ⛔ DEFERRED / BLOCKED
- [ ] On-demand Wi-Fi printer — BLOCKED (printer side has no internet). Pi pushes, printer pulls.
- [ ] Field diagnostic kit — 7" self-powered HDMI monitor + Perixx USB keyboard +
      micro-HDMI + power bank in truck.
- [ ] Multi-site rollout — use the Node Hardening Spec for repeatable builds.
- [ ] Restrict hauler visibility for logged-in clients (security) — separate task.

---
*Detailed batch-ticket data rules (Hayes composition, spelling aliases, buyer defaults,
date fallback) live in `DivertScan_Priority2_Batch_Ticket_Spec_v2.md` if that gets built.*
